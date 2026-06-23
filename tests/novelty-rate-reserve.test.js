import { test } from 'node:test';
import assert from 'node:assert/strict';

import { forwardDist, noveltyAmplitude } from '../src/core/surprise.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// REGRESSION LOCK — cycle-001-novelty-reserve (experiments/cycle-001-novelty-reserve/).
//
// Capability: the reserve the reader holds for an unseen atom tracks the RECENT NOVELTY RATE
// (high after a burst of newcomers, low after a confirmation run), as the gamma-decayed count
// of first-appearances (noveltyAmplitude) carried through the UNCHANGED forwardDist (the law).
// Context enters at the amplitude; the Born step is fixed. Confirmed in TWO senses (interior).
//
// This lock is flag-INDEPENDENT: it exercises the interior functions directly and the wired
// reading path via the explicit `signalReserve` opt, so it stays green on the default suite and
// fails the day the mechanism, the control, the two-sense property, or the wiring changes.

const γ = 0.7, now = 8;
// Every step deposits exactly one unit, so the total gamma-mass at the probe is IDENTICAL
// across conditions — the loud surface signal (mass) is held flat by construction.
const fieldOf = (firstSeenSteps, occursAt) => {
  const profile = new Map(), firstSeen = new Map();
  for (const [atom, steps] of Object.entries(occursAt)) {
    for (const s of steps) profile.set(atom, (profile.get(atom) || 0) + Math.pow(γ, now - 1 - s));
    firstSeen.set(atom, firstSeenSteps[atom]);
  }
  return { profile, firstSeen };
};

// RECENT: a base atom confirmed at 0..4, three newcomers at 5,6,7.
// EARLY:  three newcomers at 0,1,2, a base atom confirmed at 3..7.
// CONFIRM: one atom at 0, confirmed 1..7.  (RECENT & EARLY share distinct-count = 4.)
const conds = (b, x, y, z) => ({
  RECENT:  fieldOf({ [b]:0, [x]:5, [y]:6, [z]:7 }, { [b]:[0,1,2,3,4], [x]:[5], [y]:[6], [z]:[7] }),
  EARLY:   fieldOf({ [x]:0, [y]:1, [z]:2, [b]:3 }, { [x]:[0], [y]:[1], [z]:[2], [b]:[3,4,5,6,7] }),
  CONFIRM: fieldOf({ [b]:0 },                      { [b]:[0,1,2,3,4,5,6,7] }),
});
const reserve = (cell, novelty) => forwardDist(cell.profile, { novelty }).reserve;
const nu = (cell) => noveltyAmplitude(cell.firstSeen, now, { gamma: γ });

test('the CONSTANT reserve is flat across recent/early/confirm (mass alone is blind) — the control', () => {
  const c = conds('f:see', 'f:a', 'f:b', 'f:c');
  // Total mass identical, so the constant-novelty reserve is identical — it CANNOT discriminate.
  const r = (k) => reserve(c[k], 1.0);
  assert.ok(Math.abs(r('RECENT') - r('EARLY')) < 1e-9 && Math.abs(r('EARLY') - r('CONFIRM')) < 1e-9,
    `constant reserve flat: ${r('RECENT')}, ${r('EARLY')}, ${r('CONFIRM')}`);
});

test('the TRACKED amplitude orders recent > early > confirm through the SAME law', () => {
  const c = conds('f:see', 'f:a', 'f:b', 'f:c');
  const r = (k) => reserve(c[k], nu(c[k]));
  assert.ok(r('RECENT') > r('EARLY'), `recent ${r('RECENT')} > early ${r('EARLY')}`);
  assert.ok(r('EARLY') > r('CONFIRM'), `early ${r('EARLY')} > confirm ${r('CONFIRM')}`);
});

test('recency, not cumulative count: recent and early share distinct-count yet recent reserves more', () => {
  const c = conds('f:see', 'f:a', 'f:b', 'f:c');
  assert.equal(c.RECENT.firstSeen.size, c.EARLY.firstSeen.size, 'recent and early matched on distinct count');
  assert.ok(reserve(c.RECENT, nu(c.RECENT)) > reserve(c.EARLY, nu(c.EARLY)),
    'with count held equal, the recent burst still reserves more — the difference is recency');
});

test('INTERIOR (two senses): the same law and helper order tonal-pitch atoms the same way', () => {
  // A different front-end map — pitch-bin atoms instead of proposition atoms — through the SAME
  // forwardDist/noveltyAmplitude. If the ordering replicates, the property is interior, not text.
  const c = conds('tone:220', 'tone:277', 'tone:330', 'tone:392');
  const r = (k) => reserve(c[k], nu(c[k]));
  assert.ok(r('RECENT') > r('EARLY') && r('EARLY') > r('CONFIRM'),
    `tonal basis: recent ${r('RECENT')} > early ${r('EARLY')} > confirm ${r('CONFIRM')}`);
});

test('absolute continuity: the amplitude is > 0 for any non-empty prior, 0 only at the opening', () => {
  assert.equal(noveltyAmplitude(new Map(), now, { gamma: γ }), 0, 'the opening (no prior) has nothing to learn from');
  assert.ok(noveltyAmplitude(new Map([['x', now - 1]]), now, { gamma: γ }) > 0, 'one prior atom keeps the reserve positive (KL finite)');
});

test('WIRING: readingAt reserve is flat without the opt and recency-ordered with it', () => {
  // Two reorderings of the SAME atoms — identical total mass. Without the signal reserve the
  // forward reserve is identical (blind); with it, the recent ordering reserves more.
  const RECENT = parseText('Ada Long spoke. Ada paused. Ada Long spoke. Ada paused. Ben Cole came. Cara Mell ran. Dax Pell sat.', { docId: 'rec' });
  const EARLY  = parseText('Ben Cole came. Cara Mell ran. Dax Pell sat. Ada Long spoke. Ada paused. Ada Long spoke. Ada paused.', { docId: 'erl' });
  const at = (d) => (d.units || d.sentences).length - 1;
  const res = (d, on) => readingAt(d, at(d), { forward: true, signalReserve: on }).pNext.reserve;

  assert.ok(Math.abs(res(RECENT, false) - res(EARLY, false)) < 1e-9,
    `OFF: reserve blind to order (${res(RECENT, false)} = ${res(EARLY, false)})`);
  assert.ok(res(RECENT, true) > res(EARLY, true),
    `ON: recent reserves more (${res(RECENT, true)} > ${res(EARLY, true)})`);
});

test('the constant-reserve path reproduces the byte-identical golden (the shipped, flag-off path)', () => {
  // The capability is OFF by default. signalReserve:false pins the SAME branch a default
  // (no-opt, env-off) call takes, so this guard is env-robust and reproduces the pinned surprise
  // golden (tests/surprise.test.js). The 649 existing tests independently guard the no-opt path.
  const doc = parseText('Ada Long spoke. Ada Long spoke. Ben Cole arrived. Ben Cole spoke. Cara Dove entered. Cara Dove spoke.', { docId: 'gold' });
  const r = readingAt(doc, 2, { signalReserve: false });
  assert.deepEqual([r.surprisalBits, r.bayesBits], [1.43, 0.2], 'a newcomer — exact golden, constant-reserve path unchanged');
});
