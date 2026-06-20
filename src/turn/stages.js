// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// Stages are tolerant of a missing document: with no doc the pipeline
// degrades to ungrounded chat. Mechanical math still short-circuits.
//
// Vetoes are flag-only — they never substitute the model's answer.
// The user sees what the model actually said, with a flag pinned to it.

import { answerSmalltalk, answerMath, answerVoid } from '../answer/index.js';
import { retrieveHybrid }   from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { surfFold, namedReferents, referentialConfidence, siteIndices } from '../read/index.js';
import { foldConversation } from '../converse/index.js';
import { taskOf, TASK_MAX_TOKENS } from './intent.js';
import { buildGroundedMessages, buildChatMessages, orientationLine } from '../model/prompt.js';
import { bindCitations, renderBound } from '../ground/bind.js';
import { runVetoes }        from '../ground/veto.js';
import { projectGraph }     from '../core/index.js';
import { factCheck }        from '../factcheck/index.js';

export const stages = {

  // Cheapest, model-free paths first. P0 retires the DOCUMENT mechanical short-
  // circuits (confirm / relation / who): every document answer now goes through the
  // talker, where the edge-grounding and diagonal guards adjudicate what it says.
  // This kills the confirm token-overlap rubber-stamp (the "Yes." that fired on a
  // shared-token disclaimer) and the who lookups at the route. Only the non-document
  // smalltalk and math paths still short-circuit — routing arithmetic to a 135M
  // talker is the riskier choice. The relation-typing edge-walk in answer/mechanical.js
  // is kept (cold) for the P2 relational-referent resolver.
  //   smalltalk → a greeting is never grounded against the document.
  //   math      → arithmetic, with or without a doc.
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
    if (ctx.doc) return { ...ctx, route: 'grounded', ...taskOf(ctx.question) };
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
    // P0.2: the void no longer auto-answers and terminates. The talker speaks for
    // every turn; the measured void RIDES as terrain context (`voidMeasure`) so the
    // diagonal guard (P1) can catch a specific claim asserted where the reading typed
    // an absence — a figure at a void — instead of the void silently pre-empting it.
    return { ...ctx, voidMeasure: v.void };
  },

  // Build messages. Grounded when we have spans; plain chat when we don't.
  //
  // The talker is handed the document's own reading — the fold's arrows (`ctx.note`) —
  // BESIDE the verbatim excerpts. The arrows are grounding it speaks FROM on the way out
  // and is held TO on the way back (the edge-grounding veto checks the same arrows). Hand
  // a small model spans alone and it fills the gaps between sentences with probable tokens
  // and invents a place; discarding the computed fold here was the generation-side cause
  // of that hallucination (docs/prompt-assembly.md). So the note enters the window again.
  //
  // The conversation HISTORY stays withheld (the P0.3 split): a document arrow is a reading
  // of THIS page — pure grounding, no poisoning risk — but feeding back prior turns let a
  // small model anchor on its own earlier answers, a wrong reply poisoning the follow-ups.
  // So `conversation: {}` on the grounded path; only the document note rides. The fold is
  // still recorded in the audit either way.
  async prompt(ctx) {
    const messages = ctx.spans?.length
      ? buildGroundedMessages({
          question:     ctx.question,
          spans:        ctx.spans,
          notes:        ctx.note?.text || '',    // the fold's arrows — the document's reading, fed back in
          orientation:  orientationOf(ctx.doc),
          task:         ctx.task,               // the summary guard rides on a summary task
          budget:       ctx.budget,             // none by default; a caller may impose one
          conversation: {},                      // P0.3 retained: the history is the poisoning channel, still withheld
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
      // P1: the Site-face terrain at the answer locus, for the diagonal guard. A
      // measured void rides as Void; this is what turns a specific claim made over an
      // absence into an OFF_DIAGONAL verdict the veto battery can tag.
      terrain: terrainAtLocus(ctx, cursor),
    });
    // A claim the GRAPH corroborates earns the cited sentence even when the model
    // spoke from memory: fold those citations into the answer's sources, de-duped.
    const earned = (fc.citations || [])
      .map(c => parseInt(String(c).slice(1), 10)).filter(Number.isFinite);
    const sources = earned.length ? [...new Set([...(ctx.sources || []), ...earned])] : ctx.sources;
    return { ...ctx, edgeVerdicts: fc.edgeVerdicts, factcheck: fc, sources };
  },

  // The confabulation rewrite — rewrite-then-tag. When the diagonal guard found the
  // confabulation proper (a specific claim asserted at a measured Void), give the
  // talker ONE more pass with a corrective, on the same excerpts, and re-run the bind
  // and fact-check on the new draft through the very same stages. If the rewrite clears
  // it, the clean draft replaces the confabulation outright. If it STILL confabulates,
  // we put it through: the answer ships and the veto tags the offending span (flag-only,
  // never silently dropped) — the record carries that a rewrite was tried and the
  // figure-at-a-void survived it. Inert when the guard found nothing, in chat mode, or
  // with no model. The grain guard is classifier-free, so this arms even under the hash
  // organ.
  async revise(ctx) {
    if (!ctx.doc || !ctx.spans?.length || !ctx.model || !confabulating(ctx)) return ctx;
    let cur = ctx, attempts = 0;
    const revisions = [];
    while (attempts < REWRITE_ATTEMPTS && confabulating(cur)) {
      attempts++;
      // Record the superseded draft BESIDE its successor — never erase it. The
      // off-diagonal verdicts that condemned it travel with it, so the trail shows
      // verbatim what the machine said and why it was made to answer again. This is the
      // log's own SEG/retract law (core/log.js) applied to the conversational record:
      // a truer word may be appended, the false one is not unwritten.
      const supersededDraft   = cur.rawOutput;
      const supersededVerdicts = (cur.edgeVerdicts || []).filter(v => v.verdict === 'off_diagonal' && v.void);
      const messages = buildGroundedMessages({
        question:    ctx.question,
        spans:       ctx.spans,
        notes:       '',
        orientation: orientationOf(ctx.doc),
        task:        ctx.task,
        budget:      ctx.budget,
        conversation: {},
        corrective:  CONFAB_CORRECTIVE,
      });
      const raw = await ctx.model.phrase(messages, { maxTokens: ctx.maxTokens || TASK_MAX_TOKENS.answer });
      cur = await stages.factcheck(await stages.bind({ ...cur, rawOutput: raw, messages }));
      revisions.push(Object.freeze({ draft: supersededDraft, offDiagonal: supersededVerdicts, replacedBy: raw }));
    }
    return { ...cur, revised: { attempts, resolved: !confabulating(cur) }, revisions };
  },

  // The veto pass. The SOFT flags ride alongside the answer (low-coverage, the
  // edge-unsupported / weak-contradiction / off-diagonal family, referent-ambiguous,
  // abstained) — marked, not traded. So does the libel-grade `edge-contradicted`: it is
  // refuses:true (a serious pill) but flag-and-tell by the factcheck holon's deliberate
  // design — the talker may speak from memory, and the system must not assert the
  // document's primacy over the world.
  //
  // But the HARD floor GATES: when a `gates` veto fires (empty / declined / echo /
  // unbound — the high-amplitude LIMIT where the un-groundedness reading overwhelms every
  // null: an empty/refusing/echoed draft, or prose that made no lexical contact with any
  // span) the draft is not grounded enough to stand, so the shown word is substituted with
  // a typed decline. This is the lexical-priority bar made real in the CONTROL FLOW — the
  // signal was computed and discarded here, which made it an audit pill, not a gate. The
  // FAINT sibling `unbound-contact` (a paraphrase that made contact but could not cite) does
  // NOT gate — it flags and rides; enacting a faint amplitude as certainty would over-refuse.
  //
  // Nothing is laundered: the draft is preserved BESIDE the decline in `revisions`, the
  // way the rewrite and the event log preserve a superseded word (core/log.js). The
  // record shows what the talker said, why it was gated, and the honest word shipped in
  // its place. Without a doc we skip the grounding vetoes entirely.
  async veto(ctx) {
    if (!ctx.spans?.length) return { ...ctx, vetoes: [] };
    const { fired, gate } = runVetoes({
      draft: ctx.rawOutput, bound: ctx.bound, question: ctx.question,
      referential: ctx.referential, task: ctx.task,
      // The edge-grounding verdicts the factcheck stage just deposited — the link-
      // shaped sibling of the node-level `unbound` check. Without this they were
      // computed and discarded; now a claim the graph DENIES becomes a flag.
      edgeVerdicts: ctx.edgeVerdicts,
    });
    if (!gate) return { ...ctx, vetoes: fired };

    const gatedBy   = fired.filter(f => f.gates).map(f => f.id);
    const decline   = declineAnswer(gatedBy);
    const revisions = [...(ctx.revisions || []), Object.freeze({
      draft: ctx.rawOutput, refusedBy: gatedBy, replacedBy: decline,
    })];
    return { ...ctx, vetoes: fired, gated: true, answer: decline, sources: [], revisions };
  },

  // Settle: a placeholder for conversation-field updates and form stamps.
  // Kept here as a named stage so the place is obvious for the next change.
  async settle(ctx) {
    return ctx;
  },
};

// One corrective rewrite. The user's rule: on confabulation, trigger a rewrite; if it
// still fails, put it through with the span tagged. One pass is the "a rewrite".
const REWRITE_ATTEMPTS = 1;

// The corrective handed to the talker on the rewrite pass — name the over-reach and
// steer to the excerpts or to the honest abstention. No notes, no history (P0.3).
const CONFAB_CORRECTIVE =
  'A previous attempt asserted a specific connection — a cause, a relationship, an ' +
  'identity, an action between named figures — that the excerpts do not state. Answer ' +
  'again using ONLY what the excerpts say. If the excerpts do not state such a ' +
  'connection, do not assert one: say the document does not say.';

// Did the diagonal guard catch the confabulation proper — a specific claim asserted at
// a measured Void (the figure-at-a-void shape)? The hard case the rewrite targets.
const confabulating = (ctx) =>
  (ctx.edgeVerdicts || []).some(v => v.verdict === 'off_diagonal' && v.void);

// The typed decline the hard floor substitutes when a refusing veto gates the turn —
// the talker-floor's NUL, distinct from the perception void (which is about no spans).
// Named to the dominant reason so the shown word is honest about WHY it declined, never
// a bare "I can't." The draft it replaces is preserved in `revisions`, never erased.
const DECLINE = Object.freeze({
  unbound:   "I can't ground an answer to that in the document.",
  empty:     "I don't have an answer to that.",
  echo:      "I don't have a grounded answer to that.",
  declined:  "I don't have a grounded answer to that.",
});
const declineAnswer = (gatedBy = []) => DECLINE[gatedBy[0]] || "I can't give a grounded answer to that.";

// The Site-face terrain the reading typed at the answer locus, for the diagonal guard.
// A measured void is a Void; a locus the document DEF'd as a site (boilerplate /
// furniture, read/site.js) is ambient Ground (Atmosphere); otherwise the locus carries
// a figure (Entity), where a specific claim sits on the diagonal and the guard passes.
const terrainAtLocus = (ctx, cursor) => {
  if (ctx.voidMeasure) return 'Void';
  if (cursor != null && Number.isFinite(cursor) && ctx.doc && siteIndices(ctx.doc).has(cursor)) return 'Atmosphere';
  return 'Entity';
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
