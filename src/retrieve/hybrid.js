// Hybrid: lexical first (fast, mechanical), semantic to fill if available.
// Dedup by sentence index, max-pool the score.

import { retrieveLexical }  from './lexical.js';
import { retrieveSemantic } from './semantic.js';

export const retrieveHybrid = async (doc, query, embedder, k = 8) => {
  const lex = retrieveLexical(doc, query, k);
  const sem = await retrieveSemantic(doc, query, embedder, k);
  // Skip units the document has DEF'd as sites (furniture) by their semantic
  // role — they frame, they do not answer. (read/site.js does the marking.)
  const sites = new Set(
    (doc.log.filter ? doc.log.filter(e => e.op === 'DEF' && e.key === 'role' && e.value === 'site') : [])
      .map(e => e.sentIdx),
  );
  const byIdx = new Map();
  for (const r of [...lex, ...sem]) {
    if (sites.has(r.idx)) continue;
    const prev = byIdx.get(r.idx);
    if (!prev || prev.score < r.score) byIdx.set(r.idx, r);
  }
  return [...byIdx.values()].sort((a, b) => b.score - a.score).slice(0, k);
};
