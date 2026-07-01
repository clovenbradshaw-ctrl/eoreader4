import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The reader routes a chat turn to compose / research / answer. The JUDGMENT is the model's when
// the turn is ambiguous and a model is warm; regex is kept only as the instant fast-path (explicit
// composes, plain questions) and the OFFLINE FALLBACK (no model → today's deterministic behavior).
// These tests pin that contract: the fallback mirrors the old routing, and a warm model's verdict
// wins for creation-shaped turns the whitelist can't enumerate ("draw me a mermaid diagram").
//
// The reader app is a class inlined into a browser runtime, so it can't be imported. We lift the
// self-contained routing methods out of the source and rebind them to a stub `this` — enough to
// exercise the pure control flow without React/DOM. (Same "test the inlined source" spirit as
// plaintext-render.test.js.)

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/reader/app.dc.js'), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function grab(name) {
  const re = new RegExp('\\n  (?:async )?' + name + '\\(([^)]*)\\)\\{');
  const m = src.match(re);
  assert.ok(m, 'method not found in source: ' + name);
  const isAsync = /\basync /.test(m[0]);
  let i = src.indexOf(m[0]) + m[0].length;
  let depth = 1;
  const start = i;
  for (; i < src.length && depth > 0; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return { args: m[1], body: src.slice(start, i - 1), isAsync };
}

function makeRouter({ model = null, verdict = null, shouldWeb = false } = {}) {
  const stub = {
    norm: (s) => String(s || '').replace(/\s+/g, ' ').trim(),
    _stallGuard: () => ({ race: new Promise(() => {}), signal: { aborted: false }, feed() {}, clear() {} }),
    _shouldWeb: () => shouldWeb,
    _chatModel: model,
    _ME: model ? { streamPhrase: async () => verdict } : null,
  };
  for (const n of ['_CKlit', '_CKmade', '_CK', '_CV', '_composeIntent', '_composeMode', '_composeFollowup', '_routeTurn', '_modelWantsCompose']) {
    const { args, body, isAsync } = grab(n);
    stub[n] = (isAsync ? new AsyncFunction(args, body) : new Function(args, body)).bind(stub);
  }
  return stub;
}

const chat = (msgs) => ({ messages: msgs });
const composingThread = chat([
  { role: 'user', text: 'write me an emily dickinson style poem about Drag Brunch' },
  { role: 'asst', text: 'I couldn’t find it in the sources.', compose: false },
]);

test('offline fallback: explicit and made-artifact composes route to compose', async () => {
  const r = makeRouter();
  assert.equal(await r._routeTurn('write me a poem about the sea', chat([]), []), 'compose');
  assert.equal(await r._routeTurn('write me some sample html', chat([]), []), 'compose');
  assert.equal(await r._routeTurn('make me a function that reverses a string', chat([]), []), 'compose');
});

test('offline fallback: an elided re-request in a composing thread still composes', async () => {
  const r = makeRouter();
  assert.equal(await r._routeTurn('i said write me one', composingThread, []), 'compose');
  assert.equal(await r._routeTurn('just write it', composingThread, []), 'compose');
});

test('questions, summaries, and thank-yous never route to compose', async () => {
  const r = makeRouter();
  assert.equal(await r._routeTurn('what does the article say about closures?', chat([]), []), 'answer');
  assert.equal(await r._routeTurn('summarize this', chat([]), []), 'answer');
  assert.equal(await r._routeTurn('what does line 3 mean?', composingThread, []), 'answer');
  assert.equal(await r._routeTurn('thanks!', composingThread, []), 'answer');
});

test('research routing is respected when the deterministic web-gate says so', async () => {
  const r = makeRouter({ shouldWeb: true });
  assert.equal(await r._routeTurn('what is the 2026 house race?', chat([]), []), 'research');
});

test('a warm model catches a novel artifact kind the whitelist misses', async () => {
  const yes = makeRouter({ model: {}, verdict: 'COMPOSE' });
  assert.equal(await yes._routeTurn('draw me a mermaid diagram of the auth flow', chat([]), []), 'compose');
  // and it declines a grounded write-up, leaving it on the answer/research path
  const no = makeRouter({ model: {}, verdict: 'OTHER' });
  assert.equal(await no._routeTurn('write up the findings from the article', chat([]), []), 'answer');
});

test('_modelWantsCompose returns null (→ regex fallback) with no warm model', async () => {
  const r = makeRouter();
  assert.equal(await r._modelWantsCompose('write me one', composingThread), null);
});
