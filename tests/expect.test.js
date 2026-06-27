import { test } from 'node:test';
import assert from 'node:assert/strict';

import { expectAnswer, answerSlotError, isProperName, SLOT } from '../src/turn/expect.js';
import { runVetoes } from '../src/ground/veto.js';
import { stages } from '../src/turn/stages.js';
import { parseText } from '../src/perceiver/parse/index.js';

// The question read as a PREDICTION of its own answer (docs/answer-expectation.md). A good
// answer is the one that fills the slot the question opened; a "what is her name?" answered
// with no name leaves the prediction error standing — and the engine should catch that,
// stop, and begin again, visibly.

// ── The prediction: the question types its answer ────────────────────────────

test('a name question predicts a high-precision, gating slot', () => {
  for (const q of ['what is her name?', "what's his name", 'what is the name of the clerk',
                   'what is she called?', 'what are they called']) {
    const e = expectAnswer(q);
    assert.equal(e.slot, SLOT.NAME, `“${q}” should type a NAME slot`);
    assert.ok(e.gates, 'a name slot is precise enough to gate a restart');
    assert.ok(e.precision >= 0.8);
  }
});

test('a who question is detected but does not gate (a role-only answer can be acceptable)', () => {
  const e = expectAnswer('who is his sister?');
  assert.equal(e.slot, SLOT.WHO);
  assert.equal(e.gates, false);
});

test('a summary or open question types no shape — byte-identical default', () => {
  for (const q of ['summarize', 'sumarize', 'what is this about?', 'why did he leave?',
                   'what is a chrysalis?', 'list the characters']) {
    const e = expectAnswer(q);
    assert.equal(e.slot, SLOT.OPEN, `“${q}” must not be typed as a name lookup`);
    assert.equal(e.gates, false);
    assert.equal(e.precision, 0);
  }
});

test('a proper name is told from a description', () => {
  assert.ok(isProperName('Grete'));
  assert.ok(isProperName('Gregor Samsa'));
  assert.ok(!isProperName('his sister'));
  assert.ok(!isProperName('the chief clerk'));
  assert.ok(!isProperName('her'));
});

// ── The error signal: did the answer fill the slot? ──────────────────────────

test('a name slot fires when the reading knows the name but the answer withholds it', () => {
  const expect = expectAnswer('what is her name?');
  const referent = { id: 1, label: 'Grete' };
  // The t3 failure: a fluent description that never gives the name.
  const miss = answerSlotError(expect, 'Gregor’s sister is a kind and caring person.', { referent });
  assert.ok(miss, 'a description in place of a name is a miss');
  assert.equal(miss.slot, SLOT.NAME);
  assert.equal(miss.expectedName, 'Grete');

  // The answer that gives the resolved name fills the slot.
  assert.equal(answerSlotError(expect, 'Her name is Grete.', { referent }), null);
  assert.equal(answerSlotError(expect, 'She is called Grete Samsa.', { referent }), null);
});

test('an honest abstention fills the slot — the typed gap is the correct terminal', () => {
  const expect = expectAnswer('what is her name?');
  const referent = { id: 1, label: 'Grete' };
  assert.equal(answerSlotError(expect, 'I did not find her name in what I read.', { referent }), null);
  assert.equal(answerSlotError(expect, 'The document does not say.', { referent }), null);
});

test('with no resolved name, an answer that names no admitted figure still fires', () => {
  const doc = parseText('His sister Grete brought him fresh milk. Gregor watched her leave.', { docId: 'a' });
  const expect = expectAnswer('what is her name?');
  // names nobody → dodged the question
  assert.ok(answerSlotError(expect, 'She is gentle and patient.', { doc }));
  // names an admitted figure → satisfies the (weaker) no-resolution check
  assert.equal(answerSlotError(expect, 'Her name is Grete.', { doc }), null);
});

test('a non-gating expectation never produces a shape error', () => {
  assert.equal(answerSlotError(expectAnswer('summarize'), 'anything at all', { doc: null }), null);
  assert.equal(answerSlotError(expectAnswer('who is his sister?'), 'a description', { doc: null }), null);
});

// ── The residual flag: an unmet slot is told, not hidden ─────────────────────

test('the veto battery flags an unmet name slot, and clears once it is filled', () => {
  const referent = { id: 1, label: 'Grete' };
  const shapeError = answerSlotError(expectAnswer('what is her name?'),
    'Gregor’s sister is a kind and caring person.', { referent });
  const flagged = runVetoes({ draft: 'Gregor’s sister is a kind and caring person.',
    bound: [], question: 'what is her name?', task: 'answer', shapeError });
  assert.ok(flagged.fired.some(f => f.id === 'answer-shape' && f.refuses), 'the unmet slot is a serious flag');

  // No shapeError (the answer gave the name) → no answer-shape flag; battery unchanged.
  const clean = runVetoes({ draft: 'Her name is Grete.', bound: [{ claim: 'Her name is Grete.', citation: 's0' }],
    question: 'what is her name?', task: 'answer', shapeError: null });
  assert.ok(!clean.fired.some(f => f.id === 'answer-shape'));
});

// ── The loop: start, stop when off, begin again — visibly ────────────────────

test('revise catches a name miss, restarts, and records the superseded draft beside its reason', async () => {
  const doc = parseText('His sister Grete brought him fresh milk. Gregor watched her leave.', { docId: 'a' });
  const spans = [{ idx: 0, text: 'His sister Grete brought him fresh milk.', score: 1, via: 'lex' }];
  // A model that, asked again with the name-seeking corrective, finally gives the name.
  const model = { phrase: async () => 'Her name is Grete.' };

  const ctx = {
    question: 'what is her name?',
    expectation: expectAnswer('what is her name?'),
    refTarget: { id: 1, label: 'Grete' },     // the reading resolved her name (coref fold)
    doc, spans, model, task: 'answer', history: [],
    rawOutput: 'Gregor’s sister is a kind and caring person.',   // the first draft — a miss
    bound: [], edgeVerdicts: [],
  };

  const out = await stages.revise(ctx);
  assert.equal(out.revised.attempts, 1, 'it stopped and answered again once');
  assert.ok(out.revised.resolved, 'the restart filled the slot');
  assert.equal(out.revisions.length, 1);
  const r = out.revisions[0];
  assert.match(r.draft, /kind and caring/, 'the superseded draft is preserved verbatim');
  assert.match(r.replacedBy, /Grete/, 'the truer answer names her');
  assert.match(r.why, /name/i, 'the trail records WHY it began again');
  assert.match(out.answer, /Grete/, 'the answer the user sees gives the name');
});

test('revise is byte-identical (a no-op) when the answer already fills the slot', async () => {
  const doc = parseText('His sister Grete brought him fresh milk.', { docId: 'a' });
  const spans = [{ idx: 0, text: 'His sister Grete brought him fresh milk.', score: 1, via: 'lex' }];
  let called = 0;
  const model = { phrase: async () => { called++; return 'unused'; } };
  const ctx = {
    question: 'what is her name?', expectation: expectAnswer('what is her name?'),
    refTarget: { id: 1, label: 'Grete' }, doc, spans, model, task: 'answer', history: [],
    rawOutput: 'Her name is Grete.', bound: [{ claim: 'Her name is Grete.', citation: 's0' }],
    edgeVerdicts: [],
  };
  const out = await stages.revise(ctx);
  assert.equal(called, 0, 'no restart — the answer already gave the name');
  assert.equal(out, ctx, 'the context passes through untouched');
});
