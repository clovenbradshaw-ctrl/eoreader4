import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import '../src/model/echo.js';
import { createModel } from '../src/model/interface.js';

const setup = (text) => {
  const doc = parseText(text, { docId: 't' });
  let p = null;
  doc.sentenceEmbeddings = async (e) => {
    if (p) return p;
    p = Promise.all(doc.sentences.map(s => e.embed(s)));
    return p;
  };
  return doc;
};

test('mechanical math short-circuits the pipeline (no LLM stage runs)', async () => {
  const doc = setup('Anything.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'What is 2 + 2?',
    doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.ok(result.answer.includes('4'));
  assert.equal(result.turn.route, 'math');
  assert.equal(result.turn.steps.find(s => s.name === 'llm'), undefined);
});

test('grounded path produces an answer with citations', async () => {
  const doc = setup('Alice loves apples. Bob hates broccoli.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'apples',
    doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.ok(result.sources.length > 0);
  assert.equal(audit.turns.length, 1);
  assert.ok(result.turn.bound.some(b => b.citation), 'at least one claim must bind');
});

test('audit captures the verbatim prompt and raw output for grounded turns', async () => {
  const doc = setup('Alice loves apples. Bob hates broccoli.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  await runTurn({
    question: 'apples?',
    doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  const t = audit.turns[0];
  assert.ok(t.prompt);
  assert.ok(t.rawOutput);
  assert.ok(t.steps.find(s => s.name === 'llm'));
  assert.ok(t.steps.find(s => s.name === 'bind'));
  assert.ok(t.steps.find(s => s.name === 'veto'));
});

test('a doc question with nothing to retrieve routes to a typed VOID, never the talker', async () => {
  // Doc open, the question lands nowhere on the page. The honest response is the
  // typed absence (the answerability gate, docs/answerability.md) — NOT an ungrounded
  // chat answer, which would let the talker speak from outside the material and
  // contradicts SYSTEM_GROUND's own "if the material does not cover it, say the
  // document does not say."
  const doc = setup('Alice loves apples.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'unrelated-zebra-question',
    doc, model, embedder: { isWarm: () => false, embed: async () => new Float32Array(64), warm: async () => {} },
    auditLog: audit,
  });
  assert.equal(result.turn.route, 'void');
  assert.equal(result.sources.length, 0);
  assert.match(result.answer, /does not say/i);
  // The talker is never warmed for a measured void.
  assert.equal(result.turn.steps.find(s => s.name === 'llm'), undefined);
});

test('a whole-document summary request is never voided — it reaches the talker', async () => {
  // "summarize this" points at no location, so weak retrieval is not an absence.
  // The answerability gate must exempt whole-document tasks (docs/answerability.md).
  const doc = setup('Alice loves apples. Bob hates broccoli. Carol grows carrots. Dan dislikes dill.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'summarize this', doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.notEqual(result.turn.route, 'void');
});

test('runs without a doc — chat mode, no veto noise', async () => {
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'hello there',
    doc: null,
    model,
    embedder: createHashEmbedder(),
    auditLog: audit,
  });
  assert.equal(result.turn.route, 'chat');
  assert.equal(result.sources.length, 0);
  assert.equal(result.flags.length, 0);
  assert.ok(result.answer);
  // The model still ran — chat mode reaches the llm stage.
  assert.ok(result.turn.steps.find(s => s.name === 'llm'));
});

test('math short-circuits even without a doc', async () => {
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'What is 7 * 6?',
    doc: null,
    model,
    embedder: createHashEmbedder(),
    auditLog: audit,
  });
  assert.equal(result.turn.route, 'math');
  assert.ok(result.answer.includes('42'));
  assert.equal(result.turn.steps.find(s => s.name === 'llm'), undefined);
});

test('vetoes flag but never substitute the answer', async () => {
  const doc = setup('Alice loves apples. Bob hates broccoli.');
  // A backend that emits an obviously unbound claim — overlap < the
  // bind threshold against every span. The unbound veto must fire.
  const unboundModel = {
    id: 'unbound', kind: 'test', isLoaded: () => true,
    async load() {},
    async phrase() { return 'Zebras unrelated cosmic nonsense.'; },
  };
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'apples',
    doc, model: unboundModel, embedder: createHashEmbedder(), auditLog: audit,
  });
  const ids = result.flags.map(f => f.id);
  assert.ok(ids.includes('unbound'), `expected unbound flag, got: ${ids.join(',')}`);
  // The answer is the model's text — NOT the substitution string.
  assert.ok(!/did not produce a grounded answer/i.test(result.answer));
  assert.ok(/zebras/i.test(result.answer));
});

test('onStep callback fires once per executed stage', async () => {
  const doc = setup('Alice loves apples.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const seen = [];
  await runTurn({
    question: 'apples',
    doc, model, embedder: createHashEmbedder(), auditLog: audit,
    onStep: (name) => seen.push(name),
  });
  assert.ok(seen.includes('route'));
  assert.ok(seen.includes('llm'));
  assert.ok(seen.includes('bind'));
});

test('a greeting routes to smalltalk — never grounded, never warms the model', async () => {
  const doc = setup('Alice loves apples. Bob hates broccoli.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'hi', doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.equal(result.turn.route, 'smalltalk');
  assert.equal(result.turn.steps.find(s => s.name === 'llm'), undefined);
  assert.equal(result.sources.length, 0);
});

test('who-is is answered mechanically and resolves through the alias', async () => {
  const doc = setup('Gregor Samsa is a travelling salesman. Gregor waited. Gregor left.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'who is gregor?', doc, model, embedder: createHashEmbedder(), auditLog: audit,
  });
  assert.equal(result.turn.route, 'who');
  assert.equal(result.turn.steps.find(s => s.name === 'llm'), undefined);
  assert.ok(/salesman/i.test(result.answer));
  assert.ok(result.sources.length > 0);
});

test('audit exports JSONL one record per turn', async () => {
  const doc = setup('Alice loves apples.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  await runTurn({ question: 'What is 1 + 1?', doc, model, embedder: createHashEmbedder(), auditLog: audit });
  await runTurn({ question: 'apples',          doc, model, embedder: createHashEmbedder(), auditLog: audit });
  const lines = audit.exportJSONL().split('\n');
  assert.equal(lines.length, 2);
  for (const line of lines) {
    const obj = JSON.parse(line);
    assert.equal(obj.schema, 'eo-audit/1');
  }
});
