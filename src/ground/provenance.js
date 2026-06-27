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
    if ((e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null && (!allow || allow.has(e.sentIdx))) {
      // the door the proposition was constituted through: exafference (the world, witnessed) or
      // reafference (the model's interpretation — an EOT note, which cannot witness). Prose
      // events carry no door → exafference (the text WAS the world read), so prose is unchanged.
      const door = e.door ?? e.prov?.door ?? 'perceiver';
      props.push({ subj: L(e.src), via: String(e.via).toLowerCase(), obj: e.tgt != null ? L(e.tgt) : null, door });
    }
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
  // GROUNDED requires the same RELATION between the same FIGURES, not merely the same figures:
  // "Gregor married Grete" is fabricated even though the doc relates Gregor and Grete, because
  // it relates them by other verbs — the meaning of a proposition is its relation, not just
  // who it is about. Figures are order-insensitive (a passive/role-swapped rewording still
  // grounds: "Ben was trusted by Anna" ↔ "Anna trusted Ben"); the relation must match.
  const relKey = (p) => `${[p.subj, p.obj || ''].sort().join('~')}|${p.via}`;
  const docRel = new Set(docProps.map(relKey));
  // the relations the WORLD witnesses — grounded by at least one exafferent (perceiver) doc
  // event. A relation present only through reafference (the model's EOT notes) is grounded but
  // NOT witnessed: it is the engine's interpretation, defeasible, not the asserted ground.
  const witnessedRel = new Set(docProps.filter((p) => p.door !== 'enactor').map(relKey));
  // SEEK THE WITNESS: when a separate exafferent SOURCE is supplied (source.witness — the text
  // the notes were read from), a claim grounded only in the notes is checked against it. If the
  // source attests the same relation, the interpretation is CONFIRMED — it becomes witnessed,
  // grounded to the source, not just the engine's reading. This is the engine actively seeking
  // the witness for what it had only conjectured (active inference for grounding).
  const witnessDoc = fromDoc ? source.witness : null;
  if (witnessDoc) for (const p of docPropositions(witnessDoc)) if (p.door !== 'enactor') witnessedRel.add(relKey(p));

  // are the "spans" the WORLD, or the model's own notes? Prose sentences (and string spans) are
  // exafference; an EOT doc's "sentences" are its note-lines — reafference — so a verbatim match
  // against THEM is still interpretation, not a witnessed lift.
  const spansAreWorld = !(fromDoc && source.doc?.eot);

  const out = propsOf(answer).map((p) => {
    const inSpan = spanLC.some((s) => s.includes(p.subj) && s.includes(p.via) && (!p.obj || s.includes(p.obj)));
    const grounded = docRel.has(relKey(p));
    const grounding = inSpan ? 'verbatim' : grounded ? 'grounded' : 'fabricated';
    // the WITNESS dimension, orthogonal to grounding: a claim lifted from / grounded by the
    // WORLD is witnessed (exafference); a claim present only through the model's notes is
    // reafference — interpretation. `interpretation` flags exactly that: in the reading, but
    // not witnessed by anything outside the engine's own reading.
    const witness = grounding === 'fabricated' ? null
      : ((inSpan && spansAreWorld) || witnessedRel.has(relKey(p))) ? 'exafference' : 'reafference';
    return Object.freeze({ ...p, grounding, witnessed: grounding !== 'fabricated', witness, interpretation: witness === 'reafference' });
  });

  const summary = { verbatim: 0, grounded: 0, fabricated: 0, interpretation: 0 };
  for (const o of out) { summary[o.grounding] += 1; if (o.interpretation) summary.interpretation += 1; }
  return Object.freeze({
    propositions: out, summary,
    anyWitnessed: out.some((o) => o.witness === 'exafference'),
    allFabricated: out.length > 0 && out.every((o) => !o.witnessed),
    // every grounded claim rests only on the model's interpretation — nothing the world witnesses.
    onlyInterpretation: out.length > 0 && out.some((o) => o.witnessed) && !out.some((o) => o.witness === 'exafference'),
  });
};
