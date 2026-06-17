// Relation extraction → CON (bond), SIG (attribution/speech), DEF (define).
//
// The contract is unchanged: never invent a node. Every endpoint of an edge
// is an admitted entity, or a pronoun resolved by coreference to one. The
// gains over the single rigid SVO regex are where the weakness was:
//
//   - Coreference. A leading subject pronoun ("He", "She", "They") resolves
//     to the most recently mentioned entity (within a few sentences). In a
//     single-protagonist text this is the difference between a handful of
//     edges and a real graph.
//   - Verb classification. Speech / attribution verbs ("said", "told",
//     "asked") emit SIG; copulas ("is", "was") emit DEF; everything else
//     that links two entities emits CON.
//   - An open verb slot. The verb is no longer a tiny whitelist — any verb
//     between two admitted entities bonds them. Precision is held by the
//     admitted-endpoints rule, not by enumerating verbs.
//   - Kinship apposition. "his sister Grete", "Gregor's father" bond the
//     owner to the named relative through the kin term.

const COPULAR = new Set(['is', 'are', 'was', 'were', 'be', 'been']);

const SPEECH = new Set([
  'said', 'says', 'say', 'asked', 'asks', 'replied', 'replies', 'told', 'tells',
  'cried', 'cries', 'shouted', 'whispered', 'muttered', 'answered', 'answers',
  'called', 'calls', 'exclaimed', 'declared', 'added', 'continued', 'thought',
  'thinks', 'wondered', 'murmured', 'repeated', 'insisted', 'remarked',
  'observed', 'screamed', 'begged', 'urged', 'warned', 'promised', 'admitted',
  'confessed', 'announced', 'wrote', 'writes',
]);

// Leading adverbs / auxiliaries to step over when locating the head verb.
// Copulas are deliberately absent — they are their own (DEF) branch.
const SKIP = new Set([
  'then', 'now', 'also', 'just', 'once', 'soon', 'suddenly', 'slowly', 'quietly',
  'gently', 'again', 'still', 'only', 'even', 'simply', 'quickly', 'immediately',
  'finally', 'however', 'never', 'always', 'often', 'already', 'almost', 'nearly',
  'had', 'has', 'have', 'having', 'would', 'could', 'will', 'shall', 'should',
  'did', 'does', 'do', 'not', 'must', 'might', 'may', 'can',
]);

const SUBJECT_PRONOUN = new Set(['He', 'She', 'They', 'We', 'It', 'I', 'You']);

// Words that are not verbs: if the head slot lands on one of these, there is
// no relation here — better silence than "Grete who Just" or "Just by Gregor".
const NOT_HEAD = new Set([
  'who', 'whom', 'whose', 'which', 'that', 'what', 'where', 'when', 'why', 'how',
  'by', 'of', 'in', 'on', 'at', 'to', 'from', 'with', 'for', 'as', 'than', 'about',
  'and', 'but', 'or', 'nor', 'so', 'because', 'although', 'while', 'if', 'unless',
  'a', 'an', 'the', 'his', 'her', 'their', 'its', 'this', 'these', 'those',
]);

const KIN = '(?:father|mother|sister|brother|son|daughter|wife|husband|parents|' +
  'uncle|aunt|cousin|nephew|niece|grandfather|grandmother|friend|master|' +
  'servant|boss|chief|partner|neighbour|neighbor|colleague|lover|fiance|fiancee)';

// "Gregor's sister Grete" | "his sister, Grete"
const KIN_RE = new RegExp(
  String.raw`(?:([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)'s|\b(his|her|their|its)\b)\s+(${KIN})\s*,?\s+([A-Z][a-zA-Z]+)`,
  'gi',
);

// Resolve the sentence's leading subject. A name resolves with full coupling
// (w = 1). A pronoun does not decide — it reads the referent field and takes
// the strongest candidate, carrying that candidate's weight as the bond's
// coupling so the uncertainty rides along instead of being thrown away.
const leadingSubject = (sentence, admission, coref) => {
  const pn = sentence.match(/^\s*(He|She|They|We|It|I|You)\b/);
  if (pn) {
    const cands = coref?.field ? coref.field() : [];
    const top = cands[0];
    return { id: top?.id ?? null, end: pn[0].length, kind: 'pronoun', w: top?.w ?? 0 };
  }
  // Otherwise the first capitalised phrase, if it is an admitted entity.
  const ents = admission.scan(sentence);
  const first = ents.find(e => e.start <= 1); // sentence-initial
  if (first && admission.isAdmitted(first.label)) {
    return { id: admission.idOf(first.label), end: first.end, kind: 'name', w: 1 };
  }
  return null;
};

// Round a coupling weight for the log; only sub-unit (inferred) weights are
// stamped — a named, certain bond carries no weight field and projects at 1.
const coupling = (subj) =>
  subj.kind === 'pronoun' ? { w: Math.round((subj.w ?? 0) * 1000) / 1000 } : {};

// Step over leading adverbs/auxiliaries to the head verb. Returns the verb
// (lowercased) and the remaining text, or null if no verb-like token follows.
const headVerb = (text) => {
  let rest = text.replace(/^[\s,]+/, '');
  for (let guard = 0; guard < 4; guard++) {
    const m = rest.match(/^([A-Za-z][a-zA-Z'’]*)\b/);
    if (!m) return null;
    const w = m[1].toLowerCase();
    if (COPULAR.has(w)) return { verb: w, rest: rest.slice(m[0].length), copular: true };
    if (SKIP.has(w)) { rest = rest.slice(m[0].length).replace(/^[\s,]+/, ''); continue; }
    if (NOT_HEAD.has(w)) return null;   // a preposition/relative pronoun is not a verb
    return { verb: w, rest: rest.slice(m[0].length), copular: false };
  }
  return null;
};

// Bound a copular predicate to its first clause — recursive segmentation in
// the small: a long sentence carries many clauses, but the assertion is the
// first one. Stops at a clause break (; — , who/which/that) or a length cap,
// so a DEF is a fact, not a paragraph.
const firstClause = (text) => {
  let t = text.replace(/^[\s,]+/, '').replace(/[.!?]+\s*$/, '').trim();
  const cut = t.search(/[;—–]|\s+(?:who|which|that|because|although|while|and then)\s+/i);
  if (cut > 0) t = t.slice(0, cut);
  if (t.length > 90) t = t.slice(0, 90).replace(/\s+\S*$/, '') + '…';
  return t.trim();
};

const objectEntities = (text, admission, excludeId) => {
  const ids = [];
  const seen = new Set([excludeId]);
  for (const e of admission.scan(text)) {
    if (!admission.isAdmitted(e.label)) continue;
    const id = admission.idOf(e.label);
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
};

const kinshipEdges = (sentence, admission, coref) => {
  const out = [];
  const re = new RegExp(KIN_RE.source, KIN_RE.flags);
  let m;
  while ((m = re.exec(sentence)) !== null) {
    const ownerName = m[1];
    const ownerPron = m[2];
    const kin       = m[3].toLowerCase();
    const relName   = m[4];
    let ownerId = null;
    if (ownerName && admission.isAdmitted(ownerName)) ownerId = admission.idOf(ownerName);
    else if (ownerPron && coref?.resolve)            ownerId = coref.resolve(ownerPron);
    if (!ownerId) continue;
    if (!admission.isAdmitted(relName)) continue;
    const relId = admission.idOf(relName);
    if (relId === ownerId) continue;
    out.push({ op: 'CON', src: ownerId, tgt: relId, via: kin });
  }
  return out;
};

export const parseRelations = (sentence, admission, coref = {}, opts = {}) => {
  // Speech classification comes from the learned conventions ledger when one
  // is supplied (Pass 0 induction), falling back to the built-in seed set.
  const isSpeech = opts.isSpeech || ((v) => SPEECH.has(v));
  const out = [];
  const s = sentence.trim();

  const subj = leadingSubject(s, admission, coref);
  if (subj && subj.id) {
    const after = s.slice(subj.end);
    const head = headVerb(after);
    const w = coupling(subj);
    if (head && head.copular) {
      const pred = firstClause(head.rest);
      if (pred) out.push({ op: 'DEF', id: subj.id, key: 'predicate', value: pred, ...w });
    } else if (head) {
      const op = isSpeech(head.verb) ? 'SIG' : 'CON';
      for (const objId of objectEntities(head.rest, admission, subj.id)) {
        out.push({ op, src: subj.id, tgt: objId, via: head.verb, ...w });
      }
    }
  }

  for (const k of kinshipEdges(s, admission, coref)) {
    if (!out.some(o => o.op === k.op && o.src === k.src && o.tgt === k.tgt)) out.push(k);
  }

  return out;
};
