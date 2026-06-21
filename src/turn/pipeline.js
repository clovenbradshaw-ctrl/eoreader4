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
import { createCompositeDoc } from '../organs/in/index.js';

// The documents a turn's citations actually drew on. For a composite (several selected
// documents folded into one), map each cited sentence index back through the provenance
// axis to its source document; for a single document it is just that document.
const sourceDocsOf = (doc, sources) => {
  if (!doc) return [];
  if (doc.isComposite && typeof doc.origin === 'function')
    return [...new Set((sources || []).map(i => doc.origin(i)?.docId).filter(Boolean))];
  return doc.docId ? [doc.docId] : [];
};

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
export const runTurn = async ({ question, doc, docs, model, embedder, geometricEmbedder, classifier, adjacency, auditLog, onStep, history = [], grounding = 'auto' }) => {
  // Ground against a SELECTED SET of documents when one is given: several parsed docs
  // are folded into one composite doc (organs/in/composite.js) the pipeline reads as a
  // single document — referents stay distinct per source unless cross-doc SYN'd. A
  // single doc passes through untouched; the legacy `doc` argument still works.
  const groundingDoc = (Array.isArray(docs) && docs.length) ? createCompositeDoc(docs) : (doc || null);
  const turn      = auditLog.turn(question);
  const stepFan   = (name, ctx, ms) => {
    const data = summarize(name, ctx, ms);
    turn.step(name, data);
    onStep?.(name, ctx, data);
  };
  // `geometricEmbedder` is the MiniLM organ; the retrieve stage reads it for the
  // semantic channel when it is live, and falls back to `embedder` (the hash organ)
  // otherwise. Threaded like `classifier` — optional, degrading honestly when absent.
  const ctx0      = { question, doc: groundingDoc, model, embedder, geometricEmbedder, classifier, adjacency, history, grounding };

  // The answer is FORMED at `bind` and only ANNOTATED after it (factcheck, revise,
  // veto, settle). Those annotation stages must never discard an answer the model
  // already produced: when one throws — the observed failure was the geometric
  // classifier's MiniLM/onnxruntime-web backend faulting transiently inside
  // `factcheck` — we keep the bound answer, record the fault in the trail, and flag
  // the turn, rather than collapsing it to a dead "Error:" the user can't act on.
  // A failure BEFORE the answer exists is genuinely fatal and falls to the catch.
  const degraded = [];

  try {
    const ctx = await PIPELINE.reduce(
      async (accPromise, name) => {
        const acc = await accPromise;
        if (acc.terminate) return acc;
        const t0   = nowMs();
        try {
          const next = await stages[name](acc);
          stepFan(name, next, nowMs() - t0);
          return next;
        } catch (err) {
          const message = String(err?.message || err);
          if (acc.answer != null) {
            // Post-answer (annotation) failure — salvage the answer, keep going so the
            // remaining annotation stages still run, and flag the gap.
            turn.step('error', { stage: name, message, fatal: false });
            degraded.push(name);
            return acc;
          }
          throw err;   // pre-answer failure — there is no answer to salvage
        }
      },
      Promise.resolve(ctx0)
    );

    const flags = (ctx.vetoes || []).map(v => ({
      id: v.id, message: v.message, refuses: v.refuses,
    }));
    // A post-answer annotation stage failed: the answer rides, with an honest flag
    // that the grounding check behind it could not complete.
    if (degraded.length) flags.push({
      id: 'grounding-incomplete', refuses: false,
      message: `A grounding step (${degraded.join(', ')}) could not complete, so the answer is shown without that verification.`,
    });

    turn.finish({
      route:     ctx.route || 'grounded',
      grounding,                                  // the register the user selected (audit trail)
      prompt:    ctx.promptText || null,
      rawOutput: ctx.rawOutput  || null,
      bound:     ctx.bound      || null,
      vetoes:    ctx.vetoes     || null,
      answer:    ctx.answer     || '',
      sources:   ctx.sources    || [],
      referential: ctx.referential || null,
      // Whether the hard floor GATED — substituted a typed decline for an ungrounded /
      // denied draft. The draft survives in `revisions`; the answer is the honest word.
      gated: ctx.gated || false,
      // The superseded drafts (a confabulation rewritten, or a draft the floor gated),
      // preserved beside the answer that replaced them (never erased — turn/stages.js).
      // This is the conversational record's SEG/retract: correction beside error, both
      // visible in the trail.
      revisions: ctx.revisions || null,
      flags,
    });
    return {
      answer: ctx.answer, sources: ctx.sources || [],
      sourceDocs: sourceDocsOf(groundingDoc, ctx.sources),
      referential: ctx.referential || null, flags,
      route: ctx.route || 'grounded', grounding, turn,
    };
  } catch (err) {
    turn.step('error', { message: String(err?.message || err) });
    turn.finish({
      route:   'error',
      grounding,
      answer:  `Error: ${err?.message || err}`,
      sources: [],
      flags:   [],
    });
    return { answer: turn.answer, sources: [], sourceDocs: [], flags: [], route: 'error', grounding, turn, error: err };
  }
};

const nowMs = () =>
  (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();

const summarize = (name, ctx, ms) => {
  const base = { ms: Math.round(ms) };
  switch (name) {
    case 'route':    return { ...base, route: ctx.route, task: ctx.task, grounding: ctx.grounding };
    case 'converse': return { ...base, recent: ctx.convStats?.recent || 0,
                              folded: ctx.convStats?.folded || 0, notesLen: ctx.convStats?.notesLen || 0 };
    case 'retrieve': return { ...base, n: ctx.spans?.length || 0, top: ctx.spans?.[0]?.score || 0,
                              // the conversation-resolved query, shown only when it differs from the raw question
                              ...(ctx.retrievalQuery && ctx.retrievalQuery !== ctx.question ? { q: ctx.retrievalQuery } : {}) };
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
                              resolved: ctx.revised?.resolved ?? null,
                              // the superseded draft(s) ride in the step trail too, verbatim
                              superseded: (ctx.revisions || []).map(r => r.draft) };
    case 'veto':     return { ...base,
                              fired:   ctx.vetoes?.map(v => v.id) || [] };
    default:         return base;
  }
};
