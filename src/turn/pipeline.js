// runTurn — composes the named stages under one audit record.
//
// Each stage gets one audit step around it. A stage returning {terminate:true}
// short-circuits the rest — mechanical routes never run the LLM stage.

import { stages } from './stages.js';

const GROUNDED_PIPELINE = [
  'route', 'retrieve', 'fold', 'prompt', 'llm', 'bind', 'veto', 'settle',
];

export const runTurn = async ({ question, doc, model, embedder, auditLog }) => {
  const turn = auditLog.turn(question);
  let ctx = { question, doc, model, embedder };
  try {
    for (const name of GROUNDED_PIPELINE) {
      const t0 = nowMs();
      ctx = await stages[name](ctx);
      turn.step(name, summarize(name, ctx, nowMs() - t0));
      if (ctx.terminate) break;
    }
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
      route: 'error',
      answer: `Error: ${err?.message || err}`,
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
