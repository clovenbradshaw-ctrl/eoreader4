// foldNote — the integral fold. Compresses a set of spans into a single
// note that preserves citations. The fold is the unit the model sees.
//
// The simplest fold that respects the contract: bullet list of the spans,
// in source order, each tagged with its index. The model is never asked
// to invent the index; it is given the indices to work from.

export const foldNote = (spans) => {
  if (!spans || spans.length === 0) return { text: '', sources: [] };
  const ordered = spans.slice().sort((a, b) => a.idx - b.idx);
  const text = ordered.map(s => `[s${s.idx}] ${s.text}`).join('\n');
  return { text, sources: ordered.map(s => s.idx) };
};
