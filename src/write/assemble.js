// Assemble what the LLM would be told — the whole reading pipeline in one place.
//
// Every piece we built converges here. Given a document and the activated conversation thread,
// this runs: thread salience (the Born rule over terms · figures · links) → an adaptive surf
// that keeps as much as is salient → the salient relation edges → the EO-enriched RDF-star
// brief (each triple annotated with operator · site · band · order · door) → the realization
// prompt. The return is exactly the system+user the talker would receive, plus the structure
// behind it (the salient stops, the focus's trajectory) so the decision is legible. Nothing
// here decides content the model could fabricate — it selects, from the graph, what is grounded
// and salient, and hands it over in a notation the model can consume.

import { surfFold, threadBasis, trajectory } from '../surfer/index.js';
import { rdfRealizationPrompt, briefRDF } from './rdf.js';
import { speakTriples } from './brief.js';

// the doc's CON/SIG edges at the given sentence stops, as {subj, verb, obj} label triples,
// in arrow-of-time order — the salient propositions, the content the prompt is built from.
const edgesAtStops = (doc, stops, max) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, e.label);
  const L = (id) => label.get(id) ?? id;
  const out = [];
  for (const e of events) {
    if (!((e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null)) continue;
    if (stops && e.sentIdx != null && !stops.has(e.sentIdx)) continue;
    out.push({ subj: L(e.src), verb: String(e.via), obj: e.tgt != null ? L(e.tgt) : null });
    if (out.length >= max) break;
  }
  return out;
};

// assembleBrief(doc, { question, history, max }) → the LLM-facing payload + the reasoning.
//   prompt        { system, user } — EXACTLY what the talker would be handed (RDF-star, EO-
//                 annotated, restricted to the salient stops)
//   propositions  the salient edges as plain triples (the no-LLM render reads these)
//   draft         speakTriples over them — the natural-speech the engine produces with no LLM
//   thread        the activated figures the salience rode
//   surf          { peak, stops, recCursors, focus } — what the surfer kept and why
//   trajectory    the focus's arc (a Network reading), when a focus settled
export const assembleBrief = (doc, { question = '', history = [], max = 24 } = {}) => {
  const thread = threadBasis({ query: question, history, doc });
  const hasThread = thread.terms.size > 0 || thread.figures.size > 0;
  // adaptive reach reads the whole field; the thread (when present) conditions salience so the
  // surf keeps only what the conversation is about — "as much as it needs", bounded by salience.
  const surf = surfFold(doc, 0, hasThread ? { reach: 'adaptive', thread } : { reach: 'adaptive' });
  const stops = new Set(surf.stops);
  const only = stops.size ? stops : null;

  const propositions = edgesAtStops(doc, only, max);
  const prompt = rdfRealizationPrompt(doc, { max, only });
  const draft = speakTriples(propositions, {});
  const traj = surf.focus ? trajectory(doc, { focus: surf.focus, segments: surf.recCursors }) : null;

  return Object.freeze({
    prompt,
    propositions,
    draft,
    rdf: briefRDF(doc, { max, only }),
    thread: [...thread.figures],
    surf: { peak: surf.peak, stops: surf.stops, recCursors: surf.recCursors, focus: surf.focus },
    trajectory: traj,
  });
};
