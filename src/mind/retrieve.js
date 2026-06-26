// Retrieving from the mind — the SAME reading, executed against the index.
//
// retrieve/lexical.js scores a sentence as (Σ best-variant-weight present) /
// qLen, with a fuzzy seam: an exact query term hits at 1, a near term the
// corpus spells hits at 1 − dist·0.35, an unspellable term hits nothing. That
// scan walks an in-memory tokensBySentence; the mind cannot — 15M sentences do
// not fit in a tab. So we compute the IDENTICAL number from the inverted index:
// a sentence is "present" for a token exactly when its global id is in that
// token's postings. Same tokenizer, same fuzzy function, same arithmetic — the
// equivalence is asserted directly in tests/mind.test.js.
//
// Text is never stored, so the top-k spans are MATERIALISED on demand: the
// resolver fetches the book from its source URI (cached) and re-segments it —
// segmentation is pure, so sentence indices are stable — and slices out the
// line. Provenance (book id, title, authors, URI) rides on every span.

import { tok }          from '../perceiver/parse/index.js';
import { fuzzyMatches } from '../perceiver/parse/index.js';
import { bucketOf }     from './store.js';

// gid → which book holds it. The book table is in build order, so bases are
// strictly increasing: binary-search for the last base ≤ gid.
const bookOf = (books, gid) => {
  let lo = 0, hi = books.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (books[mid].base <= gid) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return books[ans];
};

// Read every group's shard for one bucket and merge into { token: [gids…] }.
const mergeBucket = async (store, groupsDone, b) => {
  const merged = Object.create(null);
  for (let g = 0; g <= groupsDone; g++) {
    const shard = await store.shard(g, b);
    for (const t in shard) (merged[t] || (merged[t] = [])).push(...shard[t]);
  }
  return merged;
};

// Score the corpus for a query, from postings alone. Returns ranked
// { gid, score, hits } — no text yet (the caller materialises the top-k).
export const scoreQuery = async (store, manifest, query, k = 8, { fuzzy = true } = {}) => {
  const qTokens = tok(query);
  if (qTokens.length === 0) return [];
  const { buckets, groupsDone } = manifest;
  const vocab = new Set(await store.vocab());

  // Resolve each query term to its accepted corpus variants and weights —
  // verbatim from retrieve/lexical.js so the seam cannot drift.
  const accepts = qTokens.map((t) => {
    const ms = fuzzy ? fuzzyMatches(t, vocab) : (vocab.has(t) ? [{ token: t, dist: 0 }] : []);
    return ms.length ? ms.map((m) => [m.token, 1 - m.dist * 0.35]) : [[t, 1]];
  });

  // Load only the buckets the accepted variants touch, once.
  const need = new Set();
  for (const acc of accepts) for (const [v] of acc) need.add(bucketOf(v, buckets));
  const bucketData = new Map();
  for (const b of need) bucketData.set(b, await mergeBucket(store, groupsDone, b));
  const postings = (v) => bucketData.get(bucketOf(v, buckets))?.[v] || [];

  // Per query term, the best weight it contributes to each gid (max over its
  // variants present there). Then sum across terms and divide by qLen.
  const total = new Map();
  const qLen = qTokens.length;
  for (const acc of accepts) {
    const best = new Map();
    for (const [v, w] of acc) {
      const list = postings(v);
      for (const gid of list) { const cur = best.get(gid); if (cur === undefined || w > cur) best.set(gid, w); }
    }
    for (const [gid, w] of best) total.set(gid, (total.get(gid) || 0) + w);
  }

  const out = [];
  for (const [gid, sum] of total) out.push({ gid, score: sum / qLen });
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
};

// Materialise a scored gid into a citable span: find its book, fetch the text
// (the resolver caches), re-segment, slice the line. Provenance attached.
export const materialize = async (manifest, scored, resolveText) => {
  const out = [];
  for (const { gid, score } of scored) {
    const book = bookOf(manifest.books, gid);
    const localIdx = gid - book.base;
    let text = '';
    try { const sents = await resolveText(book); text = sents[localIdx] || ''; }
    catch { text = ''; }                                  // source unreachable → empty, never throw
    out.push({
      idx: gid,
      text,
      score,
      kind: 'lex',
      via: 'mind',
      book: { id: book.id, title: book.title, authors: book.authors, uri: book.uri },
    });
  }
  return out.filter((s) => s.text);                       // drop any that failed to resolve
};
