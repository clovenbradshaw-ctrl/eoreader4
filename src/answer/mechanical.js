// Mechanical answerers. Cheap, deterministic, no model load.
// Each returns either {route, text, sources} or null.
//
// Routing tries these first — if a question is mechanical, the model
// is never warmed for it. This is the single largest UX win on cold start.

import { tok } from '../parse/tokenize.js';

export const answerMath = (question) => {
  const m = String(question || '').match(/(-?\d+(?:\.\d+)?)\s*([+\-*/x])\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[3]);
  const op = m[2];
  let v;
  switch (op) {
    case '+': v = a + b; break;
    case '-': v = a - b; break;
    case '*': case 'x': v = a * b; break;
    case '/': v = b === 0 ? null : a / b; break;
  }
  if (v == null) return null;
  return { route: 'math', text: `${a} ${op} ${b} = ${v}`, sources: [] };
};

export const answerConfirm = (doc, question) => {
  const q = String(question || '').trim();
  if (!/^(is|are|was|were|does|do|did)\s+/i.test(q)) return null;
  const qTokens = tok(q);
  if (qTokens.length === 0) return null;
  let best = null;
  for (let i = 0; i < doc.sentences.length; i++) {
    const sentSet = doc.tokensBySentence[i];
    let hits = 0;
    for (const t of qTokens) if (sentSet.has(t)) hits++;
    const score = hits / qTokens.length;
    if (!best || score > best.score) best = { idx: i, score };
  }
  if (best && best.score >= 0.6) {
    return { route: 'confirm', text: `Yes. [s${best.idx}]`, sources: [best.idx] };
  }
  if (best && best.score < 0.2) {
    return { route: 'confirm', text: 'The document does not say.', sources: [] };
  }
  return null;
};

export const answerWho = (doc, question) => {
  const m = String(question || '').match(/who\s+(?:is|was|were|are)\s+([A-Z][a-zA-Z\s]+?)\??$/i);
  if (!m) return null;
  const label = m[1].trim();
  const id = label.toLowerCase().replace(/\s+/g, '-');
  const defs = doc.log.filter(e => e.op === 'DEF' && e.id === id && e.key === 'predicate');
  if (defs.length === 0) return null;
  const def = defs[defs.length - 1];
  return {
    route: 'who',
    text: `${label} is ${def.value} [s${def.sentIdx}].`,
    sources: [def.sentIdx],
  };
};

export const tryMechanical = (doc, question) =>
  answerMath(question)
  || answerConfirm(doc, question)
  || answerWho(doc, question)
  || null;
