// REGRESSION LOCK — E002: the signal reserve generalizes as a better predictive
// model of real content. Locks the generalization (evo/experiments/E002): on a
// captured real article stream the signal-derived reserve lowers mean held-out
// predictive surprisal, and its edge comes from recency structure (it beats its
// own seeded shuffle). Reverting the reserve to a constant fails this.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from '../src/core/index.js';
import { readingAt } from '../src/perceiver/reading.js';
import { makeRng, hashSeed } from '../evo/lib/rng.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const stim = JSON.parse(readFileSync(join(HERE, '../evo/experiments/E002-reserve-calibration/stimulus.json'), 'utf8'));

const streamDoc = (seq) => {
  const log = createLog({ docId: 'e2' });
  seq.forEach((tok, i) => log.append({ op: 'INS', id: tok, label: tok, sentIdx: i }));
  return { units: seq.slice(), sentences: seq.slice(), log };
};
const meanSurprisal = (seq, signalReserve) => {
  const doc = streamDoc(seq); let sum = 0, n = 0;
  for (let at = 1; at < seq.length; at++) { sum += readingAt(doc, at, { signalReserve }).surprisalBits; n++; }
  return n ? sum / n : 0;
};
const shuffle = (seq, seed) => {
  const a = seq.slice(); const rng = makeRng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// The recency edge lives in the FULL article's structure (the later reuse
// plateaus, not the high-novelty intro), so the lock scores the whole stream where
// the result was confirmed — a prefix is mostly intro and the edge can vanish.
const seq = stim.stream;
const shuf = shuffle(seq, hashSeed(stim.seedOfRecord.title + ':' + stim.seedOfRecord.revid));

test('E002 generalization: the signal reserve lowers held-out surprisal on real content', () => {
  const fixed = meanSurprisal(seq, false);
  const signal = meanSurprisal(seq, true);
  assert.ok(fixed - signal > 0.01, `signal reserve must improve real-content prediction: fixed ${fixed.toFixed(3)} → signal ${signal.toFixed(3)}`);
});

test('E002 control: the edge comes from recency structure (beats its own shuffle)', () => {
  const orderedImp = meanSurprisal(seq, false) - meanSurprisal(seq, true);
  const shuffledImp = meanSurprisal(shuf, false) - meanSurprisal(shuf, true);
  assert.ok(orderedImp > shuffledImp + 0.005,
    `the gain must be recency-specific: ordered ${orderedImp.toFixed(3)} > shuffled ${shuffledImp.toFixed(3)}`);
});
