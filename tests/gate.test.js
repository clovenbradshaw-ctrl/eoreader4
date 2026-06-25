import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

// THE GATE SENTINEL (§5, docs/subjective-frame.md).
//
// Most of flag-and-tell stands: a thin, contested, or unwitnessed grounding is annotated
// beside the model's answer, never traded for it (low-coverage, edge-unsupported, the weak
// contradiction, unbound-contact). What §5 changed: under the subjective frame abstention
// is free and coherent, so a REFUSING edge-grounded veto on a pointed question's
// load-bearing claim — a from-nowhere `unbound` answer, or a confident `edge-contradicted`
// — no longer rides. It engages the GATE: the talker is regenerated against the same lines,
// and the turn is recorded `gated`.
//
// The deep invariant the gate must NEVER break: it regenerates, it does not SUBSTITUTE. No
// canned decline, no raw span swapped in — the model's own word still surfaces (with a real
// model the regenerate pulls it toward an honest "I did not find it"; a fixed test model
// cannot improve, so the flagged word rides, now with `gated` recorded). This sentinel
// guards both: the gate engages on the load-bearing case, and it never gags the talker.

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

// 1 — THE GATE. A from-nowhere answer over a pointed question ENGAGES the gate (§5): the
// turn is `gated` and the talker is regenerated. But the gate regenerates, it does not
// substitute — the model's own word still surfaces, never a canned decline.
test('a load-bearing unbound draft gates and regenerates — but the model word still rides, never a canned decline', async () => {
  const r = await run(model('Zebras orbit cosmic nonsense beyond comprehension.'));
  assert.ok(r.flags.some(f => f.id === 'unbound' && f.refuses), 'unbound is a serious-pill flag');
  assert.equal(r.turn.gated, true, '§5: a from-nowhere answer on a pointed question engages the gate');
  assert.equal(r.turn.steps.find(s => s.name === 'revise').data.attempts, 1, 'and the talker is regenerated once');
  assert.match(r.answer, /zebras/i, 'the model text still surfaces — the gate regenerates, it does not substitute');
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

// 3 — FLUENCY IS IRRELEVANT, EITHER WAY. The gate reads `bound` / `edgeVerdicts`, never the
// prose, so a terse from-nowhere draft and an eloquent one engage the gate identically — and
// the model's word surfaces in both, never swapped for a decline.
test('fluency changes nothing: terse and eloquent ungrounded prose both gate, both surface', async () => {
  const terse  = await run(model('Zebras nonsense.'));
  const florid = await run(model(
    'In a luminous and profoundly orchestrated meditation, the ineffable cosmos unfurls ' +
    'its transcendent mystery across the boundless and shimmering dark of pure being.'));
  assert.equal(terse.turn.gated,  true, 'terse from-nowhere → the gate engages');
  assert.equal(florid.turn.gated, true, 'eloquent from-nowhere → the gate engages all the same');
  assert.ok(terse.flags.some(f => f.id === 'unbound'),  'terse is flagged unbound');
  assert.ok(florid.flags.some(f => f.id === 'unbound'), 'florid is flagged unbound');
  assert.match(terse.answer,  /zebras/i,  'the terse model word still surfaces');
  assert.match(florid.answer, /luminous/i, 'the florid model word still surfaces');
});

// 4 — THE RECORD. The surfaced answer is STILL the model's draft (the gate regenerated, it
// did not swap), the gate is recorded, and the flag rides beside it — the user can see what
// was said, that the gate engaged, and what we could and couldn't ground.
test('the gated turn still surfaces the model draft, with the gate and the flag recorded beside it', async () => {
  const audit = createAuditLog();
  const r = await run(model('Zebras orbit cosmic nonsense.'), audit);
  const t = audit.turns[0];
  assert.equal(t.gated, true, 'the gate is recorded in the audit');
  assert.match(t.rawOutput, /zebras/i, 'the verbatim draft is captured');
  assert.match(t.answer, /zebras/i, 'and it IS the surfaced answer — regenerated, not replaced by a decline');
  assert.ok(t.flags.some(f => f.id === 'unbound' && f.refuses),
    'the flag rides in the record, telling the user the grounding is absent');
});

// 5 — THE GATE CLEARS. With a model that CAN answer differently on the regenerate (a real
// model handed the §5 corrective), the gate resolves: the redo grounds (or honestly
// abstains), and the unbound flag is gone. This is the gate doing its job — regenerate
// toward the lines, not ride a from-nowhere draft.
test('the gate clears when the regenerate grounds — the from-nowhere flag is gone', async () => {
  let call = 0;
  // First draft is from-nowhere; the regenerate grounds in a real span.
  const twoShot = { id: 'm', kind: 'test', isLoaded: () => true, async load() {},
    async phrase() { return call++ === 0 ? 'Zebras orbit cosmic nonsense.' : 'Alice loves apples.'; } };
  const r = await run(twoShot);
  assert.equal(r.turn.gated, true, 'the gate engaged on the first from-nowhere draft');
  assert.ok(!r.flags.some(f => f.id === 'unbound'), 'the regenerate grounded — unbound is gone');
  assert.match(r.answer, /alice loves apples/i, 'the grounded regenerate is the surfaced answer');
  assert.ok(r.sources.length > 0, 'and it cites its span');
});
