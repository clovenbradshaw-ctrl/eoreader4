// foldNote — the integral fold. The unit of evidence the talker reads beside
// the verbatim spans.
//
// When the document is present, the fold IS the consciousness: it queries the
// three reading surfaces (existence, structure, significance) and integrates
// them into a single reading, every line carrying its source index so
// citations still bind. Without a document it falls back to a condensed,
// source-ordered digest of the spans — still a fold, tighter than a raw dump.

import { consciousness } from '../read/index.js';

export const foldNote = (spans, opts = {}) => {
  if (!spans || spans.length === 0) return { text: '', sources: [] };
  const ordered = spans.slice().sort((a, b) => a.idx - b.idx);
  const sources = ordered.map(s => s.idx);

  const doc = opts.doc;
  if (doc && doc.log) {
    const c = consciousness(doc, ordered, opts.cursor ?? null);
    if (c && c.text) return { text: c.text, sources, levels: c.levels };
  }

  const text = ordered.map(s => `[s${s.idx}] ${condense(s.text)}`).join('\n');
  return { text, sources };
};

// Trim a span to its first clause when it is long, so the digest fallback is
// a fold and not a copy. Short spans pass through unchanged.
const condense = (s) => {
  const t = String(s || '').trim();
  if (t.length <= 160) return t;
  const cut = t.slice(0, 160);
  const stop = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('; '), cut.lastIndexOf(' — '));
  return (stop > 60 ? cut.slice(0, stop) : cut.replace(/\s+\S*$/, '')) + '…';
};
