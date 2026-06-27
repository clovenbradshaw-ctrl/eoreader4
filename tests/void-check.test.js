import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assessKnowledgeVoid, parseVerdict, voidCheckPrompt } from '../src/turn/void-check.js';

// A mock model whose phrase() returns a fixed string — lets us drive the verdict without a backend.
const sayingModel = (reply) => ({ phrase: async () => reply });

// ── parseVerdict — tolerant of surrounding prose, strict on the booleans ──────
test('parseVerdict reads the first JSON object and coerces non-booleans to false', () => {
  assert.deepEqual(
    parseVerdict('{"current": true, "timeSensitive": false, "reason": "a famous novel"}'),
    { current: true, timeSensitive: false, reason: 'a famous novel' });
  // Wrapped in prose — still found.
  assert.deepEqual(
    parseVerdict('Sure: {"current": false, "timeSensitive": true, "reason": "weather"} — hope that helps'),
    { current: false, timeSensitive: true, reason: 'weather' });
  // Missing / non-boolean fields default to false.
  assert.deepEqual(parseVerdict('{"reason":"unsure"}'), { current: false, timeSensitive: false, reason: 'unsure' });
  // No JSON at all → null (the caller treats null as "unsure").
  assert.equal(parseVerdict('I think so?'), null);
  assert.equal(parseVerdict(''), null);
});

// ── voidCheckPrompt — the dated question is built, no model needed ─────────────
test('voidCheckPrompt dates the question and includes the prior answer', () => {
  const msgs = voidCheckPrompt({ question: 'weather in NYC?', answer: 'It is sunny.', today: '2026-06-27' });
  const user = msgs.find(m => m.role === 'user').content;
  assert.match(user, /Today's date is 2026-06-27/);
  assert.match(user, /weather in NYC\?/);
  assert.match(user, /It is sunny\./);
  assert.ok(msgs.some(m => m.role === 'system'));
});

// ── assessKnowledgeVoid — confident vs stale vs time-sensitive ────────────────
test('a confident, timeless answer does NOT need the web', async () => {
  const v = await assessKnowledgeVoid(
    sayingModel('{"current": true, "timeSensitive": false, "reason": "a classic novel"}'),
    { question: 'who is gregor samsa?', answer: 'A character in Kafka.', today: '2026-06-27' });
  assert.equal(v.needsWeb, false);
  assert.equal(v.current, true);
});

test('a time-sensitive answer needs the web even if the model thinks it is current', async () => {
  const v = await assessKnowledgeVoid(
    sayingModel('{"current": true, "timeSensitive": true, "reason": "weather changes daily"}'),
    { question: 'weather in NYC today?', answer: 'It is sunny.', today: '2026-06-27' });
  assert.equal(v.needsWeb, true, 'time-sensitive ⇒ reach for live data regardless of current');
});

test('a stale answer (current=false) needs the web', async () => {
  const v = await assessKnowledgeVoid(
    sayingModel('{"current": false, "timeSensitive": false, "reason": "after my cutoff"}'),
    { question: 'who won the 2026 election?', today: '2026-06-27' });
  assert.equal(v.needsWeb, true);
});

// ── Defensive: any failure falls to needsWeb=true (reach for the witness) ──────
test('a missing model, an error, or an unparsable reply all default to needing the web', async () => {
  assert.equal((await assessKnowledgeVoid(null, { question: 'q' })).needsWeb, true);
  assert.equal((await assessKnowledgeVoid({}, { question: 'q' })).needsWeb, true, 'no phrase() ⇒ unsure');
  assert.equal((await assessKnowledgeVoid({ phrase: async () => 'no json here' }, { question: 'q' })).needsWeb, true);
  const boom = { phrase: async () => { throw new Error('decode failed'); } };
  assert.equal((await assessKnowledgeVoid(boom, { question: 'q' })).needsWeb, true);
  // An empty question is not assessable.
  assert.equal((await assessKnowledgeVoid(sayingModel('{"current":true}'), { question: '  ' })).needsWeb, true);
});
