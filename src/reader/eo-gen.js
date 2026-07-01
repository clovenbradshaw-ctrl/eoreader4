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

if (typeof window !== 'undefined') {
  window.eoGen = { essay, toGround, version: 1 };
  window.dispatchEvent(new Event('eogen-ready'));
}

export { essay, toGround };
