import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGroundedMessages, orientationLine, EXCERPTS_HEADER,
} from '../src/model/prompt.js';
import { serializeNotes } from '../src/read/index.js';
import { parseText } from '../src/parse/index.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import '../src/model/echo.js';
import { createModel } from '../src/model/interface.js';

// ---------------------------------------------------------------------------
// Orientation without recognition (§3).

test('orientation is filename · type · length — never a title or author', () => {
  assert.equal(orientationLine({ filename: 'pg5200.txt', type: 'text', length: 757 }),
    'pg5200.txt · text · 757 sentences');
});

// ---------------------------------------------------------------------------
// The notes register — plain-language arrows over the folded graph (§3).

test('serializeNotes renders plain-language arrows, never codes or indices', () => {
  const structure = {
    relations: [
      { src: { id: 'sister', label: 'sister' }, tgt: { id: 'gregor', label: 'Gregor' }, via: 'tends', idx: 330 },
      { src: { id: 'fire', label: 'fire' },     tgt: { id: 'room4', label: 'room4' },   via: 'originated in', idx: 7 },
    ],
    defs: [{ id: 'gregor', label: 'Gregor', value: 'a travelling salesman', idx: 1 }],
  };
  assert.deepEqual(serializeNotes(structure), [
    'sister --tends--> Gregor',
    'fire --originated-in--> room4',   // multi-word relation hyphenated into one label
    'Gregor: a travelling salesman',
  ]);
});

// ---------------------------------------------------------------------------
// The contract: notes PLUS excerpts, two registers (§2).

test('the grounded prompt feeds notes plus excerpts, the orientation, and the budget', () => {
  const spans = [
    { idx: 3, text: 'Topps slammed the man to the ground.' },
    { idx: 7, text: 'The fire started in room four.' },
  ];
  const notes = 'sister --tends--> Gregor\nTopps --slammed--> man';
  const [system, user] = buildGroundedMessages({
    question: 'what happened?', spans, notes,
    orientation: 'pg5200.txt · text · 757 sentences',
  });
  assert.equal(system.role, 'system');
  // both document registers present
  assert.match(user.content, /Notes from the document:/);
  assert.match(user.content, /sister --tends--> Gregor/);
  assert.match(user.content, new RegExp(EXCERPTS_HEADER));
  assert.match(user.content, /Topps slammed the man to the ground\./);
  // the live exchange, orientation (no recognition), and the reply budget
  assert.match(user.content, /User: what happened\?/);
  assert.match(user.content, /You are reading pg5200\.txt/);
  assert.match(user.content, /Reply in at most 3 sentences\./);
});

test('the surface discipline holds across the whole prompt: no indices, codes, or citation tags', () => {
  const spans = [{ idx: 42, text: 'A verbatim sentence.' }];
  const [, user] = buildGroundedMessages({
    question: 'q', spans, notes: 'a --binds--> b', orientation: 'f · text · 9 sentences',
  });
  assert.doesNotMatch(user.content, /\[s\d+\]/, 'no sentence-index or citation tags');
  assert.doesNotMatch(user.content, /\b(CON|SEG|SIG|SYN|REC|DEF|EVA|INS|NUL)\b/, 'no operator codes');
});

test('absent conversation slots are simply omitted; present ones ride', () => {
  const [, withConv] = buildGroundedMessages({
    question: 'q', spans: [{ idx: 0, text: 'x' }],
    conversation: { notes: 'you --asked-about--> Gregor', pastTurns: ['who is Gregor?'] },
  });
  assert.match(withConv.content, /Notes about our conversation before this:/);
  assert.match(withConv.content, /Relevant parts of our past conversation:/);

  const [, noConv] = buildGroundedMessages({ question: 'q', spans: [{ idx: 0, text: 'x' }] });
  assert.doesNotMatch(noConv.content, /our conversation before this/);
});

// ---------------------------------------------------------------------------
// The bug fix, end to end: the fold reaches the prompt (§1).

test('a grounded turn feeds the fold into the prompt — notes plus excerpts, no indices leak', async () => {
  const text = 'Gregor Samsa loved Grete Samsa. Gregor Samsa loved Grete Samsa. Grete Samsa helped Gregor Samsa.';
  const doc = parseText(text, { docId: 'pg5200.txt' });
  doc.sentenceEmbeddings = async (e) => Promise.all(doc.sentences.map(s => e.embed(s)));
  const model = createModel('echo'); await model.load();
  const audit = createAuditLog();

  const result = await runTurn({
    question: 'what happens to Gregor?', doc, model,
    embedder: createHashEmbedder(), auditLog: audit,
  });
  const t = audit.turns[0];
  assert.equal(t.route, 'grounded');
  assert.match(t.prompt, /You are reading pg5200\.txt/, 'orientation, the filename not a title');
  assert.match(t.prompt, /Notes from the document:/, 'the fold reached the prompt (not discarded)');
  assert.match(t.prompt, /Gregor Samsa --\S+--> Grete Samsa/, 'the structured reading is the arrows');
  assert.match(t.prompt, new RegExp(EXCERPTS_HEADER), 'the verbatim excerpts ride alongside');
  // The data the talker READS — the notes and excerpts (the user turn) — carries
  // no index. (The system rule may name [s0] to forbid the talker writing it.)
  const userTurn = t.prompt.slice(t.prompt.indexOf('\n\nuser: ') + 8);
  assert.doesNotMatch(userTurn, /\[s\d+\]/, 'the talker never sees a sentence index in the material');
  // binding still works off the spans array, so citations are still produced
  assert.ok(result.sources.length > 0, 'the grounder still cites mechanically');
});
