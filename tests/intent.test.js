import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readTask, taskOf, TASK_MAX_TOKENS } from '../src/turn/intent.js';

// ---------------------------------------------------------------------------
// The task register (docs/prompt-assembly.md, "The task register"). Read off the
// question mechanically — no model — to set the prompt register and the token ceiling.

test('the summary words route to the summary task', () => {
  for (const q of [
    'summarize the document', 'summarise this', 'give me a summary',
    'tldr', 'tl;dr please', 'recap', 'what is the gist', 'an overview please',
  ]) assert.equal(readTask(q), 'summary', q);
});

test('the whole-document IDENTITY question routes to summary, not a pointed lookup', () => {
  for (const q of [
    'what is this about', 'what is this mainly about', "what's it about",
    'what is this document?', 'what is this document about?',
    'what is this text', 'what is this story about',
    'what is this?', 'what is this',          // the bare identity question
  ]) assert.equal(readTask(q), 'summary', q);
});

test('pointed "what is this X" lookups are NOT swallowed by the summary route', () => {
  for (const q of [
    'what is this word?', 'what is this number', "what is this character's name?",
    'what is this place called', 'what is this made of',
  ]) assert.notEqual(readTask(q), 'summary', q);
});

test('list and explain route on their own cues, and default is answer', () => {
  assert.equal(readTask('list every character'), 'list');
  assert.equal(readTask('what are the themes'), 'list');
  assert.equal(readTask('explain the ending'), 'explain');
  assert.equal(readTask('why did he leave'), 'explain');
  assert.equal(readTask('who is Gregor'), 'answer');
  assert.equal(readTask('what does he turn into'), 'answer');
  assert.equal(readTask('what happened to him'), 'answer');
});

test('taskOf carries the per-task token ceiling — the real length bound', () => {
  assert.deepEqual(taskOf('summarize this'), { task: 'summary', maxTokens: TASK_MAX_TOKENS.summary });
  assert.deepEqual(taskOf('what is this document?'), { task: 'summary', maxTokens: TASK_MAX_TOKENS.summary });
  assert.deepEqual(taskOf('who is Gregor'), { task: 'answer', maxTokens: TASK_MAX_TOKENS.answer });
});
