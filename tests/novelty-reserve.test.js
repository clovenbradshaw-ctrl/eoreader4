import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog } from '../src/core/log.js';
import { noveltyReserve, NOVELTY_RESERVE } from '../src/core/surprise.js';
import { readingAt } from '../src/perceiver/reading.js';
import { ingestMusic } from '../src/organs/in/music.js';

// REGRESSION LOCK — experiments/exp-0002 (the signal-derived novelty reserve).
//
// The fixed reserve is blind to whether newcomers have been arriving: at matched
// prior MASS the reader's surprise at a newcomer is identical whether the recent
// stream was novelty-dense or novelty-barren. The fix makes the reserved AMPLITUDE
// the γ-decayed recent newcomer-arrival rate, run through the SAME fixed Born step.
//
// This lock fails the day a precondition changes: if the default path stops being
// byte-identical (the gap must remain on the OFF path), if the signal split stops
// being monotonic in novelty rate, if the loud-surface control swings, or if the
// second sense (music) stops tracking the first. It asserts the control too, so a
// change that merely rescales mass fails rather than passes.

const GAMMA = 0.7;            // reading.js default horizon
const K = 6;                  // prior steps before the probe

// A modality-neutral doc: ids[k] is the atom that arrives at step k (one INS/step,
// so the γ-decayed prior MASS at the probe is identical across schedules); a genuine
// newcomer arrives at the probe cursor (= ids.length).
const neutral = (ids, probe = 'NEW') => {
  const log = createLog({ docId: 'lock' });
  ids.forEach((id, k) => log.append({ op: 'INS', id, label: id, sentIdx: k }));
  log.append({ op: 'INS', id: probe, label: probe, sentIdx: ids.length });
  return { doc: { log, units: Array.from({ length: ids.length + 1 }, (_, i) => `u${i}`) }, cursor: ids.length };
};
const reserveOf = (sched, mode) => {
  const { doc, cursor } = neutral(sched);
  return readingAt(doc, cursor, { forward: true, reserve: mode }).reserveFig;
};

const dense  = ['a0', 'a1', 'a2', 'a3', 'a4', 'a5'];           // a newcomer every step
const mid    = ['a0', 'a1', 'a2', 'a0', 'a1', 'a2'];           // 3 newcomers, then repeats
const barren = ['b', 'b', 'b', 'b', 'b', 'b'];                 // one newcomer, then drought

// ── the interior helper: the signal-derived amplitude is the γ-decayed birth rate ──
test('noveltyReserve sums γ^(at-1-birth) over births before the cursor', () => {
  const firstDense = new Map(dense.map((id, k) => [id, k]));   // a birth every step 0..5
  const firstBarren = new Map([['b', 0]]);                     // one birth at step 0
  const geom = Array.from({ length: K }, (_, j) => GAMMA ** j).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(noveltyReserve(firstDense, K, GAMMA) - geom) < 1e-9,
    'every step a newcomer → the full γ-geometric sum (the field mass scale)');
  assert.ok(Math.abs(noveltyReserve(firstBarren, K, GAMMA) - GAMMA ** (K - 1)) < 1e-9,
    'one ancient newcomer → just its decayed birth');
  assert.equal(noveltyReserve(firstDense, 0, GAMMA), 0, 'the cursor is exclusive — no future births count');
});

// ── PARITY: the default path is byte-identical and still BLIND (the gap stays off) ──
test('default reserve is the fixed constant — and blind to novelty rate (the GAP, off the flag)', () => {
  const M = Array.from({ length: K }, (_, j) => GAMMA ** j).reduce((a, b) => a + b, 0);
  const fixedExpected = NOVELTY_RESERVE / (M + NOVELTY_RESERVE);
  for (const sched of [dense, mid, barren]) {
    assert.ok(Math.abs(reserveOf(sched, 'fixed') - fixedExpected) < 1e-9, 'fixed mode = 1/(M+1)');
    assert.ok(Math.abs(reserveOf(sched, undefined) - fixedExpected) < 1e-9, 'OMITTED mode = fixed (default)');
  }
  // The gap: at matched mass the fixed reserve cannot tell dense from barren.
  assert.equal(reserveOf(dense, 'fixed'), reserveOf(barren, 'fixed'));
});

// ── THE CAPABILITY: signal opens the matched-mass split, monotonic in novelty rate ──
test('signal reserve is monotonic in novelty rate at matched mass (dense > mid > barren)', () => {
  const d = reserveOf(dense, 'signal'), mi = reserveOf(mid, 'signal'), b = reserveOf(barren, 'signal');
  assert.ok(d > mi && mi > b, `monotonic, got dense=${d} mid=${mi} barren=${b}`);
  assert.ok(Math.abs(d - 0.5) < 1e-9, 'a newcomer every step → reserve 0.5 (half the recent deposit was novel)');
  assert.ok(d - b > 0.1, `the split is OPEN, got Δ=${d - b}`);
});

// ── THE CONTROL: the loud surface (mass) holds under both engines, not reversed ──
test('control — mass is loud: barren-short keeps more reserve than barren-long, under fixed AND signal', () => {
  const short = ['b', 'b'], long = barren;     // both barren (rate ~0); MASS differs
  const sf = reserveOf(short, 'fixed'),  lf = reserveOf(long, 'fixed');
  const ss = reserveOf(short, 'signal'), ls = reserveOf(long, 'signal');
  assert.ok(sf > lf, `fixed: short(${sf}) > long(${lf}) — the instrument is mass-sensitive`);
  assert.ok(ss > ls, `signal: short(${ss}) > long(${ls}) — the fix did not reverse or collapse the surface relation`);
});

// ── THE OMNIMODAL GATE: a SECOND organ (music) shows the same — interior, not text ──
test('omnimodal — music: fixed is blind (dense ≈ barren), signal separates (dense > barren)', () => {
  const denseM  = ingestMusic({ name: 'm-d', notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'] });
  const barrenM = ingestMusic({ name: 'm-b', notes: ['C4', 'G4', 'C4', 'G4', 'C4', 'G4', 'B4'] });
  const at = 6;
  const rf = (doc, mode) => readingAt(doc, at, { forward: true, reserve: mode }).reserveFig;
  assert.ok(Math.abs(rf(denseM, 'fixed') - rf(barrenM, 'fixed')) < 1e-9,
    'fixed: matched figure-mass → identical reserve, the gap is interior');
  assert.ok(rf(denseM, 'signal') > rf(barrenM, 'signal') + 0.05,
    'signal: the SAME interior change separates a second sense — confirmed in two senses');
});
