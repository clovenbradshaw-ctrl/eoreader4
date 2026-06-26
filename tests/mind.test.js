import { test } from 'node:test';
import assert from 'node:assert/strict';

import { segmentSentences, tokSet } from '../src/perceiver/parse/index.js';
import { retrieveLexical } from '../src/retrieve/lexical.js';
import { createStore, memoryBackend } from '../src/mind/store.js';
import { buildMind } from '../src/mind/build.js';
import { scoreQuery, materialize } from '../src/mind/retrieve.js';
import { createMind } from '../src/mind/index.js';

// A synthetic two-group corpus. Each "book" is a short text; segmentation and
// tokenisation go through the SAME functions the live reader uses, which is the
// whole basis of the equivalence below.
const BOOKS = [
  { text_id: 11, title: 'Metamorphosis', authors: 'Kafka', group: 0, row: 0,
    text: 'Gregor Samsa woke transformed into an insect. His sister Grete brought milk. The father drove Gregor back into the room.' },
  { text_id: 12, title: 'The Trial', authors: 'Kafka', group: 0, row: 1,
    text: 'Someone must have slandered Josef K. He was arrested one morning. The court was a strange machine.' },
  { text_id: 13, title: 'Walden', authors: 'Thoreau', group: 1, row: 2,
    text: 'I went to the woods to live deliberately. The pond was deep and clear. Solitude is a companion.' },
];

// A fake book source mirroring the parquet source's surface, with no network.
const fakeSource = (books) => {
  const groups = [...new Set(books.map(b => b.group))].sort((a, b) => a - b);
  return {
    groupCount: groups.length,
    async signature() { return { etag: 'fake-1', size: 999, rows: books.length }; },
    async *groups() {
      for (const g of groups) yield { group: g, books: books.filter(b => b.group === g) };
    },
    async getBookText(book) { return books.find(b => b.id === book.text_id || b.text_id === book.id)?.text || ''; },
  };
};

// The reference: one flat doc whose sentence axis is every book's sentences
// concatenated in build order. gid in the mind == index in this doc, so the
// per-sentence scores must match exactly.
const referenceDoc = (books) => {
  const sentences = [];
  for (const b of books) for (const s of segmentSentences(b.text, {})) sentences.push(s);
  return { sentences, tokensBySentence: sentences.map(tokSet), log: { filter: () => [] } };
};

const buildToMemory = async (books = BOOKS) => {
  const store = createStore(memoryBackend());
  await buildMind({ source: fakeSource(books), store, buckets: 8 });
  return store;
};

for (const query of ['gregor', 'sister milk', 'court machine', 'pond woods solitude', 'gregr', 'nonexistentword']) {
  test(`mind score reproduces retrieveLexical exactly — "${query}"`, async () => {
    const store = await buildToMemory();
    const man = await store.manifest();

    const ref = referenceDoc(BOOKS);
    const refScores = new Map(retrieveLexical(ref, query, 999).map(r => [r.idx, r.score]));
    const mindScores = new Map((await scoreQuery(store, man, query, 999)).map(r => [r.gid, r.score]));

    assert.deepEqual([...mindScores.keys()].sort((a, b) => a - b),
                     [...refScores.keys()].sort((a, b) => a - b),
                     'the same sentences score above zero');
    for (const [idx, s] of refScores)
      assert.ok(Math.abs((mindScores.get(idx) ?? -1) - s) < 1e-9, `score for sentence ${idx} matches (${s})`);
  });
}

test('build is resumable — a second pass over the same signature adds nothing', async () => {
  const store = await buildToMemory();
  const before = await store.manifest();
  await buildMind({ source: fakeSource(BOOKS), store, buckets: 8 });   // resume
  const after = await store.manifest();
  assert.equal(after.totalSentences, before.totalSentences);
  assert.equal(after.books.length, before.books.length);
});

test('a changed signature rebuilds from scratch', async () => {
  const store = await buildToMemory();
  const changed = BOOKS.map(b => ({ ...b }));
  // Different signature via a fresh source whose signature differs.
  const src = fakeSource(changed);
  src.signature = async () => ({ etag: 'fake-2', size: 1000, rows: changed.length });
  await buildMind({ source: src, store, buckets: 8 });
  const m = await store.manifest();
  assert.equal(m.signature.etag, 'fake-2');
});

test('materialised spans carry book provenance and the real line', async () => {
  const store = await buildToMemory();
  const man = await store.manifest();
  const src = fakeSource(BOOKS);
  const resolve = async (book) => segmentSentences(await src.getBookText(book), {});
  const scored = await scoreQuery(store, man, 'sister milk', 6);
  const spans = await materialize(man, scored, resolve);
  assert.ok(spans.length > 0, 'a span is materialised');
  const top = spans[0];
  assert.equal(top.via, 'mind');
  assert.match(top.text, /sister|milk/i, 'the materialised text is the real cited line');
  assert.ok(top.book && top.book.title && top.book.uri, 'provenance: title + URI present');
  assert.match(top.book.uri, /gutenberg\.org\/ebooks\//, 'the URI points back to the source');
});

test('createMind end-to-end: build then retrieve with provenance', async () => {
  const store = createStore(memoryBackend());
  const mind = await createMind({ source: fakeSource(BOOKS), store, buckets: 8 });
  assert.equal((await mind.status()).built, false);
  await mind.build();
  const st = await mind.status();
  assert.equal(st.built, true);
  assert.ok(st.sentences > 0 && st.books === 3);

  const spans = await mind.retrieve('gregor sister', 5);
  assert.ok(spans.length > 0);
  assert.ok(spans.every(s => s.via === 'mind' && s.book?.uri));
  assert.equal((await mind.retrieve('', 5)).length, 0, 'empty query retrieves nothing');
});
