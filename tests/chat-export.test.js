import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTranscriptText, buildFullAuditText } from '../src/ui/chat-export.js';

// The chat-window export, two flavours. The builders are pure (data → string),
// so the formatting is pinned here without the DOM or a download.

test('text-only transcript renders each message under a speaker heading', () => {
  const history = [
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'Paris.' },
  ];
  const out = buildTranscriptText(history, { exportedAt: '2026-06-28' });
  assert.match(out, /# eoreader4 — chat transcript/);
  assert.match(out, /## You\nWhat is the capital of France\?/);
  assert.match(out, /## Assistant\nParis\./);
});

test('text-only transcript skips empty messages and notes an empty window', () => {
  assert.match(buildTranscriptText([], {}), /no messages yet/);
  const out = buildTranscriptText([{ role: 'user', content: '' }, { role: 'assistant', content: 'Hi' }], {});
  assert.doesNotMatch(out, /## You/);
  assert.match(out, /## Assistant\nHi/);
});

test('full audit lays out the prompting and surfing for a turn', () => {
  const turns = [{
    question: 'Who wrote it?',
    answer: 'Kafka wrote it [s2].',
    route: 'grounded',
    durationMs: 1234,
    grounding: 'auto',
    steps: [{ name: 'retrieve', t: 12, data: { spans: 3 } }, { name: 'llm', t: 800, data: { ms: 700 } }],
    reading: {
      spans: [{ idx: 2, via: 'lexical', score: 0.8, text: 'Franz Kafka wrote The Metamorphosis.' }],
      surf: { peak: 1, stops: [3], recCursors: [], rode: 'figure', field: [
        { idx: 1, focus: 'Kafka', bayes: 0.9, surprisalBits: 2.1 },
        { idx: 3, bayes: 0.2, surprisalBits: 0.4 },
      ] },
      note: 'The passage names Kafka as the author.',
    },
    prompt: 'SYSTEM: ground every claim.\nUSER: Who wrote it?',
    rawOutput: 'Kafka wrote it.',
    bound: [{ claim: 'Kafka wrote it', citation: 's2' }],
    vetoes: [],
    flags: [{ id: 'low-coverage', message: 'partial' }],
  }];
  const out = buildFullAuditText(turns, { exportedAt: '2026-06-28' });
  assert.match(out, /## Turn 1 · route: grounded · 1234ms · grounding: auto/);
  assert.match(out, /### You\nWho wrote it\?/);
  assert.match(out, /### Assistant\nKafka wrote it \[s2\]\./);
  assert.match(out, /### Pipeline/);
  assert.match(out, /\*\*retrieve\*\* spans=3/);
  assert.match(out, /### Reading \(surfing\)/);
  assert.match(out, /\[s2\] lexical \(score 0\.8\): Franz Kafka wrote/);
  assert.match(out, /★ c1 Kafka · bayes 0\.9 · surprise 2\.1 bits/);
  assert.match(out, /• c3/);
  assert.match(out, /### Prompt sent to the model/);
  assert.match(out, /SYSTEM: ground every claim\./);
  assert.match(out, /### Raw model output/);
  assert.match(out, /### Bound claims/);
  assert.match(out, /### Flags\n- low-coverage — partial/);
});

test('full audit omits blocks a plain chat turn lacks', () => {
  const turns = [{ question: 'hi', answer: 'hello', route: 'chat', steps: [] }];
  const out = buildFullAuditText(turns, {});
  assert.match(out, /### Assistant\nhello/);
  assert.doesNotMatch(out, /### Prompt sent to the model/);
  assert.doesNotMatch(out, /### Reading/);
});

test('full audit notes an empty log', () => {
  assert.match(buildFullAuditText([], {}), /no turns recorded yet/);
});

test('fenced blocks neutralize a triple-backtick in model output', () => {
  const turns = [{ question: 'q', answer: 'a', route: 'chat', rawOutput: 'see ```code``` here' }];
  const out = buildFullAuditText(turns, {});
  // The literal ``` inside the content must not close our fence.
  assert.doesNotMatch(out, /\n```code```\n/);
});
