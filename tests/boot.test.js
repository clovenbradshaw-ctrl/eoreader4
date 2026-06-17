import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createInstaller, STAGES } from '../src/boot/index.js';

const yieldTo = () => Promise.resolve();
const validBundle = { meta: { model: 't', construction: 'clause', dim: 4 }, vectors: { 'CON_Binding_Link': [1, 0, 0, 0] } };

// A MiniLM-like organ: measures meaning, warms (reporting progress), embeds.
const meaningEmbedder = () => {
  const s = { warmCalls: 0 };
  return {
    id: 'minilm', measuresMeaning: true, isWarm: () => true,
    async warm(cb) { s.warmCalls++; cb?.({ loaded: 1, total: 2 }); cb?.({ loaded: 2, total: 2 }); },
    async embed() { return Float32Array.from([1, 0, 0, 0]); },
    s,
  };
};

const liveClassifier = () => ({ classify: async () => ({ live: true, pattern: { cell: 'CON_Binding_Link' } }) });
const makeLive = () => liveClassifier();

test('STAGES are the five boot stages in order', () => {
  assert.deepEqual([...STAGES], ['clearing', 'instruments', 'centroids', 'warming', 'ready']);
});

test('all instruments online → geometric reader live, every stage done', async () => {
  const inst = createInstaller({
    embedder: meaningEmbedder(),
    loadCells: async () => ({ CON_Binding_Link: {} }),
    loadCentroids: async () => validBundle,
    makeClassifier: makeLive,
    yieldTo,
  });
  const st = await inst.run();
  assert.equal(st.geometricReader, 'live');
  for (const s of STAGES) assert.equal(st.stages[s], 'done', s);
  assert.match(st.detail, /live/);
  assert.ok(st.classifier);
});

test('no centroids → honest degrade, not a throw and not a fake checkmark', async () => {
  const inst = createInstaller({
    embedder: meaningEmbedder(),
    loadCentroids: async () => null,             // unfetchable / not installed
    makeClassifier: () => ({ classify: async () => ({ live: false }) }),
    yieldTo,
  });
  const st = await inst.run();
  assert.equal(st.geometricReader, 'unavailable');
  assert.equal(st.stages.instruments, 'done');
  assert.equal(st.stages.centroids, 'failed');
  assert.equal(st.stages.warming, 'skipped');
  assert.equal(st.stages.ready, 'done');         // resolves — never hangs
  assert.match(st.detail, /no-commit/);
  assert.match(st.detail, /centroids/);
});

test('the hash organ cannot become the geometric reader', async () => {
  const inst = createInstaller({
    embedder: { id: 'hash-embed', measuresMeaning: false, async warm() {}, async embed() { return []; } },
    loadCentroids: async () => validBundle,
    makeClassifier: () => ({ classify: async () => ({ live: false }) }),
    yieldTo,
  });
  const st = await inst.run();
  assert.equal(st.stages.instruments, 'skipped');
  assert.equal(st.geometricReader, 'unavailable');
  assert.match(st.detail, /hash organ/);
});

test('an instruments failure degrades instead of throwing', async () => {
  const inst = createInstaller({
    embedder: { id: 'minilm', measuresMeaning: true, async warm() { throw new Error('offline'); }, async embed() { return []; } },
    loadCentroids: async () => validBundle,
    makeClassifier: () => ({ classify: async () => ({ live: false }) }),
    yieldTo,
  });
  const st = await inst.run();          // does not reject
  assert.equal(st.stages.instruments, 'failed');
  assert.equal(st.geometricReader, 'unavailable');
  assert.match(st.detail, /MiniLM weights/);
});

test('install is idempotent — one boot, one download', async () => {
  const calls = { centroids: 0 };
  const embedder = meaningEmbedder();
  const inst = createInstaller({
    embedder,
    loadCentroids: async () => { calls.centroids++; return validBundle; },
    makeClassifier: makeLive,
    yieldTo,
  });
  await inst.run();
  await inst.run();           // second call must not re-run the stages
  assert.equal(calls.centroids, 1);
  assert.equal(embedder.s.warmCalls, 1);
});

test('skipInstruments declines the heavy download when no instrument is installed', async () => {
  const embedder = meaningEmbedder();
  const inst = createInstaller({
    embedder,
    loadCentroids: async () => null,        // nothing to measure against
    makeClassifier: () => ({ classify: async () => ({ live: false }) }),
    yieldTo,
  });
  const st = await inst.run({ skipInstruments: true });
  assert.equal(embedder.s.warmCalls, 0, 'MiniLM is not downloaded for an unavailable reader');
  assert.equal(st.stages.instruments, 'skipped');
  assert.equal(st.geometricReader, 'unavailable');
  assert.match(st.detail, /centroids/);     // the named root cause, not the weights
});

test('subscribers observe progress and the terminal state (non-blocking)', async () => {
  const seen = [];
  const inst = createInstaller({
    embedder: meaningEmbedder(),
    loadCentroids: async () => validBundle,
    makeClassifier: makeLive,
    yieldTo,
  });
  const unsub = inst.subscribe((st) => seen.push(st));
  await inst.run();
  unsub();
  assert.ok(seen.length > STAGES.length, 'state emitted on each transition');
  assert.ok(seen.some(s => s.progress > 0), 'download progress surfaced');
  assert.equal(seen.at(-1).stages.ready, 'done');
});
