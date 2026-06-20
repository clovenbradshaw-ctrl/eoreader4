import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// THE FLAG-AND-TELL SENTINEL.
//
// We trust the talker to answer, and we ALWAYS surface what it said. A veto is an
// annotation that rides alongside the answer — telling the user (and the audit) where the
// grounding is thin, contested, or absent — never a trade for it. There is no hard floor:
// nothing here substitutes a canned decline or a raw span for the model's words. Surfacing
// the answer the model wanted to give, with the caveats attached, IS the safety; hiding it
// behind a refusal was the old span-extractive reflex, now retired.
//
// This sentinel guards that no regression re-wires a gate: an ungrounded draft must ride
// with its flag, never disappear.

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

// 1 — THE SURFACE. An ungrounded draft over real spans is SHOWN, with a flag, never swapped
// for a decline. The model's word is the answer; the flag is the addition that tells the user
// it couldn't be tied to the page.
test('surface: an unbound draft rides with its flag — the model word is never substituted', async () => {
  const r = await run(model('Zebras orbit cosmic nonsense beyond comprehension.'));
  assert.ok(r.flags.some(f => f.id === 'unbound' && f.refuses), 'unbound is a serious-pill flag');
  assert.equal(r.turn.gated, false, 'nothing gates — the answer is not traded for a decline');
  assert.match(r.answer, /zebras/i, 'the model text IS the surfaced answer');
  assert.doesNotMatch(r.answer, /can'?t ground|do(?:n'?t| not) have/i, 'no canned decline is shipped in its place');
  assert.equal(r.sources.length, 0, 'it cites nothing — honestly, the flag says so');
});

// 2 — THE GROUNDED CASE. A clearly-grounded answer rides too, and earns its citation. The
// flag-and-tell rule must not cost a real answer its grounding.
test('a well-grounded answer rides and cites its span', async () => {
  const r = await run(model('Alice loves apples.'));
  assert.equal(r.turn.gated, false);
  assert.ok(!r.flags.some(f => f.id === 'unbound'), 'unbound does not fire on a bound claim');
  assert.match(r.answer, /alice loves apples/i, 'the model text rides');
  assert.ok(r.sources.length > 0, 'and it cites its span');
});

// 3 — FLUENCY IS IRRELEVANT, EITHER WAY. The veto reads `bound` / `edgeVerdicts`, never the
// prose, so a terse ungrounded draft and an eloquent one are flagged identically — and BOTH
// ride. (The old sentinel proved they gated identically; now it proves they surface identically.)
test('fluency changes nothing: terse and eloquent ungrounded prose both ride, both flagged', async () => {
  const terse  = await run(model('Zebras nonsense.'));
  const florid = await run(model(
    'In a luminous and profoundly orchestrated meditation, the ineffable cosmos unfurls ' +
    'its transcendent mystery across the boundless and shimmering dark of pure being.'));
  assert.equal(terse.turn.gated,  false, 'terse ungrounded → surfaced, flagged');
  assert.equal(florid.turn.gated, false, 'eloquent ungrounded → surfaced, flagged all the same');
  assert.ok(terse.flags.some(f => f.id === 'unbound'),  'terse is flagged unbound');
  assert.ok(florid.flags.some(f => f.id === 'unbound'), 'florid is flagged unbound');
  assert.match(terse.answer,  /zebras/i,  'the terse model word rides');
  assert.match(florid.answer, /luminous/i, 'the florid model word rides');
});

// 4 — THE RECORD. The surfaced answer IS the model's draft (nothing swapped), and the flag
// is recorded in the audit beside it — the user can see what was said and what we could and
// couldn't ground.
test('the surfaced answer is the verbatim draft, with the flag recorded beside it', async () => {
  const audit = createAuditLog();
  const r = await run(model('Zebras orbit cosmic nonsense.'), audit);
  const t = audit.turns[0];
  assert.equal(t.gated, false);
  assert.match(t.rawOutput, /zebras/i, 'the verbatim draft is captured');
  assert.match(t.answer, /zebras/i, 'and it IS the surfaced answer — not replaced');
  assert.ok(t.flags.some(f => f.id === 'unbound' && f.refuses),
    'the flag rides in the record, telling the user the grounding is absent');
});
