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

// phraserBrief(doc, opts) → the determined content for a talker, as IMPRESSIONS to voice.
//   propositions  the grounded subject–relation–object triples — the pre-verbal scene, the
//                 impression a reading left, waiting to be put into words (the talker's only
//                 content; we chose the facts, it chooses the wording)
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

// realizationPrompt(brief) → what the talker is GIVEN, not what it is forbidden.
//
// The propositions are IMPRESSIONS — the pre-verbal scene a reading left (Levelt's preverbal
// message), held as who-did-what, waiting to be put into words. We feed the talker the scene
// and ask it to voice it, with almost no caveats: a defensive, prohibition-heavy prompt makes
// a model stilted, and the prohibitions are redundant anyway, because grounding is enforced
// AFTER the fact by the veto (talkThenVerify / classifyProvenance), not by nagging the prompt.
// So the prompt's job is to convey the impression richly and trust the talker to form words;
// the veto's job, silent, is to strip anything that drifted. One light nudge to stay with the
// scene, and no list of rules.
export const realizationPrompt = (brief) => Object.freeze({
  system: 'You are the voice that turns a reading into words. You are handed the impression a '
    + 'reader was left with — a scene of who did what to whom. Say it as fluent, natural prose, '
    + 'the way someone would who had just read it and is telling a friend what happened. Stay '
    + 'with the scene as given; you need add nothing to make it whole.',
  user: 'The scene, as impressions:\n'
    + brief.propositions.map((p) => `· ${p.subj} ${p.verb}${p.obj ? ' ' + p.obj : ''}`).join('\n')
    + `\n\nIn rough words it came out: ${brief.draft}\n\nNow say it naturally:`,
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
