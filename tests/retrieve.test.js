import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/pipeline.js';
import { retrieveLexical } from '../src/retrieve/lexical.js';
import { retrieveHybrid, fuseConcordance, pickRetrievalEmbedder } from '../src/retrieve/hybrid.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import { ingestText } from '../src/organs/in/text.js';

const withEmbeddings = (doc) => {
  let p = null;
  doc.sentenceEmbeddings = async (e) => {
    if (p) return p;
    p = Promise.all(doc.sentences.map(s => e.embed(s)));
    return p;
  };
  return doc;
};

test('retrieveLexical ranks by token overlap', () => {
  const doc = parseText(
    'Alice loves apples. Bob hates broccoli. Charlie eats cake.',
    { docId: 'd1' }
  );
  const r = retrieveLexical(doc, 'apples', 5);
  assert.equal(r[0].idx, 0);
});

test('retrieveLexical returns empty on no overlap', () => {
  const doc = parseText('Alice loves apples.', { docId: 'd1' });
  const r = retrieveLexical(doc, 'zebras', 5);
  assert.equal(r.length, 0);
});

test('retrieveHybrid merges lexical and semantic, fusing by concordance', async () => {
  const doc = withEmbeddings(parseText(
    'Alice loves apples. Bob hates broccoli.', { docId: 'd1' }
  ));
  const embedder = createHashEmbedder();
  const r = await retrieveHybrid(doc, 'apples', embedder, 5);
  assert.ok(r.length > 0);
  // sentence 0 should be top-ranked (it contains 'apples')
  assert.equal(r[0].idx, 0);
  // the channels each span drew on are reported, so the fusion is auditable
  assert.ok(r[0].kind === 'lex+sem' || r[0].kind === 'lex');
});

test('fuseConcordance rewards agreement — two weak channels beat one strong channel alone', () => {
  // The property max-pool could not express: concordant evidence compounds.
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  assert.ok(fuseConcordance(0.5, 0.5) > 0.5, 'two agreeing weak readers exceed either alone');
  assert.ok(fuseConcordance(0.5, 0.5) > fuseConcordance(0.6, 0), 'weak agreement can beat a lone stronger reader');
  // A lone strong channel is preserved; a lone weak one stays weak.
  near(fuseConcordance(0.9, 0), 0.9);
  near(fuseConcordance(0.3, 0), 0.3);
  // Bounded; a negative cosine is no-evidence, never anti-evidence (clamped to 0).
  near(fuseConcordance(1, 0.42), 1);
  near(fuseConcordance(0.4, -0.8), 0.4);
});

test('retrieveLexical respects k', () => {
  const doc = parseText(
    'Alice ran. Bob ran. Charlie ran. Dana ran. Eve ran.',
    { docId: 'd1' }
  );
  const r = retrieveLexical(doc, 'ran', 3);
  assert.equal(r.length, 3);
});

// Fuzzy: a term the document never spells exactly is rescued onto the nearest token
// it DOES spell ("greta"→"grete"), so a near-miss no longer sinks the whole turn.
test('retrieveLexical fuzzy-matches a near-spelling the document never writes', () => {
  const doc = parseText('His sister Grete brought milk. Grete set the food down.', { docId: 'd1' });
  const exact = retrieveLexical(doc, 'grete', 5);
  const fuzzy = retrieveLexical(doc, 'greta', 5);   // 'greta' appears nowhere
  assert.ok(fuzzy.length > 0, 'the near-spelling still retrieves');
  assert.deepEqual(fuzzy.map(s => s.idx), exact.map(s => s.idx), 'it lands on the Grete lines');
  assert.ok(fuzzy[0].score < exact[0].score, 'a fuzzy hit scores below the exact one');
});

// Exactness is never diluted: a real word matches only itself, and a term with no
// near neighbour retrieves nothing (no phantom hits).
test('retrieveLexical keeps an exact term exact and still abstains on a far term', () => {
  const doc = parseText('Alice loves apples. Bob hates broccoli.', { docId: 'd1' });
  assert.equal(retrieveLexical(doc, 'apples', 5)[0].score, 1, 'exact stays full-weight');
  assert.equal(retrieveLexical(doc, 'zebras', 5).length, 0, 'no near neighbour → empty');
});

// ── The meaning organ on the retrieval path ──────────────────────────────────
// The audit showed recall@6 = 3/12: the "semantic" channel ran on the hash organ,
// which measures spelling, so a paraphrased question (no shared surface words) sank.
// These lock in the fix — retrieval reads MEANING when a meaning organ is live, and
// falls back to the hash organ (never blocking on the download) when it is not.

// Cache the doc's vectors PER ORGAN, mirroring the real ingest fix: two embedders on
// one doc must not contaminate each other's space.
const withPerOrganEmbeddings = (doc) => {
  const cache = new Map();
  doc.sentenceEmbeddings = async (e) => {
    const key = e?.id || 'default';
    if (!cache.has(key)) cache.set(key, Promise.all(doc.sentences.map(s => e.embed(s))));
    return cache.get(key);
  };
  return doc;
};

// A fake MEANING organ: surface tokens load shared CONCEPT axes, so paraphrases with
// no shared spelling still land near each other — exactly what the hash organ cannot
// do. 'job' and 'salesman'/'travelling' load the same axis.
const CONCEPT_AXIS = {
  job: 0, work: 0, occupation: 0, profession: 0, salesman: 0, travelling: 0, sells: 0,
  apple: 1, apples: 1, fruit: 1, loves: 1,
};
const meaningEmbedder = (warm = true) => ({
  id: 'fake-meaning', measuresMeaning: true, isWarm: () => warm,
  async warm() {},
  async embed(text) {
    const v = new Float32Array(3);
    for (const t of String(text).toLowerCase().split(/[^a-z]+/)) {
      if (t && t in CONCEPT_AXIS) v[CONCEPT_AXIS[t]] += 1;
    }
    const n = Math.hypot(v[0], v[1], v[2]) || 1;
    return new Float32Array([v[0] / n, v[1] / n, v[2] / n]);
  },
});

test('pickRetrievalEmbedder reads MEANING when the organ is live, else the hash fallback', () => {
  const hash     = { id: 'hash-embed', measuresMeaning: false, isWarm: () => true };
  const miniCold = { id: 'minilm', measuresMeaning: true, isWarm: () => false };
  const miniWarm = { id: 'minilm', measuresMeaning: true, isWarm: () => true };

  assert.equal(pickRetrievalEmbedder({ embedder: hash }), hash, 'no meaning organ → hash');
  assert.equal(pickRetrievalEmbedder({ embedder: hash, geometricEmbedder: miniCold }), hash,
    'cold meaning organ → still hash (never block on the download)');
  assert.equal(pickRetrievalEmbedder({ embedder: hash, geometricEmbedder: miniWarm }), miniWarm,
    'live meaning organ → read meaning');
  assert.equal(
    pickRetrievalEmbedder({ embedder: hash, geometricEmbedder: { measuresMeaning: false, isWarm: () => true } }),
    hash, 'a non-meaning organ is never preferred over the fallback');
});

test('retrieveHybrid reaches a PARAPHRASE with a meaning organ that the hash organ misses', async () => {
  const text  = 'Gregor woke transformed. Samsa was a travelling salesman. Alice loves apples.';
  const query = "What is Gregor's job?";   // shares 'gregor' with s0, NOTHING with the salesman line
  const goldOf = (doc) => doc.sentences.findIndex(s => /salesman/.test(s));

  // Hash organ: lexical-in-disguise. The query's only surface contact is 'gregor'
  // (sentence 0), so the salesman line — the real answer — is NOT the top span.
  const hashed  = withPerOrganEmbeddings(parseText(text, { docId: 'd' }));
  const hashTop = (await retrieveHybrid(hashed, query, createHashEmbedder(), 6))[0];
  assert.notEqual(hashTop.idx, goldOf(hashed), 'hash retrieval misses the paraphrased answer');

  // Meaning organ live: 'job' ~ 'salesman'/'travelling' on a shared axis, so the
  // salesman line rises to the top even with zero shared spelling.
  const meant   = withPerOrganEmbeddings(parseText(text, { docId: 'd' }));
  const meanTop = (await retrieveHybrid(meant, query, meaningEmbedder(true), 6))[0];
  assert.equal(meanTop.idx, goldOf(meant), 'meaning retrieval reaches the paraphrased answer');
});

test('ingestText caches sentence embeddings PER ORGAN — the upgrade is not masked by a stale space', async () => {
  const doc = await ingestText('Samsa was a travelling salesman. Alice loves apples.', { docId: 'd' });
  const vHash = await doc.sentenceEmbeddings(createHashEmbedder());   // first caller: 64-dim hash space
  const vMean = await doc.sentenceEmbeddings(meaningEmbedder(true));  // second caller: must be freshly computed
  assert.equal(vHash[0].length, 64, 'hash organ → 64-dim hash space');
  assert.equal(vMean[0].length, 3,  'meaning organ → its own space, not the cached hash vectors');
});
