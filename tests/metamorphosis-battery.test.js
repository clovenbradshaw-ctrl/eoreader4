import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseText } from '../src/perceiver/parse/index.js';
import { enactedReadingTo } from '../src/enact/index.js';

// THE METAMORPHOSIS BATTERY — Test 7, the decisive CONTROLS (docs/metamorphosis-battery.md §7).
//
// "When the structure is destroyed, the engine's quantities must collapse, or they were never
// reading structure." §7 is foundational: it needs no gold marks. SHUFFLE proves the engine
// depends on sentence ORDER (not on which sentences are merely present); LULL proves it goes
// dark where there is no structure. Shuffles are seeded, so these are deterministic.

const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (arr, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// The enacted loop's released strain over a whole reading: the REC count and the total
// strain released at restructurings — the quantities §7 says must depend on structure.
const strainOf = (doc) => {
  const S = (doc.units || doc.sentences || []).length;
  const r = enactedReadingTo(doc, S - 1);
  return { recs: r.stats.proposition?.recs || 0, total: (r.recs || []).reduce((s, x) => s + (x.strainSum || 0), 0) };
};

test('battery §7 — LULL control: the engine goes DARK on structureless text', () => {
  // One figure, repeated, no development: there is nothing to restructure on.
  const lull = parseText(Array.from({ length: 24 }, () => 'Gregor lay still in the dim quiet room.').join(' '), { docId: 'lull' });
  const { recs, total } = strainOf(lull);
  assert.equal(recs, 0, 'no frame breaks where nothing changes');
  assert.ok(total < 0.01, `strain stays ~0 in the flat, got ${total}`);
});

test('battery §7 — SHUFFLE control: the engine DEPENDS on sentence order (not marginal statistics)', () => {
  // The decisive discipline: ordered ≠ shuffled. If scrambling the sentences left the
  // engine's quantities unchanged, it would be reading WHICH sentences are present, not HOW
  // they are arranged — marginal statistics, not structure.
  //
  // Mechanism (measured): the cheap γ-mass reader's strain tracks LOCAL figure-coherence —
  // shuffling destroys coherence between adjacent sentences and RAISES strain. So order
  // matters (this control passes), but the battery's "rise-to-crisis" claim (test 1) tracks
  // narrative TENSION, which this reader does not see; that awaits the meaning reader. When
  // it lands and ordered strain peaks AT the crises, this test's direction will flip — the
  // regression marker for that fix.
  const docO = parseText(readFileSync('data/metamorphosis.txt', 'utf8'), { docId: 'o' });
  const sents = docO.sentences || docO.units;
  const ordered = strainOf(docO);

  const K = 30;
  let sum = 0;
  for (let k = 0; k < K; k++) sum += strainOf(parseText(shuffle(sents, mulberry32(1000 + k)).join(' '), { docId: `s${k}` })).total;
  const shuffledMean = sum / K;

  const rel = Math.abs(shuffledMean - ordered.total) / ordered.total;
  assert.ok(rel > 0.1,
    `ordered (${ordered.total.toFixed(2)}) and shuffled-mean (${shuffledMean.toFixed(2)}) must differ — the engine reads order, not marginals (rel=${rel.toFixed(2)})`);
});
