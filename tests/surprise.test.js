import { test } from 'node:test';
import assert from 'node:assert/strict';

import { surpriseAt, NOVELTY_RESERVE } from '../src/read/surprise.js';

// The modality-agnostic surprise core (Track A, docs/spec-one-surprise.md). The TEXT
// path's byte-identical behaviour is pinned by tests/bayes.test.js, which now runs THROUGH
// this core; these pin the core's OWN contract directly, on an abstract basis (arbitrary
// atom keys), so a later modality (music/phasepost) pointed at it has a fixed target.

const m = (obj) => new Map(Object.entries(obj));

test('an opening — and a first atom with no prior — falls to exactly zero (the reserve self-zeroes)', () => {
  // Nothing arrived, nothing to move belief against.
  assert.equal(surpriseAt(new Map(), new Map(), { gamma: 0.7 }).bayesBits, 0);
  // The very first arrival has no prior to diverge from → exactly zero, the honest opening
  // (the reserve atom sits in both prior and posterior and cancels). No infinite name-snow.
  assert.equal(surpriseAt(new Map(), m({ 'f:a': 1 }), { gamma: 0.7 }).bayesBits, 0);
});

test('a newcomer against an established prior moves belief a FINITE positive amount', () => {
  const { bayesBits, bayesBy } = surpriseAt(m({ 'f:a': 3 }), m({ 'f:b': 1 }), {
    gamma: 0.7, axisLabel: (k) => k.slice(2),
  });
  assert.ok(Number.isFinite(bayesBits) && bayesBits > 0, `finite positive, got ${bayesBits}`);
  assert.ok(bayesBy.b > 0 && !('a' in bayesBy),
    'belief moved TOWARD the newcomer b, not the decaying incumbent a');
});

test('KL is clamped ≥ 0; bayesBy renders axes via the callback and keeps only positive moves', () => {
  const { bayesBits, bayesBy } = surpriseAt(
    m({ 'f:a': 2, 'f:b': 1 }),
    m({ 'f:b': 1, 'p:a|loves|b': 1 }),          // confirm b, plus a new proposition
    { gamma: 0.7, axisLabel: (k) => k.toUpperCase() });
  assert.ok(bayesBits >= 0);
  assert.ok(Object.keys(bayesBy).length > 0 && Object.keys(bayesBy).every(k => k === k.toUpperCase()),
    'axis labels are produced by the front-end callback, not the core');
  assert.ok(Object.values(bayesBy).every(v => v > 0), 'only the dimensions belief moved toward are recorded');
});

test('novelty defaults to the reserve constant', () => {
  const a = surpriseAt(m({ x: 2 }), m({ y: 1 }), { gamma: 0.7 });
  const b = surpriseAt(m({ x: 2 }), m({ y: 1 }), { gamma: 0.7, novelty: NOVELTY_RESERVE });
  assert.equal(a.bayesBits, b.bayesBits);
});
