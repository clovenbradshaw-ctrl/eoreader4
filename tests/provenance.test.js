import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyProvenance } from '../src/ground/index.js';
import { parseText } from '../src/perceiver/parse/index.js';

// A response is a sequence of propositions, each with its own grounding provenance —
// verbatim (lifted), grounded (the same figures stand in the same relation a span asserts),
// or fabricated (witnessed by nothing). The judgement is propositional MEANING, not raw-span
// word overlap, so a salad that shares words with a span but asserts nothing it holds is caught.

const SPANS = [
  'Ptolemy placed Earth at the centre.',
  'Anna trusted Ben.',
  'Saving the Appearances meant fitting the data.',
];

test('the audit salad is all fabricated — word overlap with a span does not ground it', () => {
  const c = classifyProvenance('Saving the Appearances answer question. DB ID answer question.', SPANS);
  assert.equal(c.summary.fabricated, c.propositions.length, 'every proposition fabricated');
  assert.equal(c.allFabricated, true);
  assert.equal(c.anyWitnessed, false, 'nothing in it is witnessed by what was read');
});

test('a proposition lifted from a span is verbatim', () => {
  const c = classifyProvenance('Ptolemy placed Earth.', SPANS);
  assert.equal(c.propositions[0].grounding, 'verbatim');
});

test('a reworded proposition over the same two figures is grounded, not fabricated', () => {
  // same figures (Anna, Ben) related, different relation/direction than the span "Anna trusted Ben"
  const c = classifyProvenance('Ben deceived Anna.', SPANS);
  const p = c.propositions.find(x => x.via === 'deceived');
  assert.ok(p, 'a proposition was parsed');
  assert.equal(p.grounding, 'grounded', 'the same two figures in a relation is grounded, though reworded');
});

test('a proposition about figures nothing read mentions is fabricated', () => {
  const c = classifyProvenance('Ptolemy charted the comets.', SPANS);   // comets in no span
  assert.equal(c.propositions[0].grounding, 'fabricated');
});

test('judged against the doc GRAPH (coref intact), a graph-faithful answer is fully witnessed', () => {
  const doc = parseText('Gregor Samsa woke. Gregor Samsa saw Grete. Gregor Samsa trusted Grete.', { docId: 'm' });
  const faithful = classifyProvenance('Gregor Samsa saw Grete.', { doc });
  assert.equal(faithful.summary.fabricated, 0, 'an answer drawn from the graph fabricates nothing');
  const offGraph = classifyProvenance('Gregor Samsa met Klamm.', { doc });   // Klamm not in the doc
  assert.equal(offGraph.propositions.find(p => p.via === 'met')?.grounding, 'fabricated');
});

test('one response, mixed provenance — the fabricated part is isolated, the witnessed ride', () => {
  const c = classifyProvenance('Ptolemy placed Earth. Ptolemy charted the comets.', SPANS);
  const g = Object.fromEntries(c.propositions.map(p => [p.via, p.grounding]));
  assert.equal(g.placed, 'verbatim', 'the lifted proposition is verbatim');
  assert.equal(g.charted, 'fabricated', 'the invented proposition is isolated as fabricated');
  assert.equal(c.anyWitnessed, true, 'the response is not refused whole — the witnessed part stands');
});
