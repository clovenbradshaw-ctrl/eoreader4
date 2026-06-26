import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createModel, EXCERPTS_HEADER } from '../src/model/index.js';

// The structure backend generates from the engine's own graph — no LLM, no network. It
// reads the grounded excerpts, parses them, traverses, and realises the surface.

test('the structure backend is registered, instant, and local', async () => {
  const m = createModel('structure');
  assert.equal(m.id, 'structure');
  assert.equal(m.kind, 'local');
  assert.equal(m.isLoaded(), true);
  await m.load();   // resolves immediately
});

test('it retells the grounded excerpts as structural surface text', async () => {
  const m = createModel('structure');
  const messages = [{ role: 'user', content:
    `Q?\n\n${EXCERPTS_HEADER}\nGregor woke transformed. Grete brought milk. Gregor turned away.` }];
  const reply = await m.phrase(messages);
  assert.equal(typeof reply, 'string');
  assert.ok(reply.length > 0);
  assert.ok(/Gregor|Grete/.test(reply), 'it speaks the entities it read');
  assert.ok(reply.endsWith('.'), 'realised as sentences');
});

test('it abstains honestly when there is no structure to speak from', async () => {
  const m = createModel('structure');
  const reply = await m.phrase([{ role: 'user', content: 'hello there' }]);
  assert.match(reply, /no document structure/i, 'no excerpts → an honest void, not a fabrication');
});

test('streaming: onToken receives the surface token by token', async () => {
  const m = createModel('structure');
  const messages = [{ role: 'user', content: `${EXCERPTS_HEADER}\nGregor woke. Gregor rose.` }];
  const toks = [];
  const reply = await m.phrase(messages, { onToken: (t) => toks.push(t) });
  assert.ok(toks.length > 0, 'tokens streamed');
  assert.equal(toks.join(''), reply, 'the stream reconstructs the reply');
});
