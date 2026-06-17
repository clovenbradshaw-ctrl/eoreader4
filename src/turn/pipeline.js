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
// The eoreader3 audit already named the fold
// (route · intent · ground · retrieve · traverse · llm · veto · settle);
// this commit makes the code admit it.

import { stages } from './stages.js';

const GROUNDED_PIPELINE = [
  'route', 'retrieve', 'fold', 'prompt', 'llm', 'bind', 'veto', 'settle',
];

export const runTurn = async ({ question, doc, model, embedder, auditLog }) => {
  const turn   = auditLog.turn(question);
  const onStep = (name, ctx, ms) => turn.step(name, summarize(name, ctx, ms));
  const ctx0   = { question, doc, model, embedder };

  try {
    const ctx = await GROUNDED_PIPELINE.reduce(
      async (accPromise, name) => {
        const acc = await accPromise;
        if (acc.terminate) return acc;
        const t0   = nowMs();
        const next = await stages[name](acc);
        onStep(name, next, nowMs() - t0);
        return next;
      },
      Promise.resolve(ctx0)
    );

    turn.finish({
      route:     ctx.route || 'grounded',
      prompt:    ctx.promptText || null,
      rawOutput: ctx.rawOutput  || null,
      bound:     ctx.bound      || null,
      vetoes:    ctx.vetoes     || null,
      answer:    ctx.answer     || '',
      sources:   ctx.sources    || [],
    });
    return { answer: ctx.answer, sources: ctx.sources || [], turn };
  } catch (err) {
    turn.step('error', { message: String(err?.message || err) });
    turn.finish({
      route:   'error',
      answer:  `Error: ${err?.message || err}`,
      sources: [],
    });
    return { answer: turn.answer, sources: [], turn, error: err };
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
                              fired:   ctx.vetoes?.map(v => v.id) || [],
                              refused: !!ctx.refused };
    default:         return base;
  }
};
