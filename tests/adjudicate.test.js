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

test('a contradicting claim that makes lexical CONTACT rides, flagged — the lexical floor does not over-refuse a paraphrase, and the contradiction is still measured', async () => {
  // The denied relation again, in a draft that CITES nothing (no claim clears MIN_OVERLAP)
  // but DOES make lexical contact with a span — it restates "Grete waited" with extra
  // material. Under the floor's re-typing (docs/grounding-floor.md) the lexical gate
  // substitutes only the from-nowhere LIMIT — prose with no contact at all. A paraphrase
  // that made contact but could not cite is a FAINT reading: it rides, flagged
  // (`unbound-contact`), never substituted — enacting a faint amplitude as certainty is the
  // over-refusal hazard, and a contradiction about real figures necessarily NAMES them, so
  // it is never truly "from nowhere". The contradiction is the right organ for the false
  // relation: it is independently measured (contradicted=1) and flagged (`edge-contradicted`),
  // flag-and-tell. The lexical floor erases no signal by declining to gate.
  const doc = parseText(STORY, { docId: 'adj' });
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'Tell me about Grete.',
    doc, model: memoryModel("Gregor Samsa's mother Grete waited at the door."),
    embedder: createHashEmbedder(), auditLog: audit,
  });
  const ids = result.flags.map(f => f.id);
  assert.equal(result.turn.gated, false, 'a contacting paraphrase is NOT substituted — the over-refusal guard holds');
  assert.ok(ids.includes('unbound-contact'), 'it flags as contact-but-uncitable (a faint reading), not the from-nowhere gate');
  assert.ok(!ids.includes('unbound'), 'the from-nowhere gate stays silent — the prose made contact');
  assert.ok(ids.includes('edge-contradicted'), 'and the contradiction is flagged on its own organ — flag-and-tell');
  assert.match(result.answer, /mother/i, 'the model text rides with its flags, not gagged');
  const fc = result.turn.steps.find(s => s.name === 'factcheck');
  assert.equal(fc.data.contradicted, 1, 'the contradiction is still measured and recorded — declining to gate erased nothing');
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
