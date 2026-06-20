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

// route → converse → retrieve → fold → answerable → prompt → llm → bind → factcheck → revise → veto → settle.
// `converse` (the session fold) sits right after `route`, before retrieval — it runs
// for both grounded and chat turns and is independent of the document. The mechanical
// short-circuits (smalltalk, math) terminate at `route` and never reach it; they need
// no history. `factcheck` sits between `bind` and `veto`: it contrasts the talker's
// propositional assertions against the document graph and deposits the per-claim
// verdicts the veto battery reads (the answer is never gagged — flag-and-tell).
// `revise` sits between `factcheck` and `veto`: when the diagonal guard caught the
// confabulation proper (a specific claim at a measured void), it re-prompts the talker
// once; a surviving confabulation ships, tagged by the veto (rewrite-then-tag).
const PIPELINE = [
  'route', 'converse', 'retrieve', 'fold', 'answerable', 'prompt', 'llm', 'bind', 'factcheck', 'revise', 'veto', 'settle',
];

// `classifier`/`adjacency` are the geometric organ the edge-grounding fact-check needs
// for its meaning-distance verdicts; threaded through like `embedder`, optional, and
// degrading honestly to the embedder-free symbolic algebra when absent.
export const runTurn = async ({ question, doc, model, embedder, classifier, adjacency, auditLog, onStep, history = [] }) => {
  const turn      = auditLog.turn(question);
  const stepFan   = (name, ctx, ms) => {
    const data = summarize(name, ctx, ms);
    turn.step(name, data);
    onStep?.(name, ctx, data);
  };
  const ctx0      = { question, doc, model, embedder, classifier, adjacency, history };

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
      referential: ctx.referential || null,
      flags,
    });
    return { answer: ctx.answer, sources: ctx.sources || [], referential: ctx.referential || null, flags, turn };
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
    case 'route':    return { ...base, route: ctx.route, task: ctx.task };
    case 'converse': return { ...base, recent: ctx.convStats?.recent || 0,
                              folded: ctx.convStats?.folded || 0, notesLen: ctx.convStats?.notesLen || 0 };
    case 'retrieve': return { ...base, n: ctx.spans?.length || 0, top: ctx.spans?.[0]?.score || 0 };
    case 'fold':     return { ...base, noteLen: ctx.note?.text?.length || 0,
                              referential: ctx.referential || null,
                              surf: ctx.surf ? {
                                anchor: ctx.surf.anchor, peak: ctx.surf.peak, stops: ctx.surf.stops,
                                focus:  ctx.surf.focus,  recs: ctx.surf.recCursors, rode: ctx.surf.rode,
                              } : null };
    case 'answerable': return ctx.voidMeasure
      ? { ...base, verdict: 'answer', terrain: 'void', kind: ctx.voidMeasure.kind, rode: ctx.voidMeasure.rode }
      : { ...base, verdict: 'answer' };
    case 'prompt':   return { ...base, promptLen: ctx.promptText?.length || 0 };
    case 'llm':      return { ...base, outputLen: ctx.rawOutput?.length || 0, maxTokens: ctx.maxTokens };
    case 'bind':     return { ...base,
                              claims: ctx.bound?.length || 0,
                              cited:  ctx.bound?.filter(b => b.citation).length || 0 };
    case 'factcheck': return { ...base,
                              corroborated:  ctx.factcheck?.counts?.corroborated  || 0,
                              contradicted:  ctx.factcheck?.counts?.contradicted  || 0,
                              unsupported:   ctx.factcheck?.counts?.unsupported   || 0,
                              indeterminate: ctx.factcheck?.counts?.indeterminate || 0,
                              offDiagonal:   ctx.factcheck?.counts?.offDiagonal   || 0,
                              refuse:        ctx.factcheck?.refuse || false };
    case 'revise':   return { ...base,
                              attempts: ctx.revised?.attempts || 0,
                              resolved: ctx.revised?.resolved ?? null };
    case 'veto':     return { ...base,
                              fired:   ctx.vetoes?.map(v => v.id) || [] };
    default:         return base;
  }
};
