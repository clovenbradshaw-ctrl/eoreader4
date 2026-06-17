// Forward token-set retrieval. The hot path — sub-millisecond on docs
// up to ~5k sentences. No async; no model; no embedder.

import { tok } from '../parse/tokenize.js';

export const retrieveLexical = (doc, query, k = 8) => {
  const qTokens = tok(query);
  if (qTokens.length === 0) return [];
  const out = [];
  const qLen = qTokens.length;
  for (let i = 0; i < doc.tokensBySentence.length; i++) {
    const sentSet = doc.tokensBySentence[i];
    let hits = 0;
    for (const t of qTokens) if (sentSet.has(t)) hits++;
    if (hits === 0) continue;
    out.push({ idx: i, score: hits / qLen, text: doc.sentences[i], kind: 'lex' });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
};
