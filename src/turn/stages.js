// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// Stages are tolerant of a missing document: with no doc the pipeline
// degrades to ungrounded chat. Mechanical math still short-circuits.
//
// Vetoes are flag-only — they never substitute the model's answer.
// The user sees what the model actually said, with a flag pinned to it.

import { answerSmalltalk, answerMath, answerConfirm, answerRelation, answerWho, answerVoid } from '../answer/index.js';
import { retrieveHybrid }   from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { surfFold, namedReferents, referentialConfidence } from '../read/index.js';
import { foldConversation } from '../converse/index.js';
import { taskOf, TASK_MAX_TOKENS } from './intent.js';
import { buildGroundedMessages, buildChatMessages, orientationLine } from '../model/prompt.js';
import { bindCitations, renderBound } from '../ground/bind.js';
import { runVetoes }        from '../ground/veto.js';
import { projectGraph }     from '../core/index.js';
import { factCheck }        from '../factcheck/index.js';

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

    // Not a mechanical short-circuit → a real turn. Read the TASK register
    // (intent.js): the prompt register (summary guard) and the token ceiling — the
    // real length bound. The mechanical paths above need neither.
    if (ctx.doc) {
      const mech = answerConfirm(ctx.doc, ctx.question)
        || answerRelation(ctx.doc, ctx.question)   // "who is X's sister" — surf the graph edge
        || answerWho(ctx.doc, ctx.question);
      if (mech) return short(mech);
      return { ...ctx, route: 'grounded', ...taskOf(ctx.question) };
    }
    return { ...ctx, route: 'chat', ...taskOf(ctx.question) };
  },

  // The session fold — the conversation's own two registers, mirroring the document
  // (docs/session-fold.md). Runs for both grounded and chat turns, independent of the
  // document; the mechanical short-circuits terminate at `route` and never reach it.
  // The recent turns ride verbatim; everything older is surfed into a recap.
  async converse(ctx) {
    const conv = foldConversation(ctx.history || []);
    return {
      ...ctx,
      conversation:   { notes: conv.notes, pastTurns: conv.pastTurns },
      recentMessages: conv.recentMessages,
      lastReply:      conv.lastReply,
      convStats:      conv.stats,
    };
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

  // Fold the spans into a single note the model can read — the reading. With a doc
  // this is the consciousness: existence + structure + significance. The cursor is no
  // longer blindly the top lexical hit — the SURFER (docs/surfing-the-fold.md) is
  // seeded at that anchor and steps down the Bayesian-surprise gradient to the PEAK,
  // where the significance reading is taken. Any high-significance line retrieval
  // missed is folded in as a citable span (via:'surf', its index real), so it is both
  // read by the consciousness and bindable.
  async fold(ctx) {
    if (!ctx.spans?.length) return { ...ctx, note: null };
    const anchor = ctx.spans[0]?.idx ?? 0;
    const surf   = ctx.doc ? surfFold(ctx.doc, anchor) : null;

    let spans = ctx.spans;
    if (surf) {
      const units = ctx.doc.units || ctx.doc.sentences || [];
      const have  = new Set(spans.map(s => s.idx));
      const surfed = surf.stops
        .filter(idx => !have.has(idx) && units[idx] != null)
        .map(idx => ({ idx, text: units[idx], score: 0, via: 'surf' }));
      if (surfed.length) spans = [...spans, ...surfed];
    }

    const cursor = surf ? surf.peak : anchor;
    // The referents the message named (if any). When it names one, the fold centres
    // the structured reading on that referent — everything tied to it, coref
    // collapsed — instead of the figures the surfed window happened to cross.
    const focus  = ctx.doc ? namedReferents(ctx.doc, ctx.question) : [];
    const note   = foldNote(spans, { doc: ctx.doc, cursor, focus });
    // The reader's confidence about WHO this passage concerns — read off the
    // grounded coref posterior at the cursor (the same field the fold rode). No
    // longer measured and discarded: it rides the turn, and a diffuse field
    // (no dominant referent) becomes a flag in the veto battery.
    const referential = ctx.doc?.corefField
      ? referentialConfidence(ctx.doc.corefField.fieldGrounded(cursor))
      : null;
    return { ...ctx, spans, note, surf, focus, referential };
  },

  // The answerability gate — is there an answer to give, or is the field VOID?
  // (docs/answerability.md) Before the talker is warmed, measure whether the field
  // where the question landed holds any structure. When it does not — no referent
  // resolves, no retrieval hit is strong, and the reach is measurably flat — the turn
  // answers the typed absence directly (a DEF to VOID) instead of handing the talker
  // an empty field to invent from. A MEASUREMENT, not a refusal: the field is the
  // witness, the noise null is the verdict (read/answerable.js). Conservative by
  // construction — a short or unmeasurable field is never voided; the talker speaks.
  // Skipped without a document (pure chat has nothing to be void about); the
  // mechanical short-circuits terminate at `route` and never reach it.
  //
  // Only the default 'answer' task is gated — the SPECIFIC question that points at a
  // location on the page, where retrieval finding nothing IS the absence. A
  // whole-document task (summary / list / explain) operates over the document as a
  // whole, so retrieval-weakness is not evidence of a void — "summarize this" must
  // never come back "the document does not say." Those reach the talker; the unbound
  // and edge-grounding vetoes catch an invented claim on the way back.
  async answerable(ctx) {
    if (!ctx.doc || (ctx.task && ctx.task !== 'answer')) return ctx;
    const v = answerVoid(ctx.doc, ctx.question, ctx.spans || [], { embedder: ctx.embedder });
    if (!v) return ctx;
    return {
      ...ctx, terminate: true,
      route: 'void', mechanical: v, void: v.void,
      answer: v.text, sources: v.sources,
    };
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
          task:         ctx.task,               // the summary guard rides on a summary task
          budget:       ctx.budget,             // none by default; a caller may impose one
          conversation: ctx.conversation || {}, // session fold: notes + verbatim window
        })
      : buildChatMessages({
          question: ctx.question,
          history:  ctx.recentMessages || [],   // a chat model wants turns as turns
          notes:    ctx.conversation?.notes || '',
        });
    return {
      ...ctx,
      messages,
      promptText: messages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    };
  },

  // The model. The token ceiling is the task register's max_tokens (the real length
  // bound) — not a fixed 256. Verbatim raw output is captured in `rawOutput` for audit.
  async llm(ctx) {
    const maxTokens = ctx.maxTokens || 384;
    const raw = await ctx.model.phrase(ctx.messages, { maxTokens });
    return { ...ctx, rawOutput: raw, maxTokens };
  },

  // Mechanical citation binding. The model never wrote [sN]; we do.
  // Without spans we skip binding — the raw output is the answer.
  async bind(ctx) {
    if (!ctx.spans?.length) {
      return { ...ctx, bound: [], answer: String(ctx.rawOutput || '').trim(), sources: [] };
    }
    // The binder rides the same reading the fold sat on: the document for idf,
    // the surfer's peak (the cursor the significance reading was taken at) for
    // the γ-field tilt. Both are priors — with no doc they flatten and binding
    // is the old lexical overlap.
    const cursor = ctx.surf?.peak ?? ctx.spans[0]?.idx ?? 0;
    const bound = bindCitations(ctx.rawOutput, ctx.spans, { doc: ctx.doc, cursor });
    const answer = renderBound(bound);
    const sources = [...new Set(
      bound.filter(b => b.citation).map(b => parseInt(b.citation.slice(1), 10))
    )];
    return { ...ctx, bound, answer, sources };
  },

  // Contrast the talker's propositional assertions against the document graph.
  // (factcheck/correspond.js) We do NOT gate what the model may say — it can answer
  // from its own memory — because every claimed RELATION is adjudicated here against
  // the reading the fold built: corroborated (it matches a document edge, and EARNS
  // that edge's citation), contradicted (a carved VOID or a disjoint axiom denies it
  // — the libel-grade catch), unsupported (no witness — it rides, flagged),
  // indeterminate (cannot be measured — held). The verdicts flow into
  // ctx.edgeVerdicts, which the veto battery already reads. Flag-and-tell: the answer
  // is never gagged here. The symbolic relation algebra runs embedder-free, so a
  // disjoint-kinship contradiction fires even under the hash organ; the geometric
  // verdicts need a live classifier and otherwise degrade to indeterminate (held).
  // Skipped in chat mode (no doc) and after a measured void (terminate short-circuit).
  async factcheck(ctx) {
    if (!ctx.doc || !ctx.rawOutput) return ctx;
    const cursor = ctx.surf?.peak ?? ctx.spans?.[0]?.idx ?? Infinity;
    const graph  = projectGraph(ctx.doc.log, { cursor });
    const fc = await factCheck({
      prose: ctx.rawOutput, doc: ctx.doc, graph, cursor,
      classifier: ctx.classifier || null, adjacency: ctx.adjacency || null,
    });
    // A claim the GRAPH corroborates earns the cited sentence even when the model
    // spoke from memory: fold those citations into the answer's sources, de-duped.
    const earned = (fc.citations || [])
      .map(c => parseInt(String(c).slice(1), 10)).filter(Number.isFinite);
    const sources = earned.length ? [...new Set([...(ctx.sources || []), ...earned])] : ctx.sources;
    return { ...ctx, edgeVerdicts: fc.edgeVerdicts, factcheck: fc, sources };
  },

  // Flag-only veto pass. The answer is never substituted — the user sees
  // the model's text with the flags pinned alongside.
  // Without a doc we skip the grounding vetoes entirely.
  async veto(ctx) {
    if (!ctx.spans?.length) return { ...ctx, vetoes: [] };
    const { fired } = runVetoes({
      draft: ctx.rawOutput, bound: ctx.bound, question: ctx.question,
      referential: ctx.referential, task: ctx.task,
      // The edge-grounding verdicts the factcheck stage just deposited — the link-
      // shaped sibling of the node-level `unbound` check. Without this they were
      // computed and discarded; now a claim the graph DENIES becomes a flag.
      edgeVerdicts: ctx.edgeVerdicts,
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
