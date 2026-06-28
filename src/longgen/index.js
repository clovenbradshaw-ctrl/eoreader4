// The longgen holon — long generation across messages (docs/long-generation.md).
//
// spec-generation.md Piece 3 (the autoregressive closure) wired from pieces that
// already exist: the conversation fold (converse), the forward move-predictor
// (predict), and the arc's realize+floor (arc). The one new part is the self-fold
// weld — the floor's verdict read back as the next prediction's strain — built in
// direction.js. `longgen` orchestrates; it imports only public faces.

export { runContinuation } from './continuation.js';
export { predictDirection, selfMoveLog, SEED_MOVE } from './direction.js';
export { resolveProposition } from './resolve.js';
