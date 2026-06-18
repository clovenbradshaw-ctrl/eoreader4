// Sentence segmentation. Honours paragraph breaks.
// Drop-in replacement: any function (text) → string[].
//
// The boundary rule is a DEF — the established convention for where a sentence
// ends: a sentence-final mark (. ! ?) followed by space or end. The smartness is
// an EVA on each candidate '.': a period after a known ABBREVIATION (Mr, Mrs, Dr,
// St…) or a single capital INITIAL (J. Austen) is not a boundary — it abbreviates,
// so the cut is withheld. Without this, "Mr. Darcy" splits into "Mr." + "Darcy",
// and a one-token fragment is a junk unit that warps everything downstream (the
// meaning reader spikes on it, the graph mis-bonds). ! and ? are unambiguous and
// always cut.
//
// The REC — learning THIS document's abbreviations rather than a fixed list, the
// way Pass 0 learns its attribution verbs — is the natural extension and is noted
// in the conventions ledger's territory; the seed list below is the DEF it starts
// from.

const ABBR = new Set([
  'mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'messrs', 'mme', 'mlle',
  'prof', 'rev', 'hon', 'capt', 'col', 'gen', 'sgt', 'lt', 'cmdr', 'sr', 'jr',
  'esq', 'co', 'inc', 'ltd', 'no', 'vol', 'pp', 'rd', 'ave', 'fig',
  'vs', 'etc', 'al', 'eg', 'ie', 'cf', 'viz',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

// Is the period that ends `buf` an abbreviation/initial, not a sentence boundary?
// Reads the word immediately before the period. A single capital is an initial
// (J. R. R.); a known abbreviation marks a title or contraction.
const abbreviates = (buf) => {
  const m = buf.slice(0, -1).match(/([A-Za-z]+)$/);
  if (!m) return false;
  const w = m[1];
  return /^[A-Z]$/.test(w) || ABBR.has(w.toLowerCase());
};

export const segmentSentences = (text) => {
  const t = String(text || '').replace(/\r\n?/g, '\n');
  if (!t.trim()) return [];
  const out = [];
  for (const para of t.split(/\n{2,}/)) {
    const p = para.replace(/\s+/g, ' ').trim();
    if (!p) continue;
    let buf = '';
    for (let i = 0; i < p.length; i++) {
      buf += p[i];
      const ch = p[i];
      const next = p[i + 1] || '';
      if (/[.!?]/.test(ch) && (next === '' || /\s/.test(next))) {
        // The EVA: a '.' that abbreviates is not a boundary — withhold the cut.
        if (ch === '.' && abbreviates(buf)) continue;
        const s = buf.trim();
        if (s) out.push(s);
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
};
