import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMeaningRead, enactedReadingMeaning, enactedReadingTo, isEnacted,
} from '../src/enact/index.js';
import { parseText } from '../src/parse/index.js';

// A deterministic stand-in for MiniLM: each clause embeds to a fixed vector by
// keyword, so meaning-distance is controllable under test. Proves the mechanism
// without the model (which the sandbox can't fetch); the real organ slots in
// unchanged, since the embedder is injected.
const stub = (vecOf) => ({ id: 'stub-mini', measuresMeaning: true, embed: async (t) => vecOf(t) });
const sea = (t) => /ship|harbor|burn|sail|sank/i.test(t);     // the "other sense"

// §11 — the surprise is the prediction error in meaning space.
test('meaning surprise: the opening is calm, a semantic turn spikes it', async () => {
  const vecOf = (t) => (sea(t) ? new Float32Array([0, 1]) : new Float32Array([1, 0]));
  const doc = { sentences: ['Cat sat.', 'Cat purred.', 'Cat slept.', 'A ship sailed.', 'The ship sank.'] };
  const mr = await buildMeaningRead(doc, stub(vecOf));
  assert.equal(mr.surprise[0], 0, 'the opening cannot surprise (no prior)');
  assert.ok(mr.surprise[2] < 0.1, 'continuing the sense is near-zero surprise');
  assert.ok(mr.surprise[3] > 0.9, 'a turn to an orthogonal sense spikes surprise');
});

// The firewall: meaning-distance is only real in a meaning space.
test('the hash organ cannot measure meaning — buildMeaningRead returns null', async () => {
  const hash = { id: 'hash', measuresMeaning: false, embed: async () => new Float32Array([1, 0]) };
  const doc = { sentences: ['Cat sat.', 'A ship sailed.'] };
  assert.equal(await buildMeaningRead(doc, hash), null, 'falls back to the skeleton (firewall)');
});

// The deepening's whole point: a restructure on a sense-turn the γ-mass reader is
// blind to — same figure throughout, no new name, but the meaning moves.
test('the meaning reader RECs on a turn the γ-mass reader misses', async () => {
  const text = 'Mara Voss waited. Mara Voss waited. Mara Voss waited. Mara Voss waited. ' +
               'The harbor burned. The harbor burned. The harbor burned. The harbor burned.';
  const doc = parseText(text, { docId: 'm' });
  const end = doc.sentences.length - 1;
  const vecOf = (t) => (sea(t) ? new Float32Array([0, 1]) : new Float32Array([1, 0]));
  const th = { thresholds: { proposition: 0.5, document: 2 } };

  const deep = await enactedReadingMeaning(doc, end, { embedder: stub(vecOf), ...th });
  assert.equal(deep.reader, 'meaning');
  assert.ok(deep.frames.get('proposition') && deep.frames.get('document'), 'frames at both layers');
  assert.ok(deep.events.every(isEnacted), 'the same enacted loop, single-register');
  assert.ok(deep.stats.proposition.recs >= 1, 'the semantic turn forces a restructure');

  // The cheap reader sees no new figure across the turn (harbor is no entity), so
  // it does not restructure there — the depth the meaning reader adds.
  const cheap = enactedReadingTo(doc, end, th);
  assert.ok(deep.stats.proposition.recs > cheap.stats.proposition.recs,
    'the meaning reader restructures on a sense-turn the γ-mass reader is blind to');
});

// The calibration: the meaning surprise lives far above the γ-mass band, so the
// reader self-calibrates its confirm band to the median — "a normal step in this
// text's meaning" — not the skeleton's 0.25 (validated on real embeddings: a novel
// reads turbulently at 0.25, calmly and convergently at its median ≈ 0.6).
test('the meaning reader self-calibrates its confirm band to the median surprise', async () => {
  const vecOf = (t) => (sea(t) ? new Float32Array([0, 1]) : new Float32Array([1, 0]));
  const doc = parseText('A calm day. A calm day. A calm day. A ship sailed. The ship sank. The ship burned.', { docId: 'b' });
  const mr = await buildMeaningRead(doc, stub(vecOf));
  const s = [...mr.surprise].sort((a, b) => a - b);
  const med = s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2;
  const deep = await enactedReadingMeaning(doc, doc.sentences.length - 1, { embedder: stub(vecOf) });
  assert.ok(Math.abs(deep.confirmBand - Math.round(med * 1000) / 1000) < 0.002,
    `band self-calibrated to the median ${med}, got ${deep.confirmBand}`);
  assert.notEqual(deep.confirmBand, 0.25, 'not the γ-mass band');
});

// enactedReadingMeaning degrades honestly: a non-measuring embedder → the skeleton.
test('enactedReadingMeaning falls back to the cheap reader under the hash organ', async () => {
  const doc = parseText('Anna walked. Anna walked. Anna ran. Anna ran.', { docId: 'f' });
  const hash = { id: 'hash', measuresMeaning: false, embed: async () => new Float32Array([1, 0]) };
  const r = await enactedReadingMeaning(doc, doc.sentences.length - 1, { embedder: hash });
  assert.equal(r.reader, 'cheap', 'no meaning organ → the skeleton, not a thrown boot');
  assert.ok(r.frames.get('proposition'), 'still a real reading');
});
