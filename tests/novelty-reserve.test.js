import { test } from 'node:test';
import assert from 'node:assert/strict';

import { noveltyRate, surpriseAt, forwardDist, NOVELTY_RESERVE } from '../src/core/surprise.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// REGRESSION LOCK for the confirmed capability "novelty-reserve as a signal"
// (lab/exp/P001-novelty-reserve). The reserve amplitude the significance/forward Born step
// uses should track the recent RATE of newcomers, not accumulated mass. This file pins:
//   1. the core primitive's contract (first-appearance, γ-decayed, recency-weighted);
//   2. flag OFF → byte-identical (the constant reserve — the parity precondition);
//   3. flag ON → the dissociation: novel-rich < confirm-rich at matched mass (the GAP the
//      constant cannot see), and recent < stale (the CONTROL — γ-recency, not diversity/mass);
//   4. the gap precondition: under the constant the SAME stimuli collapse (equal), so the lock
//      fails the day the constant secretly starts tracking novelty OR the rate path stops.
//
// It is written to break if the reserve is reverted to a constant, if the recency control is
// lost, or if the flag-off path drifts — including the control condition, per the campaign.

const m = (obj) => new Map(Object.entries(obj));
const S = (...xs) => new Set(xs);
const probeIdx = (units) => units.length;       // the probe is the unit after the stream
const read = (units, opts) => {
  const doc = parseText(units.join(' '), { docId: 't' });
  return readingAt(doc, units.length, opts).bayesBits;   // bayes at the appended probe line
};

// --- 1. the core primitive ---------------------------------------------------
test('noveltyRate: γ-decayed FIRST-appearance rate, recency-weighted, repeats counted once', () => {
  assert.equal(noveltyRate([], { gamma: 0.7 }), 0, 'the empty opening reserves nothing (caller keeps the constant there)');
  assert.equal(noveltyRate([S('a')], { gamma: 0.7 }), 1, 'a lone newcomer at the cursor weighs γ^0 = 1');
  // a repeat is not a newcomer: only the FIRST appearance of "a" counts.
  assert.equal(round(noveltyRate([S('a'), S('a'), S('a')], { gamma: 0.7 })), 0.49, 'γ^2 — first appearance only');
  // recency: one newcomer arriving recently outweighs the same newcomer arriving long ago
  // (everything else confirmation/empty), because the kernel decays the stale one.
  const recent = noveltyRate([S(), S(), S(), S('a')], { gamma: 0.7 });   // a at step 3 (cursor-adjacent) → γ^0 = 1
  const stale  = noveltyRate([S('a'), S(), S(), S()], { gamma: 0.7 });   // a at step 0 (decayed) → γ^3 = 0.343
  assert.ok(recent > stale, `recent newcomer outweighs a stale one (${recent} > ${stale})`);
});

// --- 2. flag OFF is byte-identical (the constant reserve) --------------------
test('flag OFF: the reserve is the constant — reading is byte-identical', () => {
  const a = surpriseAt(m({ x: 2 }), m({ y: 1 }), { gamma: 0.7 });
  const b = surpriseAt(m({ x: 2 }), m({ y: 1 }), { gamma: 0.7, novelty: NOVELTY_RESERVE });
  assert.equal(a.bayesBits, b.bayesBits, 'surpriseAt defaults to the constant');
  // The production reader, default opts, is unchanged (the parity gate proper is the full suite).
  const novel = ['Ada Vale arrived.', 'Ben Cole arrived.', 'Cid Dorn arrived.', 'Eve Frey arrived.', 'Gus Holt arrived.', 'Ivy Knox arrived.'];
  const confirm = ['Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.'];
  assert.equal(read([...novel, 'Rex Wynn arrived.']), read([...confirm, 'Rex Wynn arrived.']),
    'THE GAP: at matched mass the constant reserve cannot tell novel-rich from confirm-rich');
});

// --- 3 & 4. flag ON dissociates where the constant is blind ------------------
test('flag ON: novel-rich < confirm-rich at matched mass (the gap closed)', () => {
  const probe = 'Rex Wynn arrived.';
  const novel = ['Ada Vale arrived.', 'Ben Cole arrived.', 'Cid Dorn arrived.', 'Eve Frey arrived.', 'Gus Holt arrived.', 'Ivy Knox arrived.', probe];
  const confirm = ['Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', 'Ada Vale waited.', probe];
  const nv = read(novel, { rulesRev: true });
  const cf = read(confirm, { rulesRev: true });
  assert.ok(nv < cf * 0.7, `novel-rich newcomer surprises far less (${nv} ≪ ${cf})`);
  // and the constant is blind to exactly this contrast (the precondition the lock guards).
  assert.equal(read(novel), read(confirm), 'the constant collapses the same contrast');
});

test('flag ON control: recent novelty < stale novelty (γ-recency, not diversity or mass)', () => {
  const probe = 'Rex Wynn arrived.';
  // matched diversity (4 figures) and ~matched mass; only the TIMING of the newcomers differs.
  const recent = ['Gus Holt waited.', 'Gus Holt waited.', 'Gus Holt waited.', 'Ada Vale arrived.', 'Ben Cole arrived.', 'Cid Dorn arrived.', probe];
  const stale  = ['Gus Holt waited.', 'Ada Vale arrived.', 'Ben Cole arrived.', 'Cid Dorn arrived.', 'Gus Holt waited.', 'Gus Holt waited.', probe];
  const rc = read(recent, { rulesRev: true });
  const st = read(stale, { rulesRev: true });
  assert.ok(rc < st, `a newcomer after RECENT newcomers surprises less than after stale ones (${rc} < ${st})`);
  // the control is loud on the surface: the constant sees matched mass/diversity and collapses it.
  assert.equal(read(recent), read(stale), 'the constant reserve is blind to recency — the surface is caught here');
});

// forwardDist carries the same signal-derived reserve through the SAME law.
test('forwardDist: the open reserve rises with the novelty amplitude (same Born step)', () => {
  const profile = m({ 'f:a': 3, 'f:b': 1 });
  const lo = forwardDist(profile, { novelty: 0.2 }).reserve;   // low novelty rate → little reserved for the unseen
  const hi = forwardDist(profile, { novelty: 3.0 }).reserve;   // high novelty rate → much reserved
  assert.ok(hi > lo, `more recent novelty reserves more probability for the unseen (${hi} > ${lo})`);
});

const round = (x) => Math.round(x * 100) / 100;
