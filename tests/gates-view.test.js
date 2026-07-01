import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readLogitGates, describeEvent, EVENT_STYLE, STEERING_EQUATION } from '../src/ui/gates-view.js';

// The Gates view's pure, DOM-free surface — the part CI covers without a browser (the
// same convention as predict-view's defaultCursor / log-view's argspanDesc). readLogitGates
// projects one audit turn onto the limits that governed its logits; describeEvent renders a
// live lens-port event as one tape line. The lens port itself is covered elsewhere; here we
// pin the projection so the surface never misreads the audit shape.

// A finished, lens-steered turn — the shape src/turn/pipeline.js `summarize` emits.
const steeredTurn = {
  id: 't7', question: 'who signed it?', finishedAt: 123, gated: false,
  route: 'grounded', grounding: 'auto',
  flags: [{ id: 'abstained', message: 'the text does not say', refuses: false }],
  steps: [
    { name: 'route', t: 1, data: { route: 'grounded', grounding: 'auto' } },
    { name: 'answerable', t: 5, data: { verdict: 'answer', terrain: 'void', kind: 'name' } },
    { name: 'llm', t: 40, data: { outputLen: 80, maxTokens: 384, lens: {
      events: 12, suppressed: 3, voidConflicts: 1, regrounded: 1,
      mounted: [{ god: 'Apollo', op: 'DEF', weight: 0.42, locked: false },
                { god: 'Hestia', op: 'NUL', weight: 0.9, locked: true }],
    } } },
  ],
};

test('readLogitGates reads the void-gate bite and the mounted voice off a steered turn', () => {
  const m = readLogitGates(steeredTurn);
  assert.equal(m.id, 't7');
  assert.equal(m.lensOn, true, 'lens provenance on the llm step ⇒ the logits were steered');
  assert.equal(m.reached, true);
  assert.equal(m.maxTokens, 384);
  assert.deepEqual(
    { s: m.void.suppressed, c: m.void.voidConflicts, r: m.void.regrounded },
    { s: 3, c: 1, r: 1 },
    'the void gate suppressed 3 logits, hit 1 conflict, re-grounded 1');
  assert.equal(m.voidTerrain, 'name', 'the answerable stage typed the terrain VOID·name');
  assert.equal(m.mounted.length, 2);
  assert.equal(m.mounted[1].locked, true, 'a NUL-on-VOID lock rides through');
  assert.equal(m.flags[0].refuses, false);
});

test('readLogitGates reports unconstrained logits when the lens port did not steer', () => {
  const golden = {
    id: 't8', question: 'summarize this', finishedAt: 5, flags: [],
    steps: [{ name: 'llm', t: 3, data: { outputLen: 200, maxTokens: 512 } }],   // no lens block
  };
  const m = readLogitGates(golden);
  assert.equal(m.lensOn, false, 'no lens block ⇒ the golden path decoded unconstrained');
  assert.equal(m.reached, true, 'but the decoder did run');
  assert.equal(m.void, null);
  assert.equal(m.maxTokens, 512);
});

test('readLogitGates tolerates an in-flight turn (a stage not yet reached reads null)', () => {
  const inflight = { id: 't9', question: 'what happened?', finishedAt: null, steps: [
    { name: 'route', t: 1, data: { route: 'grounded' } },
  ] };
  const m = readLogitGates(inflight);
  assert.equal(m.finished, false);
  assert.equal(m.reached, false, 'the llm stage has not run — no logits drawn yet');
  assert.equal(m.lensOn, false);
  assert.equal(readLogitGates(null), null);
});

test('describeEvent renders each logit-limit event as a distinct, honest line', () => {
  assert.match(describeEvent({ type: 'suppress', kind: 'numeral', n: 3, t: 10 }),
    /suppressed 3 numeral-shaped logits/);
  assert.match(describeEvent({ type: 'suppress', kind: 'numeral', n: 1 }), /1 numeral-shaped logit\b/,
    'singular is not pluralised');
  assert.match(describeEvent({ type: 'void-conflict', reason: 'entity-trie', surface: 'Napoleon' }),
    /Napoleon.*past the grounded entity trie/);
  assert.match(describeEvent({ type: 'rec', surface: 'grete', supported: true }), /trie widens/);
  assert.match(describeEvent({ type: 'rec', surface: 'ghost', supported: false }), /the limit holds/);
  assert.match(describeEvent({ type: 'reset' }), /return to the maximally-mixed ground/);
  // every event type the lens port emits has a presentation style
  for (const t of ['reset', 'suppress', 'void-conflict', 'rec']) assert.ok(EVENT_STYLE[t], `style for ${t}`);
  // an unknown event is never dropped
  assert.equal(describeEvent(null), '');
  assert.ok(STEERING_EQUATION.includes('void'));
});
