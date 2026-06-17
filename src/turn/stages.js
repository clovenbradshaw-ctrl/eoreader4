// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// Stages are tolerant of a missing document: with no doc the pipeline
// degrades to ungrounded chat. Mechanical math still short-circuits.
//
// Vetoes are flag-only — they never substitute the model's answer.
// The user sees what the model actually said, with a flag pinned to it.

import { tryMechanical, answerMath } from '../answer/index.js';
import { retrieveHybrid }   from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { buildGroundedMessages, buildChatMessages } from '../model/prompt.js';
import { bindCitations, renderBound } from '../ground/bind.js';
import { runVetoes }        from '../ground/veto.js';

export const stages = {

  // Cheapest paths first. Math always works; the other mechanicals need a doc.
  async route(ctx) {
    if (ctx.doc) {
      const mech = tryMechanical(ctx.doc, ctx.question);
      if (mech) {
        return {
          ...ctx,
          route: mech.route,
          mechanical: mech,
          terminate: true,
          answer:  mech.text,
          sources: mech.sources,
        };
      }
      return { ...ctx, route: 'grounded' };
    }
    const m = answerMath(ctx.question);
    if (m) {
      return {
        ...ctx,
        route: m.route,
        mechanical: m,
        terminate: true,
        answer:  m.text,
        sources: [],
      };
    }
    return { ...ctx, route: 'chat' };
  },

  // Hybrid retrieval. Skipped entirely when there's no document — chat mode
  // simply has nothing to retrieve.
  async retrieve(ctx) {
    if (!ctx.doc) return { ...ctx, spans: [] };
    const spans = await retrieveHybrid(ctx.doc, ctx.question, ctx.embedder, 6);
    if (spans.length === 0) {
      // Doc loaded but nothing matches — fall through to ungrounded chat.
      return { ...ctx, spans: [], route: 'chat' };
    }
    return { ...ctx, spans };
  },

  // Fold the spans into a single note the model can read.
  async fold(ctx) {
    if (!ctx.spans?.length) return { ...ctx, note: null };
    const note = foldNote(ctx.spans);
    return { ...ctx, note };
  },

  // Build messages. Grounded when we have spans; plain chat when we don't.
  async prompt(ctx) {
    const messages = ctx.spans?.length
      ? buildGroundedMessages({ question: ctx.question, spans: ctx.spans })
      : buildChatMessages({ question: ctx.question });
    return {
      ...ctx,
      messages,
      promptText: messages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    };
  },

  // The model. Verbatim raw output is captured in `rawOutput` for audit.
  async llm(ctx) {
    const raw = await ctx.model.phrase(ctx.messages, { maxTokens: 256 });
    return { ...ctx, rawOutput: raw };
  },

  // Mechanical citation binding. The model never wrote [sN]; we do.
  // Without spans we skip binding — the raw output is the answer.
  async bind(ctx) {
    if (!ctx.spans?.length) {
      return { ...ctx, bound: [], answer: String(ctx.rawOutput || '').trim(), sources: [] };
    }
    const bound = bindCitations(ctx.rawOutput, ctx.spans);
    const answer = renderBound(bound);
    const sources = [...new Set(
      bound.filter(b => b.citation).map(b => parseInt(b.citation.slice(1), 10))
    )];
    return { ...ctx, bound, answer, sources };
  },

  // Flag-only veto pass. The answer is never substituted — the user sees
  // the model's text with the flags pinned alongside.
  // Without a doc we skip the grounding vetoes entirely.
  async veto(ctx) {
    if (!ctx.spans?.length) return { ...ctx, vetoes: [] };
    const { fired } = runVetoes({
      draft: ctx.rawOutput, bound: ctx.bound, question: ctx.question,
    });
    return { ...ctx, vetoes: fired };
  },

  // Settle: a placeholder for conversation-field updates and form stamps.
  // Kept here as a named stage so the place is obvious for the next change.
  async settle(ctx) {
    return ctx;
  },
};
