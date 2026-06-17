// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// This file is the seam the eoreader3 map identified as the highest-value
// cut: the 760-line `runGroundedScope` becomes a list of small,
// independently testable steps. Adding a stage = adding an entry here
// and in `pipeline.js`. Removing one = the opposite.

import { tryMechanical }    from '../answer/index.js';
import { retrieveHybrid }   from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { buildGroundedMessages } from '../model/prompt.js';
import { bindCitations, renderBound } from '../ground/bind.js';
import { runVetoes }        from '../ground/veto.js';

export const stages = {

  // Cheapest paths first. The model never warms for a question we can
  // answer mechanically.
  async route(ctx) {
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
  },

  // Hybrid retrieval. The query embedding is computed at most once per
  // turn inside retrieveSemantic and re-used by impression / form.
  async retrieve(ctx) {
    const spans = await retrieveHybrid(ctx.doc, ctx.question, ctx.embedder, 6);
    if (spans.length === 0) {
      return {
        ...ctx,
        spans: [],
        route: 'chat',
        terminate: true,
        answer: '(Nothing in the document matches that question.)',
        sources: [],
      };
    }
    return { ...ctx, spans };
  },

  // Fold the spans into a single note the model can read.
  async fold(ctx) {
    const note = foldNote(ctx.spans);
    return { ...ctx, note };
  },

  // Build the messages. System prompt is stable; only the user content varies.
  async prompt(ctx) {
    const messages = buildGroundedMessages({ question: ctx.question, spans: ctx.spans });
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
  async bind(ctx) {
    const bound = bindCitations(ctx.rawOutput, ctx.spans);
    const answer = renderBound(bound);
    const sources = [...new Set(
      bound.filter(b => b.citation).map(b => parseInt(b.citation.slice(1), 10))
    )];
    return { ...ctx, bound, answer, sources };
  },

  // The veto battery. Refuses are honest; flags ride alongside the answer.
  async veto(ctx) {
    const { fired, refuse } = runVetoes({
      draft: ctx.rawOutput, bound: ctx.bound, question: ctx.question,
    });
    let answer = ctx.answer;
    let sources = ctx.sources;
    if (refuse) {
      answer = '(The model did not produce a grounded answer for this question.)';
      sources = [];
    }
    return { ...ctx, vetoes: fired, answer, sources, refused: refuse };
  },

  // Settle: a placeholder for conversation-field updates and form stamps.
  // Kept here as a named stage so the place is obvious for the next change.
  async settle(ctx) {
    return ctx;
  },
};
