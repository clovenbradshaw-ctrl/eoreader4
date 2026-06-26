// The phraser → talker hand-off.
//
// This engine is the PHRASER: it determines WHAT to say — grounded propositions read off the
// document's own graph, provenance-stamped and fabrication-incapable — plus a telegraphic
// draft already realised (referring expressions, tense, aggregation). An LLM TALKER then only
// makes it FLUENT. The talker decides no content: the brief gives it the determined
// propositions, the prompt forbids adding any, and the post-check (classifyProvenance) strips
// whatever it adds anyway. So the output is fluent AND fabrication-incapable — content and
// grounding are ours, wording is the talker's, and the veto closes the loop. This is the
// honest place for a model: surface realisation behind a propositional veto, never content.

import { speakConcept } from './traverse.js';
import { classifyProvenance } from '../ground/index.js';

// phraserBrief(doc, opts) → the determined content for a talker.
//   propositions  the grounded subject–relation–object triples (the facts, no wording choice)
//   draft         our own telegraphic realisation (referring/tense/aggregation already done)
//   plan          the underlying plan (for provenance / audit)
export const phraserBrief = (doc, opts = {}) => {
  const spoken = speakConcept(doc, opts);
  const propositions = (spoken.plan || []).map((p) => ({
    subj: p.subj?.name ?? p.subj,
    verb: p.verb,
    obj: p.obj && p.obj.name != null ? p.obj.name : (typeof p.obj === 'string' ? p.obj : null),
  }));
  return Object.freeze({ propositions, draft: spoken.text, plan: spoken.plan });
};

// realizationPrompt(brief) → the constrained instruction a talker realises FROM.
//
// The contract follows the veto (ground/provenance.js): a proposition is kept only if its
// RELATION survives between its figures, so the prompt licenses exactly the surface freedom
// that keeps the relation intact and forbids the rest. The talker SCAFFOLDS — articles,
// prepositions, conjunctions, pronoun-vs-name, sentence flow — and KEEPS every verb and every
// participant. It does not author: no new noun, name, verb, action, or claim. What it adds
// beyond the facts the post-check strips, so the prompt and the veto say the same thing.
export const realizationPrompt = (brief) => Object.freeze({
  system: 'You are a surface realizer, not an author. You are given a list of facts, each a '
    + 'subject, a verb, and (sometimes) an object. Rewrite them as fluent, natural English. '
    + 'You MAY: add articles (a/the), prepositions, and connectives; choose a pronoun or the '
    + 'name; reorder or join sentences; fix agreement and tense. You MUST NOT: change or drop '
    + 'any verb, add any new noun/name/verb/action, or state anything not given. Every fact '
    + 'must reappear with its verb and its participants intact. If a fact resists fluent '
    + 'phrasing, keep it plain rather than invent — anything you add that is not in the facts '
    + 'will be removed.',
  user: 'Facts (subject — verb — object):\n'
    + brief.propositions.map((p) => `- ${p.subj} — ${p.verb}${p.obj ? ' — ' + p.obj : ''}`).join('\n')
    + `\n\nReference draft (already grounded; smooth it, keep its verbs): ${brief.draft}`
    + '\n\nFluent prose:',
});

// talkThenVerify(brief, model, { doc }) → realise via the talker, then VETO its drift.
// Returns the talker's prose, the per-proposition provenance against the document, and the
// list of fabricated propositions it smuggled in (which a caller suppresses or flags).
export const talkThenVerify = async (brief, model, { doc } = {}) => {
  const { system, user } = realizationPrompt(brief);
  const fluent = String((await model.phrase([{ role: 'system', content: system }, { role: 'user', content: user }])) ?? '');
  const provenance = doc ? classifyProvenance(fluent, { doc }) : null;
  const drift = provenance ? provenance.propositions.filter((p) => p.grounding === 'fabricated') : [];
  return Object.freeze({ fluent, provenance, drift, clean: drift.length === 0 });
};
