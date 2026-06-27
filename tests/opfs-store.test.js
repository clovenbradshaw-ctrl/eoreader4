import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRawStore, opfsAvailable } from '../src/ingest/opfs-store.js';

// The raw web-content store keeps every fetched page in full, as binary, in OPFS — and degrades
// to an in-memory cache where OPFS is absent (Node, here). These pin the fallback contract: put
// then get round-trips the text, has() reflects presence, and nothing throws.

test('OPFS is reported unavailable under Node (no navigator.storage)', () => {
  assert.equal(opfsAvailable(), false);
});

test('put/get round-trips the full text through the in-memory fallback', async () => {
  const store = createRawStore();
  const big = 'x'.repeat(500_000);                 // uncapped — the full page is retained
  const r = await store.put('fnv:abc123', big);
  assert.equal(r.bytes, 500_000);
  assert.equal(r.persisted, false, 'no OPFS in Node, so it lives in memory');
  assert.equal(await store.get('fnv:abc123'), big);
  assert.equal(await store.has('fnv:abc123'), true);
});

test('a missing key reads back null and is not present', async () => {
  const store = createRawStore();
  assert.equal(await store.get('nope'), null);
  assert.equal(await store.has('nope'), false);
});

test('put is a no-op (never throws) on a null key', async () => {
  const store = createRawStore();
  const r = await store.put(null, 'ignored');
  assert.equal(r.persisted, false);
  assert.equal(await store.has(null), false);
});
