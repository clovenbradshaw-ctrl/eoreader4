import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { OPS, operatorProfiles, structuralHorizon, structuralCommutator } from '../src/surfer/index.js';
import { OPERATORS } from '../src/core/index.js';

// The structural significance basis: ρ built from OPERATIONS (the cube's Act face), not
// embeddings — meaning as what the operators do, not distributional company. No embedder
// is constructed anywhere in these tests; that is the point.

const STORY = 'Gregor woke transformed. His father drove him back. Grete brought milk. ' +
  'Gregor turned away. The father hurled an apple. Grete said the creature must go. ' +
  'The family felt relief. Grete had grown.';

test('operatorProfiles reads a per-unit operator vector off the log — no embedder', () => {
  const doc = parseText(STORY, { docId: 's' });
  const prof = operatorProfiles(doc);
  assert.equal(prof.length, (doc.units || doc.sentences).length);
  assert.equal(prof[0].length, OPS.length, 'one dimension per operator (the Act face)');
  // at least one unit performs at least one operation, and the totals match the log
  const total = prof.flat().reduce((a, b) => a + b, 0);
  const logOps = doc.log.snapshot().filter(e => e.sentIdx != null && OPS.includes(e.op)).length;
  assert.equal(total, logOps, 'every operator event lands in exactly one unit profile');
  assert.ok(total > 0, 'the story performs operations');
});

test('structuralHorizon reads the significance off ρ with no embedder', () => {
  const doc = parseText(STORY, { docId: 's' });
  const H = structuralHorizon(doc, { k: 3 });
  assert.ok(H.units >= 2, 'units performing operations');
  assert.ok(H.departure >= 0, 'a departure from the bare operational ground');
  assert.ok(H.lensEntropy >= 0, 'a von Neumann entropy over the operational spectrum');
  assert.ok(['Existence', 'Structure', 'Interpretation'].includes(H.tone.domain), 'the tone names a cube Domain');
  assert.ok(H.tone.mode === OPERATORS[H.tone.op].mode, 'the tone is internally cube-coherent');
});

test('the lenses are OPERATIONAL patterns (operators), not topics', () => {
  const doc = parseText(STORY, { docId: 's' });
  const H = structuralHorizon(doc, { k: 4 });
  assert.ok(H.lenses.length >= 1);
  for (const l of H.lenses) {
    assert.ok(typeof l.weight === 'number');
    for (const p of l.pattern) assert.ok(OPS.includes(p.op), 'every lens component is an operator, never a word');
  }
});

test('structuralCommutator: identical operational bases commute (~0); deterministic', () => {
  const doc = parseText(STORY, { docId: 's' });
  const prof = operatorProfiles(doc);
  const c = structuralCommutator(prof, prof);          // a basis against itself
  assert.ok(c < 1e-6, 'a basis commutes with itself');
  assert.equal(structuralCommutator(prof, prof), c, 'deterministic');
});

test('an op-less document degrades safely to a blank reading', () => {
  const H = structuralHorizon({ units: [], sentences: [], log: { snapshot: () => [] } });
  assert.equal(H.units, 0);
  assert.equal(H.departure, 0);
  assert.deepEqual(H.lenses, []);
});
