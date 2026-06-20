import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// The talker may answer from its own memory; the turn does not gate what it says. The
// safety is downstream: the factcheck stage contrasts the talker's propositional
// assertions against the document graph and labels them. A claim the graph DENIES is
// flagged (the libel-grade catch); the model's words still ride — flag-and-tell. This
// was a built-but-dead holon (factcheck/correspond.js) until it was wired into the
// turn between `bind` and `veto`.

// The document establishes Grete as Gregor's SISTER (an apposition: "His sister Grete").
const STORY =
  'Grete arrived. Grete waited. Gregor Samsa woke. Gregor stood. ' +
  'His sister Grete left. Klaus Berg arrived.';

// A talker that answers from memory with a claim NOT in the document — and one the
// graph denies: it calls Grete his MOTHER (sister ⟂ mother is a disjoint axiom).
const memoryModel = (text) => ({
  id: 'memory', kind: 'test', isLoaded: () => true,
  async load() {}, async phrase() { return text; },
});

test('the factcheck stage runs in a grounded turn', async () => {
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel('Grete is a character in the story.'),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.ok(result.turn.steps.find(s => s.name === 'factcheck'),
    'factcheck sits in the live pipeline, after bind and before veto');
});

test('a GROUNDED claim the graph denies is flagged and RIDES — flag-and-tell on its real domain', async () => {
  // The rider edge-contradicted exists to protect: an answer that GROUNDS (claim 1
  // "Grete waited." binds s1) yet contains a contradicted relation (Grete as Gregor's
  // MOTHER, sister ⟂ mother). The contradiction is a fallible MEASUREMENT — the talker
  // may speak from memory — so it is flagged, not gated, and the model text is surfaced.
  // (The old fixture here used an UNGROUNDED contradiction, which conflated this case
  // with the structural floor; the next test pins that case separately.)
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel("Grete waited. Gregor Samsa's mother Grete stood."),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  const ids = result.flags.map(f => f.id);
  assert.ok(ids.includes('edge-contradicted'),
    `expected an edge-contradicted flag, got: ${ids.join(',') || '(none)'}`);
  assert.ok(!ids.includes('unbound'), 'the answer grounds (claim 1 binds) — the structural floor stays silent');
  assert.equal(result.turn.gated, false, 'a grounded contradiction is NOT gated — it rides');
  assert.match(result.answer, /mother/i, 'the model text is surfaced with the flag, not gagged');
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1);
});

test('an UNGROUNDED claim that also contradicts gates on the structural floor — but the measurement survives', async () => {
  // The same denied relation, but with NOTHING bound. Now the STRUCTURAL floor (unbound)
  // gates — ungrounded prose does not surface as fact — even though the claim also
  // contradicts. The gate is about grounding, not the contradiction: the contradiction is
  // still measured and recorded (factcheck contradicted=1), and the draft is suppressed-
  // not-deleted (kept in revisions). The gate erases no signal.
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel("Gregor Samsa's mother Grete waited at the door."),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.equal(result.turn.gated, true, 'nothing bound → the structural floor gates');
  assert.doesNotMatch(result.answer, /mother/i, 'the ungrounded prose is not surfaced');
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1, 'the contradiction is still measured and recorded — the gate erased nothing');
  assert.ok(result.turn.revisions?.some(r => /mother/i.test(r.draft)), 'and the gated draft survives in revisions');
});

test('a from-memory claim consistent with the graph draws no contradiction flag', async () => {
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    // Grete IS his sister — the graph does not deny this.
    doc, model: memoryModel('Grete is his sister and she left.'),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.ok(!result.flags.map(f => f.id).includes('edge-contradicted'),
    'a claim the graph corroborates is not contradicted');
});

test('chat mode (no document) runs no factcheck and raises no edge flags', async () => {
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'hello there',
    doc: null, model: memoryModel('Hi!'),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.equal(result.turn.route, 'chat');
  assert.ok(!result.flags.map(f => f.id).includes('edge-contradicted'),
    'no document, nothing to contrast against — the adjudicator stays inert');
});
