// The predict holon — the Cursor Predictor.
//
// A grounded, testable predictor over the next MOVE (an operator firing with a Site
// and a Resolution), not the next word. The prediction space is the ten-symbol move
// alphabet, the prior is a fusion of recurrence from the log, structure from the
// fold, and a small move-grammar learned once — no model call, no ingested corpus,
// because the prediction is over a small grammar conditioned on a log you already
// have (read/predict.js is the OPEN, model-driven prediction this stands apart from).
//
// Two stages, kept separate (§5): this holon predicts the MOVE and is tested on it
// alone — predicted vs actual, surprise, sharpness, recomputed causally at each
// cursor. The realizer that renders a predicted move into prose is a later piece,
// built and tested only after move-prediction is grounded and sharp where it should.

export { MOVE_ALPHABET, buildMoveLog, moveNotation, symbolOf } from './movelog.js';
export { recurrencePrior } from './recurrence.js';
export { structuralPrior } from './structure.js';
export { learnGrammar, grammarPrior, DEFAULT_GRAMMAR } from './grammar.js';
export { predictNextMove } from './predictor.js';
export {
  scoreSeries, persistenceAccuracy, marginalAccuracy, shuffleMoves,
} from './evaluate.js';
