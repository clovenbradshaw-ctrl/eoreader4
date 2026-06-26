// Per-proposition grounding provenance — veto on MEANING, not raw spans.
//
// A response is not one thing to accept or refuse whole. It is a sequence of PROPOSITIONS,
// and each can stand in a different relation to what was read:
//
//   VERBATIM    the proposition is lifted from a read span — the perceiver's own words.
//   GROUNDED    the proposition CORRESPONDS to a document proposition: the same figures
//               stand in the same relation. The meaning is witnessed, even if the wording
//               is the writer's own. (This is the test that matters — propositional
//               correspondence, NOT lexical span overlap. The audit's salad "Saving the
//               Appearances answer question" shares words with the title span yet asserts
//               no proposition the document holds, so it must NOT count as grounded.)
//   FABRICATED  the proposition corresponds to nothing read — pure enactor, no witness.
//
// This is the provenance line (core/provenance) read at proposition grain: verbatim and
// grounded carry a PERCEIVER witness (they can anchor); fabricated is ENACTOR-only (mine,
// unwitnessed). A veto then acts per proposition — suppress or flag the fabricated, let the
// witnessed ride — instead of accepting or refusing the whole answer. Embedder-free: figures
// match by label, relations by operator/verb; verbatim is the one place a literal span check
// is correct, because verbatim IS about the surface.

import { parseText } from '../perceiver/parse/index.js';

// the propositions of a text — subject–relation–object bonds, figures as lowercased labels.
const propsOf = (text) => {
  const doc = parseText(String(text || ''), { docId: 'prov' });
  const events = doc.log.snapshot();
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, String(e.label).toLowerCase());
  const L = (id) => label.get(id) ?? String(id).toLowerCase();
  const props = [];
  for (const e of events) {
    if ((e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null) {
      props.push({ subj: L(e.src), via: String(e.via).toLowerCase(), obj: e.tgt != null ? L(e.tgt) : null });
    }
  }
  return props;
};

// the document's own propositions, read off its graph (full cross-sentence coref intact),
// optionally restricted to the sentences actually read. This is the right ground truth for a
// doc-grounded answer — re-parsing spans in isolation loses the coref the graph already has.
const docPropositions = (doc, spanIdxs = null) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, String(e.label).toLowerCase());
  const L = (id) => label.get(id) ?? String(id).toLowerCase();
  const allow = spanIdxs ? new Set(spanIdxs) : null;
  const props = [];
  for (const e of events) {
    if ((e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null && (!allow || allow.has(e.sentIdx)))
      props.push({ subj: L(e.src), via: String(e.via).toLowerCase(), obj: e.tgt != null ? L(e.tgt) : null });
  }
  return props;
};

// classifyProvenance(answer, source) → one verdict per proposition of the answer.
//   source   a string[] of read spans (re-parsed), OR { doc, spanIdxs?, spans? } to judge
//            against the document's OWN graph (coref intact) — the correct ground truth for
//            an answer generated from a doc.
//   verbatim   the answer clause appears (subj, relation, object together) in a read span.
//   grounded   the same two figures stand in a relation among the source propositions.
//   fabricated neither — asserts a proposition nothing read supports.
export const classifyProvenance = (answer, source = []) => {
  const fromDoc = source && !Array.isArray(source) && source.doc;
  const spans = Array.isArray(source) ? source : (source.spans || source.doc?.sentences || []);
  const spanLC = spans.map((s) => String(s).toLowerCase());   // for the verbatim substring check only
  const docProps = fromDoc ? docPropositions(source.doc, source.spanIdxs) : spans.flatMap(propsOf);
  // figure pairs are ORDER-INSENSITIVE — "the same two figures stand in a relation" holds
  // whichever way the writer turned it (a reworded or role-swapped paraphrase still grounds).
  const pairKey = (a, b) => [a, b].sort().join('|');
  const figurePair = new Set(docProps.filter((p) => p.obj).map((p) => pairKey(p.subj, p.obj)));
  const subjRel = new Set(docProps.map((p) => `${p.subj}|${p.via}`));

  const out = propsOf(answer).map((p) => {
    const inSpan = spanLC.some((s) => s.includes(p.subj) && s.includes(p.via) && (!p.obj || s.includes(p.obj)));
    // GROUNDED is propositional: the same figures in a relation, or the same figure in the
    // same relation — read off the document's propositions, never raw word overlap.
    const grounded = (p.obj && figurePair.has(pairKey(p.subj, p.obj))) || subjRel.has(`${p.subj}|${p.via}`);
    const grounding = inSpan ? 'verbatim' : grounded ? 'grounded' : 'fabricated';
    return Object.freeze({ ...p, grounding, witnessed: grounding !== 'fabricated' });
  });

  const summary = { verbatim: 0, grounded: 0, fabricated: 0 };
  for (const o of out) summary[o.grounding] += 1;
  return Object.freeze({ propositions: out, summary, anyWitnessed: out.some((o) => o.witnessed), allFabricated: out.length > 0 && out.every((o) => !o.witnessed) });
};
