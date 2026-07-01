// Persist holon: corpus store + drivers + envelope + log attach/rehydrate.
// Runs under `node --test` (Node ≥ 20 — WebCrypto is global, no deps).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog } from '../src/core/log.js';
import {
  createCorpusStore, openCorpusStore,
  attachPersistence, rehydrateLog,
  plainEnvelope, passwordEnvelope, isSealed,
  memoryDriver, matrixDriver,
} from '../src/persist/index.js';

const rec = (docId, events = []) => ({ docId, modality: 'text', name: docId, source: 't', events });

test('store: put / get / list / has / remove round-trip', async () => {
  const store = createCorpusStore({ driver: memoryDriver() });
  await store.put(rec('a', [{ op: 'INS', id: 'x' }]));
  await store.put(rec('b', [{ op: 'INS', id: 'y' }, { op: 'DEF', id: 'y', key: 'k', value: 'v' }]));

  assert.equal(await store.has('a'), true);
  assert.equal(await store.has('z'), false);

  const a = await store.get('a');
  assert.equal(a.docId, 'a');
  assert.equal(a.events.length, 1);
  assert.ok(a.addedAt && a.updatedAt);

  const listed = await store.list();
  assert.deepEqual(listed.map((e) => e.docId), ['a', 'b']);
  assert.equal(listed[1].eventCount, 2);
  // list() is the light catalogue — it must not carry full event arrays
  assert.equal(listed[0].events, undefined);

  await store.remove('a');
  assert.equal(await store.has('a'), false);
  assert.equal(await store.get('a'), null);
  assert.deepEqual((await store.list()).map((e) => e.docId), ['b']);
});

test('store: appendEvents accumulates and re-put preserves addedAt', async () => {
  const store = createCorpusStore({ driver: memoryDriver() });
  const before = await store.put(rec('a', [{ op: 'INS', id: '0' }]));
  await store.appendEvents('a', [{ op: 'INS', id: '1' }, { op: 'INS', id: '2' }]);
  const a = await store.get('a');
  assert.equal(a.events.length, 3);
  assert.equal(a.addedAt, before.addedAt);   // addedAt is stable across updates
  assert.equal(a.eventCount, 3);
});

test('store: clear empties everything', async () => {
  const driver = memoryDriver();
  const store = createCorpusStore({ driver });
  await store.put(rec('a')); await store.put(rec('b'));
  await store.clear();
  assert.deepEqual(await store.list(), []);
  assert.equal((await driver.keys()).length, 0);
});

test('envelope: password seal/open round-trips and hides plaintext from the driver', async () => {
  const env = passwordEnvelope('correct horse battery staple');
  const secret = 'asylum granted 2026-05-01';
  const sealed = await env.seal(secret);
  assert.ok(isSealed(sealed));
  assert.ok(!sealed.includes('asylum'));
  assert.equal(await env.open(sealed), secret);

  // a driver behind a passwordEnvelope holds only ciphertext
  const driver = memoryDriver();
  const store = createCorpusStore({ driver, envelope: env });
  await store.put(rec('case', [{ op: 'DEF', id: 'c', key: 'status', value: 'asylum granted' }]));
  const dump = [...driver._dump().values()].join('|');
  assert.ok(!dump.includes('asylum'), 'ciphertext must not leak the payload');
  assert.ok(dump.split('|').every(isSealed), 'every stored value is sealed');
  // ...yet reads back cleanly through the store
  assert.equal((await store.get('case')).events[0].value, 'asylum granted');
});

test('envelope: wrong password fails to open', async () => {
  const sealed = await passwordEnvelope('right').seal('hi');
  await assert.rejects(() => passwordEnvelope('wrong').open(sealed));
});

test('envelope: open() passes plaintext through (encryption can be turned on later)', async () => {
  // a store written in plaintext, then read with a password envelope, must not brick
  const driver = memoryDriver();
  await createCorpusStore({ driver }).put(rec('a', [{ op: 'INS', id: '1' }]));
  const encStore = createCorpusStore({ driver, envelope: passwordEnvelope('pw') });
  const a = await encStore.get('a');
  assert.equal(a.events.length, 1);   // legacy plaintext record still readable
});

test('attach + rehydrate: a live log persists and rebuilds faithfully', async () => {
  const store = createCorpusStore({ driver: memoryDriver() });
  const log = createLog({ docId: 'doc1' });
  log.append({ op: 'INS', id: 'e0', label: 'sentence', sentIdx: 0 });

  const handle = attachPersistence(log, store, { docId: 'doc1', modality: 'text', name: 'Doc One' });
  // events appended AFTER attach
  log.append({ op: 'INS', id: 'e1', label: 'sentence', sentIdx: 1 });
  log.append({ op: 'CON', src: 'e0', tgt: 'e1', via: 'flow', sentIdx: 1 });
  await handle.flush();

  const saved = await store.get('doc1');
  assert.equal(saved.events.length, 3, 'the pre-attach event and both post-attach events are captured');
  assert.equal(saved.name, 'Doc One');

  const rebuilt = rehydrateLog(createLog, saved);
  assert.equal(rebuilt.length, 3);
  // seqs are contiguous and ops preserved
  assert.deepEqual(rebuilt.snapshot().map((e) => e.seq), [0, 1, 2]);
  assert.deepEqual(rebuilt.snapshot().map((e) => e.op), ['INS', 'INS', 'CON']);
  assert.equal(rebuilt.snapshot()[2].src, 'e0');
});

test('attach: catalogue reflects the doc for a boot-time list()', async () => {
  const store = createCorpusStore({ driver: memoryDriver() });
  const log = createLog({ docId: 'd' });
  const h = attachPersistence(log, store, { docId: 'd', modality: 'pdf', name: 'Filing.pdf' });
  log.append({ op: 'INS', id: '1' });
  await h.flush();
  const [entry] = await store.list();
  assert.equal(entry.docId, 'd');
  assert.equal(entry.modality, 'pdf');
  assert.equal(entry.name, 'Filing.pdf');
});

test('openCorpusStore: falls back to memory in Node and works end-to-end', async () => {
  const store = await openCorpusStore();   // no IndexedDB here → memory driver
  assert.equal(store.driver.kind, 'memory');
  await store.put(rec('a'));
  assert.equal((await store.list()).length, 1);
});

// The OPTIONAL Matrix backend, exercised against a fake client that mimics room
// state. Proves the same store logic runs unchanged over a Matrix room.
test('matrix driver: same contract over a fake room-state client', async () => {
  const state = new Map();   // `${type}|${stateKey}` → content
  const client = {
    async getState(_room, type, key) { return state.get(`${type}|${key}`) ?? null; },
    async setState(_room, type, key, content) { state.set(`${type}|${key}`, content); },
  };
  const driver = matrixDriver(client, { roomId: '!room:hs' });
  const store = createCorpusStore({ driver });

  await store.put(rec('a', [{ op: 'INS', id: '1' }]));
  await store.put(rec('b', [{ op: 'INS', id: '2' }]));
  assert.deepEqual((await store.list()).map((e) => e.docId).sort(), ['a', 'b']);
  assert.equal((await store.get('a')).events[0].id, '1');

  await store.remove('a');
  assert.deepEqual((await store.list()).map((e) => e.docId), ['b']);
});

test('matrix driver: rejects a client missing the contract', () => {
  assert.throws(() => matrixDriver({}, { roomId: '!r' }), /getState/);
  assert.throws(() => matrixDriver({ getState() {}, setState() {} }, {}), /roomId/);
});
