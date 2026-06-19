import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { retrieveLexical } from '../src/retrieve/lexical.js';
import { retrieveHybrid, fuseConcordance } from '../src/retrieve/hybrid.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

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
