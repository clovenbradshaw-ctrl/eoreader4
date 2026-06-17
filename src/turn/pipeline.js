// runTurn — the turn is a fold of its named stages.
//
// stages.reduce(...) over the pipeline list; each stage takes a context
// and returns a context; a stage returning {terminate:true} short-
// circuits the rest. The audit's step entry is the projection of that
// fold via the onStep callback — there is no parallel bookkeeping to drift.
//
// Same spine, two levels:
//   document = fold of the event log → projectGraph
//   turn     = fold of the stage list → audit log
//
// Vetoes are flag-only here too: the answer is the model's text, the
// vetoes ride alongside as `flags`.

import { stages } from './stages.js';

const PIPELINE = [
  'route', 'retrieve', 'fold', 'prompt', 'llm', 'bind', 'veto', 'settle',
];

export const runTurn = async ({ question, doc, model, embedder, auditLog, onStep }) => {
  const turn      = auditLog.turn(question);
  const stepFan   = (name, ctx, ms) => {
    const data = summarize(name, ctx, ms);
    turn.step(name, data);
    onStep?.(name, ctx, data);
  };
  const ctx0      = { question, doc, model, embedder };

  try {
    const ctx = await PIPELINE.reduce(
      async (accPromise, name) => {
        const acc = await accPromise;
        if (acc.terminate) return acc;
        const t0   = nowMs();
        const next = await stages[name](acc);
        stepFan(name, next, nowMs() - t0);
        return next;
      },
      Promise.resolve(ctx0)
    );

    const flags = (ctx.vetoes || []).map(v => ({
      id: v.id, message: v.message, refuses: v.refuses,
    }));

    turn.finish({
      route:     ctx.route || 'grounded',
      prompt:    ctx.promptText || null,
      rawOutput: ctx.rawOutput  || null,
      bound:     ctx.bound      || null,
      vetoes:    ctx.vetoes     || null,
      answer:    ctx.answer     || '',
      sources:   ctx.sources    || [],
      flags,
    });
    return { answer: ctx.answer, sources: ctx.sources || [], flags, turn };
  } catch (err) {
    turn.step('error', { message: String(err?.message || err) });
    turn.finish({
      route:   'error',
      answer:  `Error: ${err?.message || err}`,
      sources: [],
      flags:   [],
    });
    return { answer: turn.answer, sources: [], flags: [], turn, error: err };
  }
};

const nowMs = () =>
  (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

const summarize = (name, ctx, ms) => {
  const base = { ms: Math.round(ms) };
  switch (name) {
    case 'route':    return { ...base, route: ctx.route };
    case 'retrieve': return { ...base, n: ctx.spans?.length || 0, top: ctx.spans?.[0]?.score || 0 };
    case 'fold':     return { ...base, noteLen: ctx.note?.text?.length || 0 };
    case 'prompt':   return { ...base, promptLen: ctx.promptText?.length || 0 };
    case 'llm':      return { ...base, outputLen: ctx.rawOutput?.length || 0 };
    case 'bind':     return { ...base,
                              claims: ctx.bound?.length || 0,
                              cited:  ctx.bound?.filter(b => b.citation).length || 0 };
    case 'veto':     return { ...base,
                              fired:   ctx.vetoes?.map(v => v.id) || [] };
    default:         return base;
  }
};
