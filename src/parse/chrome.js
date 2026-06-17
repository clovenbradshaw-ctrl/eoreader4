// The chrome gate. Page numbers, headers, separators — recorded as NUL
// events, not INS. The graph stays uncluttered by document furniture.

const PATTERNS = [
  /^page \d+/i,
  /^chapter \d+\.?\s*$/i,
  /^section \d+(\.\d+)*\s*$/i,
  /^\d+\s*$/,
  /^\[\d{1,3}\]$/,
  /^-{3,}$/,
  /^_{3,}$/,
  /^={3,}$/,
];

export const isChrome = (sentence) => {
  const s = String(sentence || '').trim();
  if (s.length < 3) return true;
  return PATTERNS.some(p => p.test(s));
};
