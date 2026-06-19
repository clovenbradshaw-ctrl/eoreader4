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

test('a from-memory claim the graph DENIES is flagged, and the answer still rides', async () => {
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel("Gregor Samsa's mother Grete waited at the door."),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  // The contradiction is caught against the graph — embedder-free, via the symbolic
  // kinship algebra (sister ⟂ mother), so it fires under the hash organ too.
  const ids = result.flags.map(f => f.id);
  assert.ok(ids.includes('edge-contradicted'),
    `expected an edge-contradicted flag, got: ${ids.join(',') || '(none)'}`);
  // Flag-and-tell: the model's own words are NOT substituted or suppressed.
  assert.ok(/mother/i.test(result.answer),
    'the answer is the model text, surfaced with the flag — not gagged');
  // The audit records the verdict count for the turn.
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1);
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
