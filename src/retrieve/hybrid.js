// Hybrid: lexical first (fast, mechanical), semantic to fill if available.
// Dedup by sentence index, max-pool the score.

import { retrieveLexical }  from './lexical.js';
import { retrieveSemantic } from './semantic.js';

export const retrieveHybrid = async (doc, query, embedder, k = 8) => {
  const lex = retrieveLexical(doc, query, k);
  const sem = await retrieveSemantic(doc, query, embedder, k);
  const byIdx = new Map();
  for (const r of [...lex, ...sem]) {
    const prev = byIdx.get(r.idx);
    if (!prev || prev.score < r.score) byIdx.set(r.idx, r);
  }
  return [...byIdx.values()].sort((a, b) => b.score - a.score).slice(0, k);
};
