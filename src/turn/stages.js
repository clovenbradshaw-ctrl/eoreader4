// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// Stages are tolerant of a missing document: with no doc the pipeline
// degrades to ungrounded chat. Mechanical math still short-circuits.
//
// Vetoes are flag-only — they never substitute the model's answer.
// The user sees what the model actually said, with a flag pinned to it.

import { answerSmalltalk, answerMath, answerConfirm, answerWho } from '../answer/index.js';
import { retrieveHybrid }   from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { buildGroundedMessages, buildChatMessages, orientationLine } from '../model/prompt.js';
import { bindCitations, renderBound } from '../ground/bind.js';
import { runVetoes }        from '../ground/veto.js';

export const stages = {

  // Cheapest, model-free paths first — and routing is now intent-aware.
  //   smalltalk → a greeting is never grounded against the document.
  //   math      → arithmetic, with or without a doc.
  //   who/confirm → mechanical lookups when a doc is open.
  //   else      → grounded (doc) or chat (no doc).
  async route(ctx) {
    const short = (m) => ({
      ...ctx, route: m.route, mechanical: m, terminate: true,
      answer: m.text, sources: m.sources || [],
    });

    const sm = answerSmalltalk(ctx.question);
    if (sm) return short(sm);

    const math = answerMath(ctx.question);
    if (math) return short(math);

    if (ctx.doc) {
      const mech = answerConfirm(ctx.doc, ctx.question) || answerWho(ctx.doc, ctx.question);
      if (mech) return short(mech);
      return { ...ctx, route: 'grounded' };
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

  // Fold the spans into a single note the model can read — the reading. With
  // a doc this is the consciousness: existence + structure + significance,
  // read around the best-scoring span as the cursor.
  async fold(ctx) {
    if (!ctx.spans?.length) return { ...ctx, note: null };
    const cursor = ctx.spans[0]?.idx ?? null;
    const note = foldNote(ctx.spans, { doc: ctx.doc, cursor });
    return { ...ctx, note };
  },

  // Build messages. Grounded when we have spans; plain chat when we don't.
  // The talker is fed the FOLD (the document notes) PLUS the verbatim excerpts —
  // never spans alone. The fold's output, which the audit used to record and then
  // discard, now reaches the prompt. Notes and excerpts are built from the same
  // spans/cursor upstream, so the structured reading and the verbatim cohere (§6).
  async prompt(ctx) {
    const messages = ctx.spans?.length
      ? buildGroundedMessages({
          question:     ctx.question,
          spans:        ctx.spans,
          notes:        ctx.note?.text || '',
          orientation:  orientationOf(ctx.doc),
          budget:       ctx.budget,             // route/turn config; defaults inside
          conversation: ctx.conversation || {}, // session fold + past turns (seam)
          lastReply:    ctx.lastReply || '',
        })
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

// Orientation WITHOUT recognition (§3): the talker is handed the FILENAME, the
// type, and the length — never the title the document metadata may carry, never
// the author or genre. We read the filename off `docId` (the ingest sets it from
// the file name) and never off any extracted title.
const orientationOf = (doc) => {
  if (!doc) return '';
  const units = doc.units || doc.sentences || [];
  return orientationLine({
    filename: doc.docId || 'the document',
    type:     doc.modality === 'image' ? 'image' : 'text',
    length:   units.length,
  });
};
