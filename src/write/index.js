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
