// Building the mind — reading the corpus once, keeping only the memory of it.
//
// We stream the corpus one row group at a time (a few hundred books), and for
// each book run the SAME segmentation and the SAME tokenizer the live reader
// uses (segmentSentences, tok). That identity is the whole point: a posting
// here is admissible exactly when the lexical reader would have seen the token
// in that sentence, so the mind's retrieval reproduces the reader's score
// bit-for-bit (retrieve.js proves it). The book's text is then discarded — what
// survives is the inverted index and the book's source URI.
//
// The build is RESUMABLE. Each group's postings are flushed to their own shard
// files and the manifest cursor advances; an interrupted load resumes at the
// first group not yet flushed. Nothing is ever rewritten, so a crash mid-flush
// loses at most the group in flight, never the corpus already read.

import { segmentSentences } from '../perceiver/parse/index.js';
import { tok }              from '../perceiver/parse/index.js';
import { bucketOf }         from './store.js';

export const DEFAULT_BUCKETS = 64;

// The canonical, human-followable source for a Project Gutenberg text. The
// memory points HERE — the reader can always open the book the mind read.
export const gutenbergURI = (textId) => `https://www.gutenberg.org/ebooks/${textId}`;

// Fold one book into the in-flight group accumulator. Returns the book's
// table row (no text — only what it takes to find and cite the book later).
const foldBook = (book, sentBase, postingsByBucket, vocab, buckets) => {
  const sentences = segmentSentences(book.text || '', book.segOpts || {});
  for (let i = 0; i < sentences.length; i++) {
    const gid = sentBase + i;
    // tokSet, but we want the set of distinct tokens this sentence holds.
    const seen = new Set(tok(sentences[i]));
    for (const t of seen) {
      vocab.add(t);
      const b = bucketOf(t, buckets);
      let shard = postingsByBucket.get(b);
      if (!shard) { shard = Object.create(null); postingsByBucket.set(b, shard); }
      (shard[t] || (shard[t] = [])).push(gid);
    }
  }
  return {
    id: book.text_id,
    title: book.title || '',
    authors: book.authors || '',
    subjects: book.subjects || '',
    locc: book.locc || '',
    uri: book.uri || gutenbergURI(book.text_id),
    row: book.row,                      // where to re-read the text from the source
    group: book.group,
    base: sentBase,
    count: sentences.length,
  };
};

// Build (or resume building) the mind from a book source into a store.
//   source : { signature(), groups() -> async iterable of { group, books: [...] } }
//   onProgress({ group, groups, books, sentences, phase })
export const buildMind = async ({ source, store, buckets = DEFAULT_BUCKETS, onProgress } = {}) => {
  const sig = await source.signature();
  let man = await store.manifest();

  // A signature mismatch means the corpus changed under us — start clean. A
  // match means resume: keep the books read so far and the cursor.
  const matches = man && man.signature && man.signature.etag === sig.etag && man.signature.size === sig.size;
  if (!matches) {
    await store.clear();
    man = { version: 1, signature: sig, buckets, books: [], totalSentences: 0, groupsDone: -1, built: false };
    await store.writeManifest(man);
  }
  buckets = man.buckets;

  const vocab = new Set(await store.vocab());
  let sentBase = man.totalSentences;
  const books = man.books;

  for await (const { group, books: groupBooks } of source.groups()) {
    if (group <= man.groupsDone) continue;            // already flushed — resume past it

    const postingsByBucket = new Map();               // bucket → { token: [gid,…] } for THIS group
    for (const book of groupBooks) {
      const row = foldBook({ ...book, group }, sentBase, postingsByBucket, vocab, buckets);
      books.push(row);
      sentBase += row.count;
      onProgress?.({ group, groups: source.groupCount, books: books.length, sentences: sentBase, phase: 'read' });
    }

    // Flush this group's shards (only the buckets it touched), then advance the
    // cursor and persist the table+vocab. Order matters: shards first, manifest
    // last — so the cursor never claims a group whose shards aren't on disk yet.
    for (const [b, shard] of postingsByBucket) await store.writeShard(group, b, shard);
    await store.writeVocab([...vocab]);
    man = { ...man, books, totalSentences: sentBase, groupsDone: group };
    await store.writeManifest(man);
    onProgress?.({ group, groups: source.groupCount, books: books.length, sentences: sentBase, phase: 'flush' });
  }

  man = { ...man, built: true, vocabSize: vocab.size };
  await store.writeManifest(man);
  return man;
};
