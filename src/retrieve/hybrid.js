// Hybrid: lexical first (fast, mechanical), semantic to fill if available.
// Dedup by sentence index, then FUSE the two channels by concordance.
//
// The old fusion max-pooled — kept the larger of the lexical and semantic score
// and discarded the other. That throws away the AGREEMENT signal: two weak-but-
// concordant retrievers (lex 0.5, sem 0.5) are better evidence than one strong
// channel alone, and keep-the-larger structurally cannot say so — it reports 0.5
// either way. The fold then surfs a cursor seeded on this ranking, so a sentence
// both readers point at should outrank one only a single reader found.
//
// We fuse by a noisy-OR — the standard concordance posterior over two channels
// read as independent evidence of relevance: P = 1 − (1−lex)(1−sem). Agreement
// compounds (0.5, 0.5 → 0.75); a lone strong channel is preserved (0.9, 0 → 0.9);
// a lone weak one stays weak (0.3, 0 → 0.3). The semantic cosine is clamped to
// [0,1] first — a negative cosine is dissimilarity, i.e. no evidence, not anti-
// evidence that should pull a lexical hit down.

import { retrieveLexical }  from './lexical.js';
import { retrieveSemantic } from './semantic.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// The concordance posterior over two channels read as independent evidence of
// relevance: noisy-OR. Agreement compounds, a lone strong channel is preserved,
// a lone weak one stays weak. This is what max-pool could not express.
export const fuseConcordance = (lex, sem) =>
  1 - (1 - clamp01(lex)) * (1 - clamp01(sem));

export const retrieveHybrid = async (doc, query, embedder, k = 8) => {
  const lex = retrieveLexical(doc, query, k);
  const sem = await retrieveSemantic(doc, query, embedder, k);
  // Skip units the document has DEF'd as sites (furniture) by their semantic
  // role — they frame, they do not answer. (read/site.js does the marking.)
  const sites = new Set(
    (doc.log.filter ? doc.log.filter(e => e.op === 'DEF' && e.key === 'role' && e.value === 'site') : [])
      .map(e => e.sentIdx),
  );

  // Gather each channel's evidence per sentence (the stronger reading per channel,
  // if a channel somehow lists an index twice).
  const channels = new Map();
  const note = (r, key) => {
    if (sites.has(r.idx)) return;
    const c = channels.get(r.idx) || { lex: 0, sem: 0, text: r.text };
    c[key] = Math.max(c[key], clamp01(r.score));
    if (!c.text) c.text = r.text;
    channels.set(r.idx, c);
  };
  for (const r of lex) note(r, 'lex');
  for (const r of sem) note(r, 'sem');

  const out = [];
  for (const [idx, c] of channels) {
    const score = fuseConcordance(c.lex, c.sem);   // concordance posterior
    const kind  = c.lex > 0 && c.sem > 0 ? 'lex+sem' : (c.lex > 0 ? 'lex' : 'sem');
    out.push({ idx, score, text: c.text, kind, lex: c.lex, sem: c.sem });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
};
