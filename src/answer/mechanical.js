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

// Resolve a queried name to an admitted entity id — alias-aware, so "gregor"
// finds the referent even after "Gregor" was synthesised into "Gregor Samsa".
const resolveEntityId = (doc, name) => {
  if (!doc || !doc.admission) return null;
  const n = name.toLowerCase();
  for (const [label, id] of doc.admission.admitted) {
    if (label.toLowerCase() === n) return id;
  }
  for (const [label, id] of doc.admission.admitted) {
    const l = label.toLowerCase();
    if (l.includes(n) || n.includes(l)) return id;
  }
  return null;
};

export const answerWho = (doc, question) => {
  const m = String(question || '')
    .match(/^\s*who\s+(?:is|was|were|are)\s+(?:the\s+|a\s+|an\s+)?(.+?)\s*[?.!]*$/i);
  if (!m) return null;
  const name = m[1].trim();
  if (!name) return null;
  const id = resolveEntityId(doc, name);
  if (!id) return null;
  const defs = doc.log.filter(e => e.op === 'DEF' && e.id === id && e.key === 'predicate');
  if (defs.length === 0) return null;
  const def = defs[defs.length - 1];
  const label = (doc.admission.labelOf && doc.admission.labelOf(id)) || titleCase(name);
  return {
    route: 'who',
    text: `${label} is ${def.value} [s${def.sentIdx}].`,
    sources: [def.sentIdx],
  };
};

// Smalltalk routing: a greeting is the cheapest path of all — answered with a
// friendly line and no model, never grounded against the document. The anchors
// keep "hi, who is Gregor?" out: only an essentially-greeting message matches.
const GREET  = /^\s*(h(i+|ey+|ello|iya)|yo+|howdy|sup|greetings|good\s+(morning|afternoon|evening|day))\b[\s!.,]*$/i;
const BYE    = /^\s*(bye|goodbye|see\s+(you|ya)|farewell|good\s*night|cya)\b[\s!.,]*$/i;
const HOWRU  = /\b(how\s+are\s+you|how'?s\s+it\s+going|how\s+do\s+you\s+do|what'?s\s+up)\b/i;
const JUSTHI = /^\s*(i'?m\s+)?just\s+saying\s+(hi|hello|hey)\b[\s!.,]*$/i;
const THANKS = /^\s*(many\s+)?(thanks|thank\s+you|thx|ty|cheers)\b[\s!.,]*$/i;

export const answerSmalltalk = (question) => {
  const s = String(question || '').trim();
  if (!s) return null;
  const talk = (text) => ({ route: 'smalltalk', text, sources: [] });
  if (JUSTHI.test(s)) return talk('Hi there! Ask me anything about the document.');
  if (GREET.test(s))  return talk('Hello! Open a document and ask me about it, or ask me anything.');
  if (BYE.test(s))    return talk('Goodbye.');
  if (HOWRU.test(s))  return talk('Doing well — ready when you are. Ask me about the document.');
  if (THANKS.test(s)) return talk("You're welcome.");
  return null;
};

const titleCase = (s) => s.replace(/\b\w/g, c => c.toUpperCase());

export const tryMechanical = (doc, question) =>
  answerSmalltalk(question)
  || answerMath(question)
  || answerConfirm(doc, question)
  || answerWho(doc, question)
  || null;
