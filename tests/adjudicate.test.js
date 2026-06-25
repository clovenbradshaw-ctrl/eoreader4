import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/pipeline.js';
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

test('a confident contradiction GATES and regenerates (§5) — the model word still surfaces, with its flag', async () => {
  // A confident edge-contradiction (Grete as Gregor's MOTHER, sister ⟂ mother, prior ~0.85)
  // is libel-grade and, under the subjective frame, no longer rides: §5 engages the gate and
  // regenerates against the lines (the contradiction is NOT among the flag-only cases the
  // spec keeps — low-coverage, the weak contradiction, the unwitnessed). The gate regenerates,
  // it does not gag: the model's word still surfaces (a fixed test model cannot improve, so
  // the flagged draft rides, now with `gated` recorded; a real model would drop the false link).
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
  assert.equal(result.turn.gated, true, '§5: a confident contradiction engages the gate and regenerates');
  assert.match(result.answer, /mother/i, 'the model text still surfaces — regenerated, not gagged');
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1);
});

test('a contradicting paraphrase: the contradiction gates, the faint unbound-contact stays a flag', async () => {
  // The denied relation in a draft that CITES nothing but makes lexical CONTACT (it restates
  // "Grete waited" with extra material). Two readings split by §5: the confident
  // `edge-contradicted` engages the gate (it regenerates); the faint `unbound-contact` — a
  // paraphrase the binder cannot tie to one sentence — STAYS flag-only, exactly as the spec
  // keeps it (enacting a faint amplitude as certainty is the over-refusal hazard). The model
  // word still surfaces in both cases; the gate regenerates, it never substitutes.
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel("Gregor Samsa's mother Grete waited at the door."),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  const ids = result.flags.map(f => f.id);
  assert.equal(result.turn.gated, true, 'the confident contradiction engages the gate');
  assert.ok(ids.includes('unbound-contact'), 'the faint contact-but-uncitable reading stays a flag, not a gate trigger');
  assert.ok(!ids.includes('unbound'), 'the from-nowhere gate stays silent — the prose made contact');
  assert.ok(ids.includes('edge-contradicted'), 'and the contradiction is flagged on its own organ');
  assert.match(result.answer, /mother/i, 'the model text still surfaces — regenerated, not gagged');
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1, 'the contradiction is still measured and recorded');
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
