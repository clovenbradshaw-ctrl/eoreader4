// Mechanical answerers. Cheap, deterministic, no model load.
// Each returns either {route, text, sources} or null.
//
// Routing tries these first — if a question is mechanical, the model
// is never warmed for it. This is the single largest UX win on cold start.

import { tok } from '../parse/tokenize.js';
import { projectGraph } from '../core/project.js';
import { typeOf, areDisjoint } from '../read/relation-types.js';

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

// A relational confirm question — "is grete his mother?" — types its relation and
// resolves its subject, or returns null (not a relation the algebra knows, or a
// subject the document never admitted). The OBJECT ("his") is not resolved here;
// it is recovered as the owner of whichever document edge already gives the
// subject a role, so the conflict is checked on a real pair, never an invented one.
const confirmClaim = (doc, q) => {
  const m = q.match(/^\s*(?:is|are|was|were)\s+([A-Za-z][a-z]+)\s+(?:his|her|their|the)?\s*([a-z]+)\b/i);
  if (!m) return null;
  const subj = resolveEntityId(doc, m[1]);
  const rel  = m[2].toLowerCase();
  if (!subj || !typeOf(rel)) return null;          // only relations the algebra knows
  return { subj, rel };
};

const labelOf = (doc, id) => (doc.admission?.labelOf && doc.admission.labelOf(id)) || id;

export const answerConfirm = (doc, question) => {
  const q = String(question || '').trim();
  if (!/^(is|are|was|were|does|do|did)\s+/i.test(q)) return null;

  // ── relational confirm: consult the graph BEFORE token overlap (the t8 fix) ──
  // The token-overlap fallback below would rubber-stamp "is grete his mother?" as
  // "Yes." on the mere co-occurrence of the words — it never types the relation.
  // For a typed relation we consult the reading instead, and the rubber-stamp is
  // dead at the route, not flagged after the fact.
  const claim = confirmClaim(doc, q);
  if (claim) {
    const graph = projectGraph(doc.log);
    const rep   = graph.representative || ((id) => id);
    const subj  = rep(claim.subj);
    const claimType = typeOf(claim.rel);

    // Kinship/social CON edges are logged owner → relative, so the relation
    // describes the `to` node. The questioned subject is that relative, so its
    // role edges are the typed edges pointing AT it. (This is the direction the
    // edge actually carries; matching `from` would miss every kinship bond.)
    const incident = (graph.edges || []).filter(e => rep(e.to) === subj && typeOf(e.via));

    // Disjoint axiom on the same pair → refuse, citing the witnessing edge.
    const conflict = incident.find(e => areDisjoint(claim.rel, e.via));
    if (conflict) {
      const owner = labelOf(doc, rep(conflict.from));
      const role  = String(conflict.via).replace(/-of$/, '');
      return {
        route: 'confirm',
        text: `No — the document has ${labelOf(doc, subj)} as ${owner ? `${owner}'s ` : ''}${role}` +
              `${conflict.sentIdx != null ? ` [s${conflict.sentIdx}]` : ''}, which rules that out.`,
        sources: conflict.sentIdx != null ? [conflict.sentIdx] : [],
      };
    }
    // Same primitive on the same relative → witnessed → confirm with the edge cite.
    const support = incident.find(e => typeOf(e.via).type === claimType.type);
    if (support) {
      return {
        route: 'confirm',
        text: `Yes${support.sentIdx != null ? ` [s${support.sentIdx}]` : ''}.`,
        sources: support.sentIdx != null ? [support.sentIdx] : [],
      };
    }
    // Typed relation, no role edge either way → don't rubber-stamp; say so plainly.
    return { route: 'confirm', text: 'The document does not say.', sources: [] };
  }

  // ── non-relational confirm: the existing token-overlap path, unchanged ──
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
