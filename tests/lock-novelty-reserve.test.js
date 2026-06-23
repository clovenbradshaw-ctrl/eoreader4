import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bornNoveltyReserve, reserveMassFor, forwardDist } from '../src/core/surprise.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';
import { ingestMusic } from '../src/organs/in/music.js';

// REGRESSION LOCK — confirmed capability: the forward object's novelty reserve is a calibrated,
// CONTEXTUAL, Born-rule probability of novelty (experiments/cycles/001-novelty-reserve), and the
// default path is byte-identical. Written to FAIL the day a precondition changes — including the
// CONTROL, so a reserve that fires on the cheap cumulative count (instead of the recency-weighted
// rate) fails here rather than passing.

const ALPHA = 0.05;
const reservesText = (units, calibrate) => {
  const doc = parseText(units.join(' '), { docId: 't' });
  return units.map((_, k) =>
    readingAt(doc, k, { forward: true, calibrateReserve: calibrate, alpha: ALPHA }).pNext.reserve);
};
const STEADY = ['Duane met Morgan.','Duane met Morgan.','Gabin met Morgan.','Duane met Morgan.',
  'Delannoy met Morgan.','Duane met Morgan.','Misraki met Morgan.','Duane met Morgan.',
  'Pimenoff met Morgan.','Duane met Morgan.','Chiari met Morgan.','Duane met Morgan.'];
const RECUR = ['Duane met Morgan.','Gabin met Morgan.','Duane met Morgan.','Duane met Morgan.',
  'Gabin met Morgan.','Duane met Morgan.','Gabin met Morgan.','Duane met Morgan.',
  'Gabin met Morgan.','Duane met Morgan.','Gabin met Morgan.','Duane met Morgan.'];
const SHIFT = ['Duane met Morgan.','Gabin met Morgan.','Delannoy met Morgan.','Misraki met Morgan.',
  'Pimenoff met Morgan.','Chiari met Morgan.','Duane met Morgan.','Gabin met Morgan.',
  'Delannoy met Morgan.','Misraki met Morgan.','Pimenoff met Morgan.','Chiari met Morgan.'];
const last = (xs) => xs[xs.length - 1];

test('PARITY: calibrateReserve OFF is byte-identical to the plain forward path', () => {
  const doc = parseText(STEADY.join(' '), { docId: 'p' });
  for (let k = 0; k < STEADY.length; k++) {
    const plain = readingAt(doc, k, { forward: true }).pNext;
    const off   = readingAt(doc, k, { forward: true, calibrateReserve: false }).pNext;
    assert.equal(off.reserve, plain.reserve, `cursor ${k}: flag-off reserve must equal the default`);
    assert.equal(off.dist.length, plain.dist.length);
  }
});

test('the FIXED reserve is BLIND: steady-novelty and recurrence land at the same reserve (the gap)', () => {
  const sep = Math.abs(last(reservesText(STEADY, false)) - last(reservesText(RECUR, false)));
  assert.ok(sep < 0.02, `fixed reserve must not separate the regimes, got Δ=${sep}`);
});

test('the CALIBRATED reserve SEPARATES the regimes (steady >> recurrence)', () => {
  const sep = last(reservesText(STEADY, true)) - last(reservesText(RECUR, true));
  assert.ok(sep > 0.3, `calibrated reserve must separate steady from recurrence, got Δ=${sep}`);
});

test('CONTROL: on the regime shift the calibrated reserve FALLS after newcomers stop', () => {
  const born = reservesText(SHIFT, true);
  // The cheap cumulative counter stays ~0.5 across the shift; the recency-weighted reserve must NOT.
  assert.ok(last(born) < 0.5 * born[5],
    `reserve must fall after the shift (unit11 ${last(born)} < 0.5*unit5 ${born[5]})`);
  // And the fixed reserve is flat across the same shift — it cannot see the regime at all.
  const fixed = reservesText(SHIFT, false);
  assert.ok(Math.abs(last(fixed) - fixed[5]) < 0.02, 'fixed reserve is flat across the shift (the gap)');
});

test('OMNIMODAL: the SAME interior separates a high-novelty melody from a low-novelty one', () => {
  const mel = (notes, cal) => {
    const doc = ingestMusic({ name: 'm', notes });
    return notes.map((_, k) => readingAt(doc, k, { forward: true, calibrateReserve: cal, alpha: ALPHA }).pNext.reserve);
  };
  const high = mel(['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4'], true);
  const low  = mel(['C4','E4','G4','C4','E4','G4','C4','E4','G4','C4','E4','G4'], true);
  assert.ok(last(high) - last(low) > 0.2, `music: calibrated reserve must separate melodies, got Δ=${last(high) - last(low)}`);
  // text-blind: the fix is interior, not a text leak.
  const lowF = mel(['C4','E4','G4','C4','E4','G4','C4','E4','G4','C4','E4','G4'], false);
  const highF = mel(['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4'], false);
  assert.ok(Math.abs(last(highF) - last(lowF)) < 0.05, 'fixed reserve is modality-blind too (the same gap)');
});

test('interior contract: bornNoveltyReserve — exact void, alpha bounds, null on no context', () => {
  assert.equal(bornNoveltyReserve([], { alpha: ALPHA }), null, 'no context → null (caller keeps default)');
  // all recurrence (zeros) → floor at alpha; all novel (positives) → cap at 1-alpha.
  const allRecur = bornNoveltyReserve([0, 0, 0, 0, 0, 0], { gamma: 0.7, alpha: ALPHA });
  const allNovel = bornNoveltyReserve([2, 2, 2, 2, 2, 2], { gamma: 0.7, alpha: ALPHA });
  assert.ok(Math.abs(allRecur - ALPHA) < 1e-9, `all-recurrence floors at alpha, got ${allRecur}`);
  assert.ok(Math.abs(allNovel - (1 - ALPHA)) < 1e-9, `all-novel caps at 1-alpha, got ${allNovel}`);
  // alpha is the only knob: a tighter alpha lowers the floor.
  const tighter = bornNoveltyReserve([0, 0, 0, 0], { gamma: 0.7, alpha: 0.01 });
  assert.ok(tighter < allRecur, 'a tighter alpha lowers the floor');
  // reserveMassFor inverts forwardDist exactly: reserve(m)=target.
  const target = 0.4, sum = 3;
  const r = forwardDist(new Map([['a', sum]]), { novelty: reserveMassFor(target, sum) }).reserve;
  assert.ok(Math.abs(r - target) < 1e-9, `reserveMassFor must hit the target reserve, got ${r}`);
});
