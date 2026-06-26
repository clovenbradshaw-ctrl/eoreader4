// write — the GENERATION faculty: the cursor turned forward. (SPEC, the Enacted Writer)
//
// The reading side already runs "the substrate reasons, the model renders"; this is
// that discipline extended to PRODUCTION. The substrate reasons over hashIds, fixes
// structure/identity/ordering/grounding, and draws the self/world line; the model's
// only job is to collapse a locally resolved impression into one fluent surface beat.
//
// The faculty, one holon, whole at its own scale (open src/write/, run its tests,
// swap the backend without touching parse/ or retrieve/):
//
//   fold.js       frontier + integral — the running state, γ-decayed firm dossier (§2)
//   folds.js      Map<Holder, Fold> — beliefOf, modelOf; the nested instrument root (§3,§9,§20)
//   scheduler.js  the DAG + the two gates (arity HARD, resolution SOFT) + posture (§3,§4)
//   cursor.js     the membrane — identity collapses to surface, no hashId leaks (§5)
//   spurt.js      the write loop — render a beat, surf its seam, advance the fold (§6)
//   witness.js    rebind + source veto + the provenance type law (§7)
//   voids.js      the open-Resolution query — the idle fuel + the "Open" ledger (§15,§16)
//   idle.js       the governed idle loop — reafferent, firewalled, self-terminating (§15)
//
// The Streaming Answer (docs/streaming-answer.md) points that same loop at the
// retrieval subgraph, so a grounded answer is realised one streamed sentence per
// surfer stop:
//   plan.js       the span→cell resolver — a surfer stop becomes a cursor cell (§2)
//   frame.js      the piece-grain frame — each beat's site, measured not declared (§8)
//   answer.js     the streaming answer loop — beat per stop, bound by the witness (§4)
//
// The formal event op(Site, Resolution, Provenance, t) and the me-ness type law live
// in the genome (core/event.js, core/provenance.js) because the event vocabulary and
// the self/world line are the system's, not this faculty's.

export {
  createFold, DEFAULT_GAMMA, DEFAULT_KEEP,
} from './fold.js';
export {
  createFolds, INSTRUMENT, READER, STATUS,
  beliefNotation, isModeled, canAnchor, beliefValue,
} from './folds.js';
export {
  schedule, propagateResolution, arityReady, judge, overclaims, groupByGranularity,
} from './scheduler.js';
export { buildCursor, assertNoLeak, serialize } from './cursor.js';
export { witness, rebind, groundedClaim, claimsOf } from './witness.js';
export { spurt, surfDraft, draftSurprise, writeLoop, stubModel, advanceFold } from './spurt.js';
export { openLedger, openResolutions, isOpen, pickVoid, HEDGE_BELOW } from './voids.js';
export { createIdleLoop, seededRng, RESTING, SURFING } from './idle.js';
export { surfToPlan, stopToCell } from './plan.js';
export { frameAt, SITES } from './frame.js';
export { streamAnswer } from './answer.js';
export { foldImpression } from './impression.js';
// Writing is reading backwards — the demonstrable kernel (the holon above is the
// production path). Referring-expression generation by INVERSE coref (emit a pronoun
// only where the reader's field resolves it back to the meant entity — gender
// conformance + γ-activation + distinctness, the reading rules run in reverse), with the
// me-ness/self line (given = perceiver/not-mine; generated = enactor/mine; read back =
// self) and a separate reader-model thread (theory of mind). Concept→traverse→words:
// hold the activated graph as the imagistic concept, traverse it for the order of saying.
export { createReaderModel, writeReferring } from './refer.js';
export { conceptToPlan, speakConcept } from './traverse.js';
// Gender inferred by reading (γ-recency over the committed entities + the lexical gender of
// the pronouns that corefer to them) — not a name table. Silent where the text gives no
// evidence, so the referrer falls back to the name rather than fabricating "it".
export { inferGenders } from './genders.js';
// The phraser → talker hand-off: this engine determines the grounded propositions (content,
// fabrication-incapable); an LLM talker only rewords them fluently, behind a propositional
// veto. phraserBrief packages the determined content; talkThenVerify realises it and strips
// any proposition the talker added that the document does not witness.
export { phraserBrief, realizationPrompt, talkThenVerify } from './brief.js';
// Thinking is the phraser→talker arc turned INWARD: voice an impression to yourself, read
// your own words back (READ_BACK-of-prior-self), let the hearing re-focus the graph, voice
// again — inner speech as spreading activation, grounded, firewalled (every thought is mine
// and cannot witness), self-terminating. The phraser is the inner voice; no model needed.
export { think, everyThoughtIsMine, worthSayingAloud, resolveVoids, inquire } from './think.js';
// Grammatical encoding (surface only): join adjacent same-subject clauses into one
// sentence with a compound predicate — the standard NLG aggregation move, so the
// generator says "He woke, saw his legs, and turned" rather than three choppy clauses. It
// does not re-inflect verbs or re-decide reference; provenance/self pass through.
export { realize, speak } from './realize.js';
// A grammar rule held and tested — the write-side EVA: apply while it reads back, toggle off
// when it fails. Pronominalisation and aggregation are governed by it, as gender is in coref.
export { createRule } from './eva.js';
