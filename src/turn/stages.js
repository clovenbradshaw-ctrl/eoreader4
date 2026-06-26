// The named, pure stages of a turn. Each takes a context, returns a context.
// The pipeline composes them; a stage returning {terminate:true} short-
// circuits the rest.
//
// Stages are tolerant of a missing document: with no doc the pipeline
// degrades to ungrounded chat. Mechanical math still short-circuits.
//
// Vetoes are flag-only — they never substitute the model's answer.
// The user sees what the model actually said, with a flag pinned to it.

import { answerSmalltalk, answerMath, answerVoid, answerMetadata } from '../answer/index.js';
import { retrieveHybrid, pickRetrievalEmbedder, selectExcerpts, retrieveStructural, queryTouchesDoc } from '../retrieve/index.js';
import { foldNote }         from '../fold/index.js';
import { surfFold, centroidBasis, projectUnits, structuralActivations } from '../surfer/index.js';
import { namedReferents, referentialConfidence, siteIndices } from '../perceiver/index.js';
import { foldConversation, resolveRetrievalQuery, referenceTarget } from '../converse/index.js';
import { taskOf, TASK_MAX_TOKENS } from './intent.js';
import { rereadOnUnsettled } from './reread.js';
import { buildGroundedMessages, buildChatMessages, orientationLine } from '../model/index.js';
import { bindCitations, renderBound } from '../ground/index.js';
import { runVetoes, isUnbound } from '../ground/index.js';
import { canGroundedSpeak, groundedSpeak, RULES_REV } from '../organs/out/speech/index.js';
import { projectGraph }     from '../core/index.js';
import { factCheck }        from '../factcheck/index.js';
import { streamAnswer }     from '../write/index.js';
import { streamPhrase }     from '../model/index.js';

// Weave the mind's recalled lines into the prompt as labelled BACKGROUND — only when
// the user has the Mind chip in weave mode (ctx.mindSpans present). The memory is
// offered for context and explicitly marked as NOT the document: grounded claims are
// still cited to the document's spans, never to these. Appended to the final (user)
// message so it rides inside the window without disturbing the grounded/chat assembly.
// Guarded entirely by mindSpans — every default turn skips it, byte-identical.
const weaveMemory = (messages, mindSpans) => {
  if (!messages?.length || !mindSpans?.length) return messages;
  const lines = mindSpans.slice(0, 5).map((s) => {
    const who = s.book?.authors ? ` — ${String(s.book.authors).split(';')[0].trim()}` : '';
    const line = String(s.text || '').replace(/\s+/g, ' ').trim();
    return `- “${line}” (${s.book?.title || 'unknown'}${who})`;
  }).join('\n');
  const block = `\n\n[From memory — eoreader’s read corpus, offered as background only. ` +
    `These are not the open document; cite the document for any grounded claim.]\n${lines}`;
  const out = messages.map((m) => ({ ...m }));
  const last = out.length - 1;
  out[last] = { ...out[last], content: `${out[last].content}${block}` };
  return out;
};

// The Significance column's opts for the fold's surf. Returns {} — the byte-identical
// default — unless a MEANING-measuring embedder and a centroid prior are both present.
// The async embedding work happens HERE (the fold stage is async); the surf itself
// stays a synchronous pure function fed pre-computed activations. The dominant REAL
// lens (one whose Born weight beat the spectral null) conditions the surf; absent any
// real lens, the column still rides as a report (atmosphere + lenses) with the peak
// unchanged. Degrades to {} on any embedding fault — a flaky meaning organ must never
// crash the fold.
const significanceOpts = async (ctx, anchor) => {
  if (!ctx.doc) return {};
  const emb = ctx.geometricEmbedder;
  // THE MEANING PATH (the upgrade). A live meaning-measuring embedder AND a centroid prior
  // → the embedding column: the full atmosphere/paradigm/stance read, ridden forward inside
  // the dominant lens (lens-conditioned arrest). This is the richest reading and unchanged.
  if (ctx.centroids && emb?.measuresMeaning && typeof ctx.doc.sentenceEmbeddings === 'function') {
    const basis = centroidBasis(ctx.centroids);
    if (basis) {
      try {
        const vectors = await ctx.doc.sentenceEmbeddings(emb);
        const activations = projectUnits(vectors, basis);
        const report = surfFold(ctx.doc, anchor, { activations, prior: basis, lensReport: true });
        const dom = report.lenses?.find(l => l.real)?.lens ?? report.lenses?.[0]?.lens ?? null;
        return { activations, prior: basis, lensReport: true, atmosphere: true, paradigm: true, stance: true,
                 alpha: ctx.alpha ?? 0.05, ...(dom ? { lens: dom } : {}) };
      } catch { /* fall through to the structural default — never a dark fold */ }
    }
  }
  // THE STRUCTURAL DEFAULT (the embedder-free column, surfing-next.md §2). ρ from the
  // OPERATOR PROFILES (structure-basis.js) — read off the log, no model — so the column
  // (lenses, lensEntropy, stance) lights up on EVERY turn, not only when a meaning model
  // is loaded. Conservative by construction: the dominant lens is NOT passed, so the surf
  // is not lens-conditioned and `stops`/`peak` (the fields the answer rides) stay
  // byte-identical to the no-significance surf. Lens-conditioned arrest on this basis is
  // the follow-on, bench-validated before it changes the reading. The stance it computes
  // is what the veto battery now reads (the surfer's own confabulation guard, §3).
  try {
    const { activations, signs } = structuralActivations(ctx.doc);
    if (!activations.length || !activations.some(v => v.some(x => x > 0))) return {};
    // `alpha` is deliberately NOT passed: it would flip the cursor axis from the median
    // rule to the derived VOID boundary (surf.js `useBoundary`), changing which cursors
    // arrest — a reading change for the bench-gated follow-on, not here. The significance
    // pass falls back to its own internal 0.05 for the lens/stance nulls, so the column is
    // fully measured while the arrest stays byte-identical.
    return { activations, signs, lensReport: true, stance: true };
  } catch { return {}; }
};

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

    // A front-matter question — "who wrote this?", "when was it written?" — is answered
    // from doc.metadata as a distinct fact (§3), so title/author stay ANSWERABLE without
    // riding the content prompt, where they would invite narration-from-memory. Only
    // fires when the document actually carries the fact; otherwise it falls through.
    const meta = answerMetadata(ctx.doc, ctx.question);
    if (meta) return short(meta);

    // Not a mechanical short-circuit → a real turn. Read the TASK register
    // (intent.js): the prompt register (summary guard) and the token ceiling — the
    // real length bound. The mechanical paths above need neither.
    //
    // The GROUNDING register (the UI's Grounded / Free form / Auto chip, ctx.grounding)
    // chooses the route here. 'grounded' forces the document register even with no doc
    // (the downstream strict refusal answers the absence); 'free' forces ungrounded chat,
    // ignoring the document entirely; 'auto' (the default) keeps the original behaviour —
    // a document grounds the turn, its absence falls to chat.
    const reg = taskOf(ctx.question);
    const grounding = ctx.grounding || 'auto';
    if (grounding === 'free')     return { ...ctx, route: 'chat',     ...reg };
    if (grounding === 'grounded') return { ...ctx, route: 'grounded', ...reg };
    if (ctx.doc) return { ...ctx, route: 'grounded', ...reg };
    return { ...ctx, route: 'chat', ...reg };
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
    // Free-form turns ignore the document; with no document there is nothing to
    // retrieve. Either way the prompt stage builds an ungrounded chat message.
    if (!ctx.doc || ctx.grounding === 'free') return { ...ctx, spans: [] };
    // Read MEANING for the semantic channel when a meaning organ is live; else fall
    // back to the hash organ. ctx.embedder (hash) is unchanged for every other stage —
    // only retrieval's semantic vectors are upgraded (turn/pipeline threads the organ).
    const re = pickRetrievalEmbedder(ctx);
    // Resolve a follow-up against the conversation BEFORE retrieval (§6): a thin,
    // demonstrative, or self-referential question ("now?", "prove it", "huh?", "what you
    // are saying about her") retrieves on the topic the user is pursuing, not its literal
    // words. A self-contained question passes through untouched. Only the user's prior
    // turns feed this — never the talker's answers (converse/focus.js).
    //   This runs on EVERY path, the reference-by-reading flag notwithstanding (the audit
    //   ran with RULES_REV on and "prove it" retrieved the literal token — the broom
    //   sentence — because the regex query-fold was gated off; §6 brings it back). The
    //   read path still holds the SUBJECT (the fold's cast); this is the complementary
    //   NOMINATION channel that finds the EVIDENCE spans the demonstrative points at.
    const query = resolveRetrievalQuery(ctx.question, ctx.history);
    // A whole-document task (summary / list / explain) whose question makes no lexical
    // contact with the page is a META-query — "summarize", "what is this about" — and
    // retrieving on it fuzzy-matches the meta-word onto arbitrary fragments (the audit's
    // t1 confabulated summary). Read the document's STRUCTURE instead: its opening,
    // headings, and an even spread (retrieve/structural.js). A targeted whole-doc
    // question naming a term the document uses stays on the lexical path (queryTouchesDoc
    // is true), so the strong t6 ("what are the 9 operators?") is untouched.
    if (ctx.task && ctx.task !== 'answer' && !queryTouchesDoc(ctx.doc, query)) {
      const structural = retrieveStructural(ctx.doc, 12);
      if (structural.length) return { ...ctx, spans: structural, retrievalQuery: query, retrieval: 'structural' };
    }
    const spans = await retrieveHybrid(ctx.doc, query, re, 6);
    if (spans.length === 0) {
      // Strict grounded mode never falls through to free generation: it stays on the
      // grounded route and answers the absence ("the document doesn't cover this")
      // rather than inventing from outside knowledge.
      if (ctx.grounding === 'grounded') return { ...ctx, spans: [], retrievalQuery: query };
      // Auto / default: doc loaded but nothing matches — fall through to ungrounded chat.
      return { ...ctx, spans: [], route: 'chat', retrievalQuery: query };
    }
    return { ...ctx, spans, retrievalQuery: query };
  },

  // Fold the spans into a single note the model can read — the reading. With a doc
  // this is the consciousness: existence + structure + significance. The cursor is no
  // longer blindly the top lexical hit — the SURFER (docs/surfing-the-fold.md) is
  // seeded at that anchor and steps down the Bayesian-surprise gradient to the PEAK,
  // where the significance reading is taken. Any high-significance line retrieval
  // missed is folded in as a citable span (via:'surf', its index real), so it is both
  // read by the consciousness and bindable.
  async fold(ctx) {
    const folded = await stages.foldReading(ctx);
    // THE ACTIVE-INFERENCE RE-READ (surfing-next.md §3, opt-in via ctx.reread). When the surf
    // could not SETTLE on a figure at the peak (the stance-reserve guard) on a pointed
    // question, read more of the document on the figure the reading circled and fold AGAIN
    // from the wider evidence — `inquire`'s loop brought in-turn, bounded to one extra pass.
    // Inert unless the caller opts in, so the default turn is byte-identical to foldReading.
    if (!ctx.reread || !folded.surf) return folded;
    const re = pickRetrievalEmbedder(ctx);
    const widened = await rereadOnUnsettled({
      doc: ctx.doc, spans: folded.spans, surf: folded.surf, task: ctx.task,
      referential: folded.referential,        // the diffuse-coref trigger (the live one on the default path)
      query: ctx.retrievalQuery || ctx.question,
      retrieve: (q, k) => retrieveHybrid(ctx.doc, q, re, k),
    });
    if (!widened.added) return folded;
    const refolded = await stages.foldReading({ ...ctx, spans: widened.spans });
    return { ...refolded, rereadInfo: { added: widened.added, asked: widened.asked } };
  },

  // The reading proper — fold the spans into the note (the surf + significance column). Split
  // out from `fold` so the re-read can run it twice: once on the retrieved spans, once on the
  // widened set. Byte-identical to the former fold body.
  async foldReading(ctx) {
    if (!ctx.spans?.length) return { ...ctx, note: null };
    // Reference by reading (RULES_REV, docs/reference-by-reading.md §2–§3). The turn's
    // DEF target is read off the CONVERSATION CAST — the warmest figure the conversation
    // holds, with retrieval nominating a document referent beside it — and the document
    // surf is seeded at that referent's LOCUS (localeOf), the one hop from the warm
    // referent to where the document establishes it. So "his name" lands on the line
    // that NAMES the figure, which the word "name" never reaches by similarity. Flag
    // off: the anchor is the top retrieval hit and the focus is the named referents of
    // the question, exactly as before — byte-identical, the read path is dark.
    const refTarget = RULES_REV ? referenceTarget(ctx.doc, ctx.history, ctx.question, ctx.spans) : null;
    const anchor = (refTarget?.locale ?? ctx.spans[0]?.idx) ?? 0;
    // THE SIGNIFICANCE COLUMN (significance-column spec). When a meaning-measuring
    // embedder AND a centroid prior are present, the surf rides the full column: it
    // registers the document's interpretive Atmosphere, decomposes its Lenses, and
    // rides forward INSIDE the dominant reading (lens-conditioning) so the peak lands on
    // that reading's surprise rather than the document's loudest overall. Inert under
    // the hash embedder (a cosine between spelling-space and MiniLM-space measures
    // nothing — the same firewall the geometric classifier runs), so `sigOpts` is `{}`
    // there and the surf is byte-identical to today. This is the column improving the
    // chat only where it can honestly measure, and staying dark where it cannot.
    const sigOpts = await significanceOpts(ctx, anchor);
    const surf   = ctx.doc ? surfFold(ctx.doc, anchor, sigOpts) : null;

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
    //   Reference by reading (RULES_REV): the referent is READ off the conversation
    //   cast (refTarget), so a pronoun / definite description / correction centres the
    //   reading on the figure it refers to, not only one the question names by surface
    //   form. Flag off: the question's named referents, exactly as before.
    const focus  = refTarget ? [refTarget.id] : (ctx.doc ? namedReferents(ctx.doc, ctx.question) : []);
    // The RICH NOTES path rides behind RULES_REV (rich-notes §6): with the flag off the
    // fold is byte-identical (flat arrows + significance summary); with it on the note
    // is projected through the reading substrate (settled · held-open · turns), and the
    // surfer's located RECs feed the turns group, so the Significance face the flat
    // notes drop reaches the talker.
    const note   = foldNote(spans, { doc: ctx.doc, cursor, focus, surf: RULES_REV ? surf : null, grouped: RULES_REV });
    // Pattern: if the basis itself was defeated (a measured Paradigm REC), the note
    // records a REFRAME, not a deeper read — append-only, carrying its surprise-delta
    // (the helix turning: REC re-admits what counts as ground). Off the dark path
    // (no surf.paradigmRec) the note is untouched.
    if (note && surf?.paradigmRec) note.reframed = surf.paradigmRec;
    // The reader's confidence about WHO this passage concerns — read off the
    // grounded coref posterior at the cursor (the same field the fold rode). No
    // longer measured and discarded: it rides the turn, and a diffuse field
    // (no dominant referent) becomes a flag in the veto battery.
    const referential = ctx.doc?.corefField
      ? referentialConfidence(ctx.doc.corefField.fieldGrounded(cursor))
      : null;
    return { ...ctx, spans, note, surf, focus, referential, refTarget };
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
  // The conversation carried into a grounded turn is the USER's side only — the thread of
  // what was asked — never the talker's prior answers. That keeps follow-up continuity
  // ("now?", "answer my first question") while withholding the one channel that poisons:
  // a small model re-reading its own earlier (maybe wrong) reply and anchoring on it. The
  // talker's output is a weaker witness (converse/provenance.js); on this path it is not
  // carried at all. The document note (the fold's arrows) rides as before.
  async prompt(ctx) {
    // The register is the route the grounding chip selected upstream — not just
    // "did we get spans". A strict-grounded turn with no spans still builds a
    // grounded (strict-refusal) message; a free-form turn always builds chat.
    const grounded = ctx.route === 'grounded';
    const messages = grounded
      ? buildGroundedMessages({
          question:     ctx.question,
          spans:        selectExcerpts(ctx.spans || []),  // the relevant few verbatim — the ONE channel (§2)
          orientation:  orientationOf(ctx.doc),       // filename · type · length — no recognition (§3)
          task:         ctx.task,               // the summary guard rides on a summary task
          budget:       ctx.budget,             // none by default; a caller may impose one
          conversation: groundedConversation(ctx),  // the USER's thread only — never the talker's prior answers
          strict:       ctx.grounding === 'grounded',   // "only what you read" — abstention is the honest fallback
        })
      : buildChatMessages({
          question: ctx.question,
          history:  ctx.recentMessages || [],   // a chat model wants turns as turns
          notes:    ctx.conversation?.notes || '',
          free:     ctx.grounding === 'free',   // general-knowledge register, explicitly ungrounded
        });
    // Weave in the read corpus (the mind) when the user opted into weave mode. Null
    // otherwise — the present prompt is untouched, golden parses byte-identical.
    const woven = weaveMemory(messages, ctx.mindSpans);
    return {
      ...ctx,
      messages: woven,
      promptText: woven.map(m => `${m.role}: ${m.content}`).join('\n\n'),
    };
  },

  // The model. The token ceiling is the task register's max_tokens (the real length
  // bound) — not a fixed 256. Verbatim raw output is captured in `rawOutput` for audit.
  //
  // Two paths, one default. The GOLDEN path is phrase()+veto, unchanged: the model
  // samples the whole reply, the binder cites it, the veto flags it. The GATED path
  // (enactor/gate.js, driven via the speech renderer) is taken only behind RULES_REV AND when the backend exposes
  // `propose` (logit access) AND the surfer's reading is in hand — grounded speech at
  // the proposition, the answer SELECTED by grounding rather than flagged after it. Its
  // emitted surface flows down the SAME bind/factcheck/veto stages, so veto is now the
  // auditory-loop annotation that confirms grounding (§8). Absent any precondition the
  // talker falls back to phrase(), byte-identical — non-breaking by construction.
  async llm(ctx) {
    const maxTokens = ctx.maxTokens || 384;

    // The STREAMING ANSWER path (docs/streaming-answer.md §5). When a doc is
    // grounded, a surfer path exists, and streaming is requested, the answer is
    // realised one grounded sentence per surfer stop — emitted token by token
    // through ctx.onToken, each beat aware of the ones behind it (the fold) and
    // bound backward by the witness (§4). The emitted draft becomes `rawOutput`, so
    // the downstream bind / factcheck / veto stages annotate it exactly as today.
    // Falls back to the single phrase() below when any precondition is absent —
    // non-breaking by construction; the present chat / golden paths are untouched.
    if (ctx.stream && ctx.route === 'grounded' && ctx.doc && ctx.surf && ctx.spans?.length) {
      try {
        const streamed = await streamAnswer({
          doc: ctx.doc, surf: ctx.surf, model: ctx.model, focus: ctx.focus || [],
          onToken: ctx.onToken, alpha: ctx.alpha ?? undefined, orientation: orientationOf(ctx.doc),
        });
        if (streamed && streamed.draft) {
          return { ...ctx, rawOutput: streamed.draft, maxTokens, streamed };
        }
      } catch { /* a streaming fault degrades to the one-shot path below, never a dead turn */ }
    }

    if (canGroundedSpeak(ctx.model, ctx)) {
      const gated = await groundedSpeak({
        model: ctx.model, messages: ctx.messages, doc: ctx.doc,
        surf: ctx.surf, question: ctx.question,
        alpha: ctx.alpha ?? undefined, opts: { maxTokens },
      });
      return { ...ctx, rawOutput: gated.answer, maxTokens, gated, gatedVoided: gated.voided };
    }
    // PLAIN token streaming (the default visible mode, docs/streaming-answer.md):
    // forward `ctx.onToken` to the ordinary draw so the one-shot answer fills in
    // token by token where the backend exposes a decode callback (webllm, onnx-chat,
    // wllama). A backend without one falls back to draw-then-emit — the whole answer
    // once — and a turn with no `onToken` is byte-identical to the bare phrase().
    const raw = await streamPhrase(ctx.model, ctx.messages, { maxTokens, onToken: ctx.onToken });
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
      // §4 (behind RULES_REV): the change-of-state object-functional clash — Gregor, not
      // the father, underwent the transformation. Off by default → byte-identical.
      changeOfState: RULES_REV,
    });
    // A claim the GRAPH corroborates earns the cited sentence even when the model
    // spoke from memory: fold those citations into the answer's sources, de-duped.
    const earned = (fc.citations || [])
      .map(c => parseInt(String(c).slice(1), 10)).filter(Number.isFinite);
    const sources = earned.length ? [...new Set([...(ctx.sources || []), ...earned])] : ctx.sources;
    return { ...ctx, edgeVerdicts: fc.edgeVerdicts, factcheck: fc, sources };
  },

  // The regenerate pass — gate-then-rewrite (§5). Two triggers re-prompt the talker once
  // against the SAME lines and re-run bind + fact-check on the new draft:
  //   (a) the confabulation proper — a specific claim asserted at a measured Void (the
  //       off-diagonal guard). Rewrite-then-TAG: a survivor ships, flagged.
  //   (b) the §5 GATE — a REFUSING edge-grounded veto on the answer's load-bearing claim:
  //       a relation the reading DENIES (factcheck.refuse), or a from-nowhere `unbound`
  //       answer. Under the subjective frame abstention is free and coherent, so the
  //       calculus that made these RIDE now inverts: they gate and regenerate. The turn
  //       is recorded `gated` whether or not the regenerate clears it — the gate engaged;
  //       with a real model the corrective pulls the redo toward an honest "I did not find
  //       it." Scoped to the default `answer` task (the pointed question), so a summary's
  //       connective claims are never gated.
  // If the rewrite clears it, the clean draft replaces the first outright; a survivor
  // ships with the veto's flag (never silently dropped). Inert with no model / no doc / in
  // chat mode. Both guards are classifier-free, so this arms even under the hash organ.
  async revise(ctx) {
    // Retired on the streaming-answer path (docs/streaming-answer.md §3c, §5): the
    // block rewrite would un-stream tokens the reader has already seen, which the
    // suppress-never-erase law forbids. On that path a void was hedged prospectively
    // (band:'void' at the cursor) and any drift rode forward into the next beat — the
    // correction is already in the trail, so there is nothing to rewrite here.
    if (ctx.streamed) return ctx;
    if (!ctx.doc || !ctx.spans?.length || !ctx.model || !needsRegen(ctx)) return ctx;
    // The §5 gate engaged at entry — recorded for the audit even if the regenerate clears.
    const gated = gateCondition(ctx);
    let cur = ctx, attempts = 0;
    const revisions = [];
    while (attempts < REWRITE_ATTEMPTS && needsRegen(cur)) {
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
        spans:       selectExcerpts(ctx.spans),   // same trimmed lines the first pass saw
        orientation: orientationOf(ctx.doc),
        task:        ctx.task,
        budget:      ctx.budget,
        conversation: {},                     // history still withheld on the grounded path
        corrective:  correctiveFor(cur),      // confab → drop the link; gate → keep to the lines
      });
      const raw = await ctx.model.phrase(messages, { maxTokens: ctx.maxTokens || TASK_MAX_TOKENS.answer });
      cur = await stages.factcheck(await stages.bind({ ...cur, rawOutput: raw, messages }));
      revisions.push(Object.freeze({ draft: supersededDraft, offDiagonal: supersededVerdicts, replacedBy: raw }));
    }
    return { ...cur, revised: { attempts, resolved: !needsRegen(cur) }, revisions,
             ...(gated ? { gated: true } : {}) };
  },

  // The veto pass — flag-and-tell, ALWAYS. The vetoes ride alongside the model's answer
  // as the fact-check's annotations; they never substitute it. We trust the talker to say
  // the thing, surface what it said, and pin a flag where the grounding is thin or
  // contested (low-coverage, edge-unsupported / contradicted, off-diagonal, referent-
  // ambiguous, abstained, and the from-nowhere `unbound`). A flag is an ADDITION to the
  // answer, not a trade for it: the user sees the answer the model gave — never a canned
  // decline, never a raw span swapped in for it — with the caveats attached. Surfacing the
  // model's word and telling the user what we could and couldn't ground is the whole job;
  // hiding it behind a typed refusal was the old span-extractive reflex, now retired. If
  // the talker truly needs to know more before it can speak, that is the upstream retrieval
  // / revise loop's problem, not a reason to gag the answer here. Without a doc we skip the
  // grounding vetoes entirely.
  async veto(ctx) {
    if (!ctx.spans?.length) return { ...ctx, vetoes: [] };
    const { fired } = runVetoes({
      draft: ctx.rawOutput, bound: ctx.bound, question: ctx.question,
      referential: ctx.referential, task: ctx.task,
      // The surfer's measured commit stance — its own confabulation guard (stance-reserve):
      // a Ground-grain reserve at the peak means the reading did not settle on a figure.
      // Computed on every turn now the structural significance column is the default (§2).
      stance: ctx.surf?.stance,
      // The edge-grounding verdicts the factcheck stage just deposited — the link-
      // shaped sibling of the node-level `unbound` check. Without this they were
      // computed and discarded; now a claim the graph DENIES becomes a flag.
      edgeVerdicts: ctx.edgeVerdicts,
    });
    return { ...ctx, vetoes: fired };
  },

  // Settle: fold this turn's reading into the session's persistent Horizon (surfing-next.md
  // §4) — the moved density operator that accumulates across turns, curing the surf's
  // per-turn amnesia. Observe-only and AFTER the answer is formed, so it never changes the
  // reading the user just saw; it grows the cross-turn memory the NEXT turn can be read
  // against (the conditioning step is the staged follow-on). The reading folded in is the
  // embedder-free operator-profile activations — the same structural basis the significance
  // column rides — so the Horizon accumulates on every turn, not only under a meaning model.
  // Inert with no threaded Horizon (the default) and on a turn with no document; a fault here
  // must never disturb the answer, so it is fully guarded.
  async settle(ctx) {
    if (!ctx.horizon || !ctx.doc) return ctx;
    try {
      const { activations } = structuralActivations(ctx.doc);
      const live = activations.filter(v => v.some(x => x > 0));
      if (live.length) {
        const reading = ctx.horizon.observe(live);
        return { ...ctx, horizonReading: reading };
      }
    } catch { /* a memory fold must never break a settled answer */ }
    return ctx;
  },
};

// One corrective rewrite. The user's rule: on confabulation, trigger a rewrite; if it
// still fails, put it through with the span tagged. One pass is the "a rewrite".
const REWRITE_ATTEMPTS = 1;

// The corrective handed to the talker on the rewrite pass — a REFINE, not a retreat. It
// names the specific over-reach (a connection the passages don't support) and asks for a
// truer answer in the model's own words, dropping the unsupported link — NOT for a blanket
// "the document does not say." We are still trusting the talker; we are only steering it
// off the one claim the reading could not witness.
const CONFAB_CORRECTIVE =
  'A previous attempt asserted a specific connection between named figures — a cause, an ' +
  'action, an identity, a relationship — that the lines do not actually support. Answer ' +
  'again in your own words, keeping to what the lines support. State the connection only ' +
  'if it is really there; otherwise answer the part you can and leave the unsupported link out.';

// The §5 corrective — handed when the GATE engaged (a refusing edge-grounded veto, or a
// from-nowhere unbound answer), distinct from the confab refine. It steers the talker
// back onto the lines and names the honest absence as a real option: under the subjective
// frame "I did not find it" is coherent, so the regenerate can reach it.
const GROUNDING_CORRECTIVE =
  'Read the lines again. Part of what you just said is not in them — either it is not ' +
  'there at all, or it conflicts with what they show. Answer again, keeping strictly to ' +
  'what the lines say. If the answer is not in them, tell them plainly you did not find it.';

// Did the diagonal guard catch the confabulation proper — a specific claim asserted at
// a measured Void (the figure-at-a-void shape)? The hard case the rewrite targets.
const confabulating = (ctx) =>
  (ctx.edgeVerdicts || []).some(v => v.verdict === 'off_diagonal' && v.void);

// The §5 GATE condition. Under the subjective frame, a REFUSING edge-grounded veto on the
// answer's load-bearing claim no longer rides: a relation the reading DENIES
// (factcheck.refuse — a confident contradiction), or a from-nowhere `unbound` answer whose
// claims tie to nothing, engages the gate and regenerates. Scoped to the default `answer`
// task — the pointed question where retrieval finding nothing IS the absence; a whole-
// document task's connective claims legitimately have no single witness. low-coverage, the
// weak contradiction, edge-unsupported, and the off-diagonal grain over-read stay flag-only.
const refusingEdge       = (ctx) => !!ctx.factcheck?.refuse;
const loadBearingUnbound = (ctx) => isUnbound(ctx.bound || [], ctx.rawOutput);
const gateCondition      = (ctx) => ctx.task === 'answer' && (refusingEdge(ctx) || loadBearingUnbound(ctx));

// A regenerate is owed when the off-diagonal confab guard fired OR the §5 gate holds.
const needsRegen = (ctx) => confabulating(ctx) || gateCondition(ctx);

// The corrective for the regenerate, by failure: a pure §5 gate (no confab) steers back
// onto the lines; otherwise the confab refine drops the unsupported link.
const correctiveFor = (ctx) =>
  (gateCondition(ctx) && !confabulating(ctx)) ? GROUNDING_CORRECTIVE : CONFAB_CORRECTIVE;

// The Site-face terrain the reading typed at the answer locus, for the diagonal guard.
// A measured void is a Void; a locus the document DEF'd as a site (boilerplate /
// furniture, read/site.js) is ambient Ground (Atmosphere); otherwise the locus carries
// a figure (Entity), where a specific claim sits on the diagonal and the guard passes.
const terrainAtLocus = (ctx, cursor) => {
  if (ctx.voidMeasure) return 'Void';
  if (cursor != null && Number.isFinite(cursor) && ctx.doc && siteIndices(ctx.doc).has(cursor)) return 'Atmosphere';
  return 'Entity';
};

// The orientation line: the talker is handed the FILENAME, type, and length, read off
// `docId` (the ingest sets it from the file name) — and NOTHING that lets it narrate a
// famous text from memory (§3). The document's own metadata (title, author, date) does
// not ride here, nor anywhere in the content prompt; it is answered separately, as a
// distinct fact, by the metadata answerer (answer/metadata.js, routed in `route`).
const orientationOf = (doc) => {
  if (!doc) return '';
  const units = doc.units || doc.sentences || [];
  return orientationLine({
    filename: doc.docId || 'the document',
    type:     doc.modality === 'image' ? 'image' : 'text',
    length:   units.length,
  });
};

// The conversation the GROUNDED prompt carries: the user's OWN recent turns — the thread
// of what was ASKED — and never the talker's prior answers. Recent user turns ride from
// the session fold's verbatim window; older ones from its surfed `#i You:` movers. This
// restores follow-up continuity without re-feeding the model the replies it anchors on
// (the poisoning channel). Empty (→ no slot) when the user hasn't asked anything yet.
const groundedConversation = (ctx) => {
  const recentUser = (ctx.recentMessages || [])
    .filter(m => m && m.role === 'user' && m.content).map(m => m.content);
  const olderUser = String(ctx.conversation?.notes || '')
    .split('\n').filter(l => /^#\d+\s*You:/.test(l)).map(l => l.replace(/^#\d+\s*You:\s*/, '').trim());
  const thread = [...olderUser, ...recentUser].filter(Boolean);
  if (!thread.length) return {};
  // Carry only the most recent few. The full thread, fed verbatim as "You asked: …"
  // lines, reads to a small talker as a checklist of open tasks — the audit's t5
  // answered every prior question in a bulleted list and overran its token budget.
  // The recent turns are what continuity ("now?", "prove it") actually needs; the
  // tail only widens the leak surface.
  return { notes: thread.slice(-3).map(q => `You asked: ${q}`).join('\n') };
};
