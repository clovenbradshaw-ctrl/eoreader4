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

test('empty retrieval terminates with a chat fallback', async () => {
  const doc = setup('Alice loves apples.');
  const model = createModel('echo');
  await model.load();
  const audit = createAuditLog();
  const result = await runTurn({
    question: 'unrelated-zebra-question',
    doc, model, embedder: { isWarm: () => false, embed: async () => new Float32Array(64), warm: async () => {} },
    auditLog: audit,
  });
  assert.equal(result.turn.route, 'chat');
  assert.equal(result.sources.length, 0);
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
