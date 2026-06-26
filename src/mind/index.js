// The mind — eoreader's read corpus, held as memory and consulted on demand.
//
// This is the holon's whole surface. It composes a book SOURCE (the parquet),
// a STORE (OPFS in the browser, memory under test), the one-pass BUILD, and the
// index-backed RETRIEVE. Everything below is private; nothing reaches inside.
//
// Epistemic separation is the contract: the mind is a SEPARATE source the
// reader may opt into, never folded into the document under discussion. Its
// spans carry book provenance and are tagged via:'mind', so an answer that
// leans on the corpus is always distinguishable — in the citation and in the
// audit — from one grounded in the open document. Because we keep only the
// Level-1 memory (which sentence holds which token) and a URI back to the
// source, the mind grounds by existence-and-citation; the structural and
// significance readings remain document-only, which is the honest state.

import { createStore, memoryBackend, opfsBackend } from './store.js';
import { createParquetSource } from './parquet.js';
import { buildMind, DEFAULT_BUCKETS } from './build.js';
import { scoreQuery, materialize } from './retrieve.js';
import { segmentSentences } from '../perceiver/parse/index.js';

export const MIND_ID = '__mind__';

export const createMind = async ({
  url,
  source,
  store,
  buckets = DEFAULT_BUCKETS,
  segOpts = {},
} = {}) => {
  source = source || createParquetSource({ url });
  store  = store  || createStore(await opfsBackend());

  // Resolve a book's text into its sentence array, once per book — the cache
  // that keeps materialising several spans from one book to a single fetch.
  const sentCache = new Map();
  const resolveText = async (book) => {
    if (sentCache.has(book.id)) return sentCache.get(book.id);
    const sents = segmentSentences(await source.getBookText(book), segOpts);
    if (sentCache.size > 8) sentCache.delete(sentCache.keys().next().value);
    sentCache.set(book.id, sents);
    return sents;
  };

  return {
    id: MIND_ID,
    isMind: true,

    // What the UI shows: is the corpus read, how far, how much.
    async status() {
      const m = await store.manifest();
      if (!m) return { built: false, present: false, books: 0, sentences: 0 };
      return {
        present: true,
        built: !!m.built,
        books: m.books?.length || 0,
        sentences: m.totalSentences || 0,
        groupsDone: m.groupsDone ?? -1,
        groups: source.groupCount || undefined,
        signature: m.signature,
      };
    },

    // Read the corpus into memory (resumable). onProgress reports group/sentence
    // counts so the boot/UI can show honest progress rather than a fake spinner.
    async build(onProgress) { return buildMind({ source, store, buckets, onProgress }); },

    // The reading, against the index — same score as the live lexical reader,
    // with book provenance and materialised text. Returns [] until built.
    async retrieve(query, k = 6, opts = {}) {
      const m = await store.manifest();
      if (!m || m.groupsDone < 0) return [];
      const scored = await scoreQuery(store, m, query, k, opts);
      return materialize(m, scored, resolveText);
    },

    async clear() { return store.clear(); },
  };
};

export { createStore, memoryBackend } from './store.js';
export { createParquetSource } from './parquet.js';
