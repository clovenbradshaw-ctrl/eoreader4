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

import { scanEntities } from './entities.js';
import { SEED_COPULA, SEED_MODIFIER, SEED_SPEECH } from '../conventions/index.js';

// The verb-classification word-lists live in the conventions ledger (the home for
// the language-specific stuff), seeded and learnable. The parser holds NO list of
// its own: it takes predicates, defaulting to the ledger's seeds so a standalone
// call (the edge-grounding veto) still works. The pipeline hands it the live
// conventions, so a document's learned dialect flows straight in.
const COPULA_SEED   = new Set(SEED_COPULA);     // is/am/was/… → DEF, never a relation
const SPEECH_SEED   = new Set(SEED_SPEECH);     // said/asked/… → SIG
const MODIFIER_SEED = new Set(SEED_MODIFIER);   // adverbs/intensifiers/auxiliaries to step over
const defIsCopula   = (w) => COPULA_SEED.has(w);
const defIsSpeech   = (w) => SPEECH_SEED.has(w);
const defIsModifier = (w) => MODIFIER_SEED.has(w);

const SUBJECT_PRONOUN = new Set(['He', 'She', 'They', 'We', 'It', 'I', 'You']);

// Words that are not verbs: if the head slot lands on one of these, there is
// no relation here — better silence than "Grete who Just" or "Just by Gregor".
const NOT_HEAD = new Set([
  'who', 'whom', 'whose', 'which', 'that', 'what', 'where', 'when', 'why', 'how',
  'by', 'of', 'in', 'on', 'at', 'to', 'from', 'with', 'for', 'as', 'than', 'about',
  'and', 'but', 'or', 'nor', 'so', 'because', 'although', 'while', 'if', 'unless',
  'a', 'an', 'the', 'his', 'her', 'their', 'its', 'this', 'these', 'those',
  'my', 'your', 'our', 'mine', 'yours', 'ours',
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
//
// KNOWN CARVE LIMIT (do not patch here): subjects are found only at the
// sentence head — a leading pronoun or a sentence-initial name. Mid-clause
// subjects ("Video shows Topps approaching") never reach the field, so their
// bonds never fire. This is the §8 segmentation failure, not a coref bug; it
// belongs to the SEG-first rework. Patching subject-finding here too would
// scatter the fix across two places and make that rework harder.
const leadingSubject = (sentence, admission, coref) => {
  const pn = sentence.match(/^\s*(He|She|They|We|It|I|You)\b/);
  if (pn) {
    const cands = coref?.field ? coref.field() : [];
    const top = cands[0];
    const start = pn[0].length - pn[1].length;     // the pronoun's offset past any lead
    return { id: top?.id ?? null, start, end: pn[0].length, text: pn[1], kind: 'pronoun', w: top?.w ?? 0 };
  }
  // Otherwise the first capitalised phrase, if it is an admitted entity.
  const ents = scanEntities(sentence);
  const first = ents.find(e => e.start <= 1); // sentence-initial
  if (first && admission.isAdmitted(first.label)) {
    return { id: admission.idOf(first.label), start: first.start, end: first.end,
             text: sentence.slice(first.start, first.end), kind: 'name', w: 1 };
  }
  return null;
};

// Round a coupling weight for the log; only sub-unit (inferred) weights are
// stamped — a named, certain bond carries no weight field and projects at 1.
const coupling = (subj) =>
  subj.kind === 'pronoun' ? { w: Math.round((subj.w ?? 0) * 1000) / 1000 } : {};

// Step over leading adverbs/auxiliaries to the head verb. Returns the verb
// (lowercased) and the remaining text, or null if no verb-like token follows.
// Exported so the edge-grounding veto can reuse the SAME head-verb scan the page
// uses to tell a relational talker sentence (whose endpoints may not resolve)
// from a non-relational one — the SVO clause parser, pointed at the talker.
// `at` is the verb token's start offset in `text`; `restStart` is where the
// post-verb remainder begins in `text`. Both let the caller place the verb and
// object spans back into the sentence (the logged argument-span SEG, §3). The
// existing fields (verb, rest, copular) are unchanged, so the edge-grounding
// veto's reuse of this scan is unaffected.
export const headVerb = (text, { isCopula = defIsCopula, isModifier = defIsModifier } = {}) => {
  let rest = text.replace(/^[\s,]+/, '');
  let consumed = text.length - rest.length;             // chars of `text` walked past
  // The verb guard, ReVerb's relation-phrase constraint by hand: step over the
  // adverbs/intensifiers/auxiliaries (the modifier list), route a copula to its
  // own DEF branch, and reject a preposition/relative as a head. What remains is
  // verb-headed — or, if we only ever found modifiers, nothing, and that clause is
  // no relation. The guard limit is generous because a clause can stack several
  // modifiers ("had not really quite walked").
  for (let guard = 0; guard < 6; guard++) {
    const m = rest.match(/^([A-Za-z][a-zA-Z'’]*)\b/);
    if (!m) return null;
    const w = m[1].toLowerCase();
    const at = consumed;                                // verb token start in `text`
    const restStart = at + m[0].length;                 // post-verb text start in `text`
    if (isCopula(w)) return { verb: w, rest: rest.slice(m[0].length), copular: true, at, restStart };
    if (isModifier(w)) {
      const sliced  = rest.slice(m[0].length);
      const trimmed = sliced.replace(/^[\s,]+/, '');
      consumed += m[0].length + (sliced.length - trimmed.length);
      rest = trimmed;
      continue;
    }
    if (NOT_HEAD.has(w)) return null;   // a preposition/relative pronoun is not a verb
    return { verb: w, rest: rest.slice(m[0].length), copular: false, at, restStart };
  }
  return null;
};

// Each admitted object, with its offsets within `text` so the caller can place
// the object span back into the sentence. (Was ids only — the spans were computed
// and thrown away, the v1 gap this spec closes.)
const objectEntities = (text, admission, excludeId) => {
  const out = [];
  const seen = new Set([excludeId]);
  for (const e of scanEntities(text)) {
    if (!admission.isAdmitted(e.label)) continue;
    const id = admission.idOf(e.label);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: e.label, start: e.start, end: e.end });
  }
  return out;
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

// Standing-description scan — the third coref channel's extraction half. A role
// epithet with NO adjacent name is a STANDING DESCRIPTION, not an apposition:
// "his sister", "Gregor's sister" — but NEVER "his sister Grete" / "his sister,
// Grete", which are apposition the kinship CON path already binds. The owner is
// reported, never resolved here: a NAME owner is authoritative; a PRONOUN owner
// is a guess the caller resolves under a margin guard. Reuses the KIN lexicon.
// This deposits nothing on its own — the pipeline turns each sighting into a held
// descriptor; binding a name to the role is the trigger's job, not this scan's.
const DESC_NAME_RE = new RegExp(String.raw`\b([A-Z][a-zA-Z]+)['’]s\s+(${KIN})\b`, 'gi');
const DESC_PRON_RE = new RegExp(String.raw`\b(his|her|their|its)\s+(${KIN})\b`, 'gi');

export const scanDescriptors = (sentence) => {
  const s = String(sentence || '');
  // Apposition iff the role is immediately followed (after optional comma/space)
  // by a capitalised name — that case belongs to the kinship CON path, not here.
  const isApposition = (endIdx) => /^[,\s]+[A-Z][a-z]/.test(s.slice(endIdx));
  const out = [];
  let m;
  const reN = new RegExp(DESC_NAME_RE.source, 'gi');
  while ((m = reN.exec(s)) !== null) {
    if (isApposition(m.index + m[0].length)) continue;
    out.push({ roleKey: m[2].toLowerCase(), owner: { kind: 'name', name: m[1] } });
  }
  const reP = new RegExp(DESC_PRON_RE.source, 'gi');
  while ((m = reP.exec(s)) !== null) {
    if (isApposition(m.index + m[0].length)) continue;
    out.push({ roleKey: m[2].toLowerCase(), owner: { kind: 'pron', pron: m[1].toLowerCase() } });
  }
  return out;
};

export const parseRelations = (sentence, admission, coref = {}, opts = {}) => {
  // Speech / copula / modifier classification comes from the conventions ledger
  // when one is supplied (its seed ∪ Pass-0 learned), falling back to the seeds.
  const isSpeech = opts.isSpeech || defIsSpeech;
  const verbOpts = { isCopula: opts.isCopula || defIsCopula, isModifier: opts.isModifier || defIsModifier };
  const out = [];
  const s = sentence.trim();

  const subj = leadingSubject(s, admission, coref);
  if (subj && subj.id) {
    const after = s.slice(subj.end);
    const head = headVerb(after, verbOpts);
    const w = coupling(subj);
    if (head && head.copular) {
      const pred = head.rest.replace(/^[\s,]+/, '').replace(/[.!?]+\s*$/, '').trim();
      if (pred) out.push({ op: 'DEF', id: subj.id, key: 'predicate', value: pred, ...w });
    } else if (head) {
      const op = isSpeech(head.verb) ? 'SIG' : 'CON';
      // The argument spans, with offsets back into `s` (which equals
      // doc.sentences[sentIdx] — segmentSentences trims), each carrying its
      // verbatim text so the walk is self-verifying. The pipeline emits these as
      // a logged clause-level SEG before the bond, so a CON is walkable back to
      // the text its endpoints were read from (§3). Carried on the rel as `args`;
      // the pipeline strips it from the edge event after emitting the SEG.
      const vStart = subj.end + head.at, vEnd = subj.end + head.restStart;
      const subject = { text: subj.text, start: subj.start, end: subj.end, id: subj.id };
      const verb    = { text: s.slice(vStart, vEnd), start: vStart, end: vEnd };
      for (const obj of objectEntities(head.rest, admission, subj.id)) {
        const oStart = vEnd + obj.start, oEnd = vEnd + obj.end;
        const object = { text: s.slice(oStart, oEnd), start: oStart, end: oEnd, id: obj.id };
        out.push({ op, src: subj.id, tgt: obj.id, via: head.verb, ...w,
                   args: { subject, verb, object, op } });
      }
    }
  }

  for (const k of kinshipEdges(s, admission, coref)) {
    if (!out.some(o => o.op === k.op && o.src === k.src && o.tgt === k.tgt)) out.push(k);
  }

  return out;
};
