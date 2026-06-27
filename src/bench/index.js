// The bench holon — scoring the surfaced structured note directly, no talker
// (docs/surfing-success.md). The note is the artifact under test: the bench
// surfaces it for many angles per target, scores it against a frozen gold note
// (recall × precision, gated by groundedness and by the forbidden/silence gates),
// and aggregates per target into a consistency-discounted battery score.

export { surfaceNote, noteMentions, DEFAULT_FORCES } from './note.js';
export { scoreProbe } from './score.js';
export { aggregateTarget, aggregateBattery } from './aggregate.js';
export { TARGETS, CORPUS_PATH } from './battery.js';
export {
  runBattery, sweepForce, chargeValenceRegression, surpriseDepthCheck, rereadRegression,
} from './harness.js';
