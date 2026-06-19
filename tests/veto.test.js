import { test } from 'node:test';
import assert from 'node:assert/strict';

import { runVetoes, groundingFloor, GROUNDING_FLOOR } from '../src/ground/veto.js';

// The coverage veto's floor is a per-task grounding prior, not one flat 0.5:
// a direct answer must be tightly grounded, a summary tolerates connective
// claims with no single witnessing sentence.

test('groundingFloor is a calibrated per-task prior, defaulting to the old 0.5', () => {
  assert.equal(groundingFloor('answer'),  0.5);   // a direct answer — strict, unchanged
  assert.equal(groundingFloor('list'),    0.5);
  assert.ok(groundingFloor('summary') < groundingFloor('answer'));  // synthesis tolerates less
  assert.ok(groundingFloor('explain') < groundingFloor('answer'));
  assert.equal(groundingFloor(undefined), GROUNDING_FLOOR.answer);  // no task → the default floor
});

test('the same coverage flags a direct answer but not a summary', () => {
  // Five claims, two tied to a source → 0.4 coverage.
  const bound = [
    { claim: 'a', citation: 's0' }, { claim: 'b', citation: 's1' },
    { claim: 'c', citation: null }, { claim: 'd', citation: null }, { claim: 'e', citation: null },
  ];
  const base = { draft: 'x', question: 'q', bound };

  // 0.4 < 0.5 → a direct answer is under-grounded and flags (flag-only, never refuses).
  const direct = runVetoes({ ...base, task: 'answer' });
  assert.ok(direct.fired.some(f => f.id === 'low-coverage' && !f.refuses));
  assert.equal(direct.refuse, false);

  // 0.4 ≥ 0.34 → the same answer, asked as a summary, is acceptably grounded.
  const summary = runVetoes({ ...base, task: 'summary' });
  assert.ok(!summary.fired.some(f => f.id === 'low-coverage'));
});
