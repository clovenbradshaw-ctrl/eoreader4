// Direction — "a sense of where we're going", as p(next) over the SELF.
//
// The arc plans its sections from retrieved evidence; a continuation has no
// retrieval to plan from — it has its own becoming. So the direction is the
// forward move-distribution (predict/predictor.js) run over a move-log built
// from the units generated SO FAR. This is spec-generation.md Piece 3's source
// switch: the same predictor the reader uses, pointed at self instead of doc.
//
// THE WELD (docs/long-generation.md). Each accepted unit carries the floor's
// verdict; we read it back as the per-cursor STRAIN the structural prior reads
// (predict/structure.js): a unit that drifted (low bound fraction) raises strain,
// so the next draw leans toward REC/VOID — the engine that starts confabulating
// stops itself. strain = 1 − boundFraction; the structural prior does the rest.

import { predictNextMove } from '../predict/predictor.js';
import { MOVE_ALPHABET } from '../predict/movelog.js';

// The move the loop opens with when there is no self-history yet: CON, the
// workhorse grounded move (assert a relation tied to a span). A draw cannot run
// over an empty log, so the first step is seeded rather than predicted.
export const SEED_MOVE = 'CON';

// Build the self move-log the predictor runs over. One move per accepted unit —
// the move-type it realized — and a frame per cursor whose strain is the floor's
// verdict read back. `frameByCursor` is keyed by the unit's `cursor`, exactly the
// shape structuralPrior expects (the per-unit fold state).
export const selfMoveLog = (units = []) => {
  const moves = units.map((u, i) => Object.freeze({
    op: u.move || SEED_MOVE,
    cursor: i,
    i,
  }));
  const frameByCursor = units.map((u) => {
    const bf = typeof u.boundFraction === 'number' ? u.boundFraction : 1;
    const strain = clamp01(1 - bf);          // drift IS strain — the weld
    return Object.freeze({
      // ratio is strain against threshold; with no separate threshold the drift
      // fraction is the ratio directly (1 = a unit that bound nothing).
      ratio: strain,
      // a clean unit reads as a live (non-flat) field; a fully-drifted unit reads
      // as flat so the structural prior also nudges NUL/VOID, not only REC.
      bayes: bf > 0.5 ? 1 : 0,
      newFigure: (u.sources || []).length > 0,
      brokeHere: false,
    });
  });
  return { moves, frameByCursor, alphabet: MOVE_ALPHABET };
};

// Predict the next move from the self-history. Returns the drawn move, the ranked
// posterior, the sharpness, and `flat` — the predictor's VOID, the honest "no
// grounded expectation of what comes next" that terminates the loop.
//
// temperature is the quantile up the surprise distribution (spec-generation.md):
// 0 (default) is argmax — the low-surprise draw that stays in frame; > 0 reaches
// further up for a deliberate move. The reach is a rank index into the posterior,
// so "more surprising" is calibrated, not a guess.
export const predictDirection = (units = [], opts = {}) => {
  if (units.length === 0) {
    return { move: SEED_MOVE, seeded: true, flat: false, sharpness: null, posterior: null };
  }
  const log = selfMoveLog(units);
  const i = log.moves.length - 1;            // predict the move AFTER the last unit
  const pred = predictNextMove(log, i, { weights: opts.weights });

  // The temperature draw: reach `temperature` ranks up the (descending) posterior,
  // clamped to the alphabet. T=0 → rank 0 → argmax. Deterministic given T, so a
  // run is reproducible (no RNG in this layer — Math.random is unavailable here).
  const reach = Math.max(0, Math.min(pred.posterior.length - 1, Math.round(opts.temperature || 0)));
  const move = pred.posterior[reach][0];

  return {
    move,
    seeded: false,
    flat: pred.flat,
    sharpness: pred.sharpness,
    concentration: pred.concentration,
    posterior: pred.posterior,
    top: pred.top,
  };
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
