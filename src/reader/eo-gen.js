// eo-gen — the generation pipeline, exposed to the chat app (browser).
//
// The shipped reader answers an "essay" ask with a capped grounded blurb (answerQuestion →
// three sentences). This wires src/longgen into the app so an essay ask instead WALKS THE
// ARC — open, develop, turn, land — over a rich ground: self-register (edge ops on the self),
// the field read (turns), decision-as-relaxation (the cadence emerges), NUL (hold uncohered
// ground honestly), and the audit. It is a thin adapter: the app builds a ground and hands its
// own talker; this runs runContinuation and returns the joined prose plus the audit.
//
// Loaded as a module by index.html; sets window.eoGen. The app checks for it and routes essay
// intents through eoGen.essay when the setting is on (default on), else keeps its old path.

import { runContinuation, exportAudit } from '../longgen/index.js';
import { composeEssay, ESSAY_MIN_WORDS } from '../organs/out/essay.js';
import * as essayTypes from '../organs/out/essay-types.js';
import { streamPhrase } from '../model/stream.js';
import { bindCitations, CONTACT_FLOOR } from '../ground/bind.js';

// THE ESSAY SPAN-BINDER — the same cite-or-veto grounding normal chat uses (ground/bind.js),
// adapted to the essay organ's bind(text, spans) → { kept, struck, boundFraction } contract.
// composeEssay walks free prose; when the app gathered research it injects this so each section
// is bound to the REAL sources. bindCitations splits the section into claims and cites each
// against the spans (no doc → pure lexical, idf flat). A claim that cites nothing AND makes no
// lexical contact with any span (score ≤ CONTACT_FLOOR) is prose from nowhere — a fabricated fact
// or invented mechanism — so it is STRUCK. A cited claim, or one that at least contacts a span
// (a paraphrase the lexical binder can't pin to one sentence), RIDES. boundFraction is the cited
// share — the honest number behind the "grounded in N sources" banner. This is the check that
// catches fake FACTS, which the surface veto (fake scholarship) cannot.
const essayBinder = (draft, spans = []) => {
  const text = String(draft || '');
  const bound = bindCitations(text, Array.isArray(spans) ? spans : []);
  if (!bound.length) return { kept: text, struck: [], boundFraction: 1 };
  const kept = [];
  const struck = [];
  for (const b of bound) {
    if (!b.citation && (b.score || 0) <= CONTACT_FLOOR) struck.push(b.claim);
    else kept.push(b.claim);
  }
  const cited = bound.filter((b) => b.citation).length;
  return { kept: kept.join(' '), struck, boundFraction: cited / bound.length };
};

// Build the pipeline ground from the app's scored spans. Each span is {text, score, i, u};
// runContinuation wants {idx, score, text} ranked. Keep the source url on the side so the
// answer can still cite. A rich ground (many spans) is what lets the arc actually develop.
const toGround = (spans = []) => spans
  .filter((s) => s && s.text)
  .map((s, k) => ({ idx: s.i ?? k, score: Number.isFinite(s.score) ? s.score : 1, text: String(s.text), u: s.u }));

// Compose an essay over the ground with the app's talker. `embed` (the app's MiniLM organ)
// turns on the semantic field read when provided. Returns { text, audit, stop, moves, sources }.
const essay = async ({ spans = [], model, embed = null, question = '', signal = null } = {}) => {
  const ground = toGround(spans);
  const cfg = {
    arc: true, temperature: 1, maxSteps: 40,
    selfRegister: true, dynamics: true, confine: true, nul: true,
    fieldRead: !!embed, embed: embed || undefined,
  };
  const res = await runContinuation({ ground, model, question, signal, ...cfg });
  const audit = exportAudit(res, { config: { ...cfg, embed: !!embed }, question, label: 'app-essay' });
  // The atoms, joined as prose. NUL / refusal returns its single honest atom.
  const text = res.units.map((u) => u.text).filter(Boolean).join(' ');
  // The source urls the cited spans came from (by idx → span.u).
  const byIdx = new Map(ground.map((g) => [g.idx, g.u]));
  const sources = [...new Set(res.sources.map((i) => byIdx.get(i)).filter(Boolean))];
  return { text, audit, stop: res.stop, moves: res.units.map((u) => u.move), sources, units: res.units };
};

// ── THE ESSAY ORGAN, for the reader's chat (organs/out/essay.js + essay-types.js) ──
//
// Distinct from `essay` above (the longgen arc over a READING ground): this is the
// commission-driven organ — plan an outline, walk section after section until the piece
// clears the ≥2500-word floor, land on a conclusion — steered by a learned essay TYPE
// (cue + plan hints + word target, essay-types.steerFrom). The app hands its chat model;
// the talker is streamPhrase over it, so hooks.onToken streams live. The app owns the
// type profiles (persistence) and the thinking-trail beats; this is the pure walk.
// `ground` (optional) is the research the app gathered before commissioning the essay — excerpts
// from the web walk it ran and/or the reading already in scope. Passed through to composeEssay so
// the plan and every section are written grounded in real sources instead of the model's thin prior.
const essayCompose = ({ model, topic, signal = null, cue = null, planHints = null, targetPerSection = undefined, ground = null, hooks = {} } = {}) =>
  composeEssay({
    topic,
    talker: (messages, opts) => streamPhrase(model, messages, opts),
    signal, cue, planHints,
    ...(targetPerSection ? { targetPerSection } : {}),
    ...(ground ? { ground, bind: essayBinder } : {}),
    hooks,
  });

if (typeof window !== 'undefined') {
  window.eoGen = { essay, toGround, essayCompose, essayBinder, essayTypes, ESSAY_MIN_WORDS, version: 2 };
  window.dispatchEvent(new Event('eogen-ready'));
}

export { essay, toGround, essayCompose, essayBinder, essayTypes, ESSAY_MIN_WORDS };
