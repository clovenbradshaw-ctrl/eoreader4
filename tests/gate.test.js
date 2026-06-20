import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// THE HARD-FLOOR SENTINEL.
//
// Wiring the gate (a `gates` veto SUBSTITUTES the surfaced answer with a typed decline)
// trades the system's dark-room IMMUNITY — nothing could make the talker refuse — for a
// real refusal capacity, ON PURPOSE: surfacing ungrounded text as fact is the worse
// failure than declining. But the moment refusal substitutes, the dark room becomes
// reachable, and the bind floor (MIN_OVERLAP, the threshold `unbound` reads through)
// acquires teeth: set it too high and a legitimately grounded answer gets NUL'd.
//
// So the sentinel guards BOTH directions, plus the adversarial sibling, plus the
// suppress-not-delete invariant. Each test is the SOLE case that proves one half of the
// guarantee — without it, a regression (drop `refuse` again; let fluency vote; delete the
// draft) reads green because nothing exercises the boundary.

const setup = (text) => {
  const doc = parseText(text, { docId: 'g' });
  let p = null;
  doc.sentenceEmbeddings = async (e) => (p ??= Promise.all(doc.sentences.map(s => e.embed(s))));
  return doc;
};
const DOC   = 'Alice loves apples. Bob hates broccoli. Carol grows carrots.';
const model = (text) => ({ id: 'm', kind: 'test', isLoaded: () => true, async load() {}, async phrase() { return text; } });
const run   = (m, audit = createAuditLog()) =>
  runTurn({ question: 'apples', doc: setup(DOC), model: m, embedder: createHashEmbedder(), auditLog: audit });

// 1 — THE CATCH. A gating veto over real spans substitutes the SURFACED answer. This is
// the catch that was missing: `refuse` was computed and dropped, so the floor painted a
// pill while the ungrounded prose shipped and entered history as fact.
test('catch: an unbound draft over real spans is replaced by the decline, never surfaced', async () => {
  const r = await run(model('Zebras orbit cosmic nonsense beyond comprehension.'));
  assert.ok(r.flags.some(f => f.id === 'unbound' && f.refuses), 'unbound is a refusing veto');
  assert.equal(r.turn.gated, true, 'the floor GATES — it does not merely flag');
  assert.doesNotMatch(r.answer, /zebras/i, 'the ungrounded draft is NOT the surfaced answer');
  assert.match(r.answer, /can'?t ground/i, 'a typed decline is surfaced in its place');
  assert.equal(r.sources.length, 0);
});

// 2 — THE CALIBRATION GUARD. The regression that wiring the gate newly makes possible:
// too strict a floor NULs a legitimately grounded answer. A clearly-grounded draft must
// ride — the floor must not be so eager it refuses a real answer.
test('calibration: a well-grounded answer rides — the floor never NULs a real answer', async () => {
  const r = await run(model('Alice loves apples.'));
  assert.equal(r.turn.gated, false, 'a grounded answer is not gated');
  assert.ok(!r.flags.some(f => f.id === 'unbound'), 'unbound does not fire on a bound claim');
  assert.match(r.answer, /alice loves apples/i, 'the model text rides');
  assert.ok(r.sources.length > 0, 'and it cites its span');
});

// 3 — THE ADVERSARIAL SIBLING. The floor reads `bound` / `edgeVerdicts`, NEVER the
// draft's prose, so fluency buys nothing past it. A terse ungrounded draft and an
// arbitrarily eloquent one gate IDENTICALLY. This documents that the floor takes no
// fluency argument — so a later refactor that tries to let eloquence vote breaks here.
test('the floor takes no fluency argument: eloquent ungrounded prose gates exactly as terse does', async () => {
  const terse  = await run(model('Zebras nonsense.'));
  const florid = await run(model(
    'In a luminous and profoundly orchestrated meditation, the ineffable cosmos unfurls ' +
    'its transcendent mystery across the boundless and shimmering dark of pure being.'));
  assert.equal(terse.turn.gated,  true, 'terse ungrounded → gated');
  assert.equal(florid.turn.gated, true, 'eloquent ungrounded → gated all the same');
  assert.equal(terse.answer, florid.answer, 'identical decline — fluency changed nothing about the floor');
});

// 4 — SUPPRESS, NOT DELETE. The gated draft survives verbatim in the record — the event
// log's own SEG/retract law (core/log.js) applied to the turn: the false word is kept
// beside the truer one, never unwritten. Pinned, not assumed.
test('a gated draft is suppressed, not deleted: it survives in rawOutput and revisions', async () => {
  const audit = createAuditLog();
  await run(model('Zebras orbit cosmic nonsense.'), audit);
  const t = audit.turns[0];
  assert.equal(t.gated, true);
  assert.match(t.rawOutput, /zebras/i, 'the verbatim draft survives in rawOutput');
  assert.ok(t.revisions?.some(r => /zebras/i.test(r.draft) && r.refusedBy.includes('unbound')),
    'and in revisions, tagged with the veto that gated it');
  assert.doesNotMatch(t.answer, /zebras/i, 'while the surfaced answer is the decline');
});
