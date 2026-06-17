// Sentence segmentation. Honours paragraph breaks.
// Naive but bounded. Drop-in replacement: any function (text) → string[].

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
        const s = buf.trim();
        if (s) out.push(s);
        buf = '';
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
};
