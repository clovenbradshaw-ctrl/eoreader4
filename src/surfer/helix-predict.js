// The helix-aware predictor — predict the move against the frame, and let a stale
// basis be a REC, not endless surprise.
//
// sequence.js predicts the next unit by ABSOLUTE transitions — the Existence rung of
// the helix. That predictor reads a reframe (a melody's key change, a register shift)
// as pure novelty forever: the TV-snow failure at the meaning layer, high surprise on a
// signal that is not random, only re-based. This predictor climbs a rung. It runs the
// same n-gram at two rungs at once:
//
//   EXISTENCE — the absolute unit (the pitch, the entity). Re-groundable.
//   STRUCTURE — the MOVE between units (the interval, the relative step). Frame-relative
//               by construction, so it survives a reframe the absolute rung cannot.
//
// and reads the DIFFERENCE between the two rungs as the helix's own diagnosis:
//
//   absolute high  & move low   → MIS-FRAMED: the frame moved, the pattern held. The
//                                 honest move is not more data — it is a new frame. Fire
//                                 REC(Paradigm,…) and RE-GROUND the absolute rung (the
//                                 helix turning: relocate the tonic, drop to a bare NUL
//                                 in the new frame and predict afresh).
//   absolute high  & move high  → genuine novelty / noise (under-read or true random):
//                                 reserve, do not relocate — there is no frame to find.
//   absolute low                → the frame still fits: predict, no REC.
//
// The thresholds are MEASURED, not set: a rung's surprise is "high" when it beats the
// deriveNull its own surprise history throws up by chance (the repo's Born rule), and
// the move rung is "holding" when it sits below its own running median. Witness does not
// decide — the field decides, the surfer reads it. The STRUCTURE rung needs a notion of
// "move"; for a numeric signal (MIDI, a scalar stream) that is the first difference, and
// it is omnimodal exactly there — hand it a melody and it predicts intervals, hand it any
// scalar series and it predicts steps. A non-numeric stream (entity ids) has no cheap
// move without the relation labels, so the predictor degrades to the Existence rung
// alone and says so (`rungs: ['existence']`).

import { deriveNull } from '../core/index.js';

const RESERVE = 1.0;
const SEP = '';

// ── the n-gram core: interpolated backoff with a novelty reserve ──────────────
const countsOf = (seq, order) => {
  const uni = new Map();
  const grams = Array.from({ length: order + 1 }, () => new Map());
  for (let i = 0; i < seq.length; i++) {
    uni.set(seq[i], (uni.get(seq[i]) || 0) + 1);
    for (let j = 1; j <= order && i - j >= 0; j++) {
      const ctx = seq.slice(i - j, i).join(SEP);
      const row = grams[j].get(ctx) || new Map();
      row.set(seq[i], (row.get(seq[i]) || 0) + 1);
      grams[j].set(ctx, row);
    }
  }
  return { uni, grams, vocab: uni.size };
};

const probOf = (model, ctx, next, order) => {
  const { uni, grams, vocab } = model;
  const V = Math.max(1, vocab);
  const sum = (m) => { let s = 0; for (const w of m.values()) s += w; return s; };
  const Zuni = sum(uni) + RESERVE;
  let p = ((uni.get(next) || 0) + RESERVE / V) / Zuni;          // add-reserve-smoothed unigram
  for (let j = 1; j <= order && j <= ctx.length; j++) {
    const row = grams[j].get(ctx.slice(ctx.length - j).join(SEP));
    if (!row) continue;
    const Zrow = sum(row) + RESERVE;
    const alpha = (Zrow - RESERVE) / (Zrow - RESERVE + 1);       // confidence in this order
    const pr = ((row.get(next) || 0) + RESERVE / V) / Zrow;
    p = alpha * pr + (1 - alpha) * p;
  }
  return Math.max(p, 1e-6);
};

// the predictive distribution (for generation) — ranked continuations given a context.
const distOf = (model, ctx, order) => {
  const cands = new Set(model.uni.keys());
  const ranked = [...cands].map(u => ({ u, p: probOf(model, ctx, u, order) }))
    .sort((a, b) => b.p - a.p);
  const Z = ranked.reduce((s, r) => s + r.p, 0) || 1;
  return ranked.map(r => ({ u: r.u, p: r.p / Z }));
};

const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x) => Math.round(x * 1000) / 1000;

const isNumeric = (seq) => seq.length > 0 && seq.every(x => typeof x === 'number');

// ── helixPredict: read the stream at both rungs, diagnose, re-ground ──────────
//
//   seq      the unit stream (numbers → the move rung is the first difference;
//            otherwise the Existence rung alone).
//   order    n-gram context length (default 2 — a phrase, not a single step).
//   window   the smoothing window for the "sustained" test (a single spike is not a
//            reframe; hysteresis, cube.md #8).
//   alpha    the Born budget for the deriveNull that calls a surprise "high".
//
// Returns { rungs, steps, recs, summary }. Each step carries the per-rung surprise (in
// bits), the carrying rung, and whether a re-ground fired. `recs` are the measured
// frame relocations, each an append-only REC(Paradigm, Composing) with its surprise-delta.
export const helixPredict = (seq, { order = 2, window = 3, alpha = 0.05 } = {}) => {
  const moveAvailable = isNumeric(seq);
  const rungs = moveAvailable ? ['existence', 'structure'] : ['existence'];
  const moves = moveAvailable ? seq.slice(1).map((x, i) => x - seq[i]) : null;

  const steps = [];
  const recs = [];
  let anchorE = 0;                 // the Existence rung's ground — relocated on a REC
  const eHist = [], mHist = [];    // surprise histories, for the measured thresholds

  for (let at = order; at < seq.length; at++) {
    // EXISTENCE rung — absolute, predicted from the (possibly re-grounded) prefix.
    const eFrom = Math.max(anchorE, 0);
    const eModel = countsOf(seq.slice(eFrom, at), order);
    const eCtx = seq.slice(Math.max(eFrom, at - order), at);
    const eBits = -Math.log2(probOf(eModel, eCtx, seq[at], order));

    // STRUCTURE rung — the move, frame-relative, NEVER re-grounded (it is already
    // frame-free). moves[k] is the step into seq[k+1], so predicting seq[at] is
    // predicting moves[at-1] from the prior moves.
    let mBits = null;
    if (moveAvailable && at - 1 >= order) {
      const mModel = countsOf(moves.slice(0, at - 1), order);
      const mCtx = moves.slice(at - 1 - order, at - 1);
      mBits = -Math.log2(probOf(mModel, mCtx, moves[at - 1], order));
    }

    eHist.push(eBits); if (mBits != null) mHist.push(mBits);
    const eWin = mean(eHist.slice(-window));
    const mWin = mHist.length ? mean(mHist.slice(-window)) : null;

    // MEASURED thresholds: "high" beats the deriveNull of the rung's own surprise
    // history (the Born rule on the surprise distribution); "holding" sits below the
    // move rung's running median. Both need enough history to be measurable.
    const eHigh = deriveNull(eHist.slice(0, -1), { scale: 'linear', alpha });
    const eIsHigh = Number.isFinite(eHigh) && eWin > eHigh;
    const mIsHolding = mWin != null && mHist.length >= 4 && mWin < median(mHist.slice(0, -1));

    let carrying = 'existence';
    if (mWin != null && mWin < eWin) carrying = 'structure';

    // MIS-FRAMED → re-ground: the absolute rung rots while the move rung holds. Fire an
    // append-only REC and relocate the Existence ground to here (drop to a NUL in the
    // new frame). Sustained by the window, so a one-off spike does not trigger it.
    let regrounded = false;
    if (eIsHigh && mIsHolding && at - anchorE > window) {
      anchorE = at - order;                              // re-ground: forget the stale frame
      regrounded = true;
      recs.push(Object.freeze({
        at, op: 'REC', site: 'Paradigm', stance: 'Composing', cell: 'REC_Composing_Paradigm',
        surpriseDelta: round(eWin - (mWin ?? 0)),        // the basis-defeat margin = cost to move back
        rode: 'helix-misframe', reground: true,
      }));
    }

    steps.push({
      at, unit: seq[at],
      existenceBits: round(eBits),
      moveBits: mBits == null ? null : round(mBits),
      carrying, regrounded,
    });
  }

  const eAll = steps.map(s => s.existenceBits);
  const mAll = steps.map(s => s.moveBits).filter(x => x != null);
  return {
    rungs,
    steps,
    recs,
    summary: Object.freeze({
      meanExistenceBits: round(mean(eAll)),
      meanMoveBits: mAll.length ? round(mean(mAll)) : null,
      recCount: recs.length,
      // the diagnosis the flat predictor cannot make: a reframe is move-low while
      // absolute-high; true noise is both high.
      diagnosis: recs.length ? 'reframe(s) detected and re-grounded' :
        (mAll.length && mean(mAll) >= mean(eAll) ? 'no reframe; move rung no better' : 'frame stable'),
    }),
  };
};

// ── helixGenerate: draw forward at the carrying rung, frame-aware ─────────────
//
// Generation is the same object as recognition, drawn instead of scored. Drawing at the
// STRUCTURE rung — sample a MOVE and apply it to the current absolute state — generates
// coherently THROUGH a frame the absolute rung never saw: the learned shape, transposed.
// `repeat` re-grounds generation into a new register by seeding a new absolute start with
// the same move-grammar. Deterministic given `seed` (no Math.random — the workflow rule).
export const helixGenerate = (seq, { order = 2, n = 16, seed = 1, start = null, rung = 'structure' } = {}) => {
  const numeric = isNumeric(seq);
  let s = seed >>> 0;
  const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const draw = (ranked) => { const Z = ranked.reduce((a, r) => a + r.p, 0) || 1; let x = rnd() * Z; for (const r of ranked) { x -= r.p; if (x <= 0) return r.u; } return ranked[ranked.length - 1]?.u; };

  if (rung === 'structure' && numeric) {
    const moves = seq.slice(1).map((x, i) => x - seq[i]);
    const mModel = countsOf(moves, order);
    let cur = start != null ? start : seq[seq.length - 1];
    let mctx = moves.slice(-order);
    const out = [cur];
    for (let k = 0; k < n; k++) {
      const mv = draw(distOf(mModel, mctx, order));
      cur = cur + mv;                          // the move applied to the frame
      out.push(cur);
      mctx = [...mctx, mv].slice(-order);
    }
    return out;
  }
  // Existence rung fallback (or non-numeric): draw absolute units.
  const eModel = countsOf(seq, order);
  let ctx = start != null ? [start] : seq.slice(-order);
  const out = [...ctx];
  for (let k = 0; k < n; k++) {
    const u = draw(distOf(eModel, ctx, order));
    out.push(u);
    ctx = [...ctx, u].slice(-order);
  }
  return out;
};
