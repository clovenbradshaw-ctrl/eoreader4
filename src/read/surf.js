// The surfer — a surfer with no pilot. (docs/surfing-the-fold.md)
//
// The fold used to read significance at one fixed cursor: the top retrieval hit.
// That is a router-style CHOICE, and a choice is the wrong category. The surfer
// replaces it. It does not ask where to look; it measures where the field is
// steepest and steps there. The field is the witness, the gradient is the verdict,
// the step is mechanical — the witness-does-not-decide rule applied to navigation.
//
// Three axes, three quantities the reading already maintains:
//
//   focus    the warmest figure (γ-mass argmax) — where the eye sits.
//   cursor   advance through the flat, arrest on the peaks of BAYESIAN surprise
//            (read/reading.js `bayes`), so it arrests where the reading was
//            REWRITTEN, not where a token merely looked odd (the TV-snow fix).
//   frame    a frame breaking under accumulated strain (a REC) is an arrest too —
//            the same DEF·EVA·REC loop the significance engine runs, calibrated to
//            the reach, so the cursor axis and the frame axis read the same scalar.
//
// Every move is a pure function of the log and the field: same document, same
// anchor, same path. The frame axis lives in the enact holon (loop.js, a leaf with
// no read dependency), so this import stays acyclic.

import { readingAt } from './reading.js';
import { createEnactedLoop, calibrateReader } from '../enact/loop.js';

// The reach: a little behind the anchor (to read the frame it sits inside), mostly
// ahead (a surf rides forward, and the arrow of time orders the frame axis).
const DEFAULT_REACH = Object.freeze({ behind: 4, ahead: 16, maxStops: 5 });

export const surfFold = (doc, anchor = 0, opts = {}) => {
  const units = doc?.units || doc?.sentences || [];
  const S = units.length;
  const empty = { anchor: 0, stops: [], peak: 0, focus: null, field: [], recCursors: [], rode: 'bayesian-figure' };
  if (S === 0) return empty;

  const { behind, ahead, maxStops } = { ...DEFAULT_REACH, ...opts };
  const a  = clampIdx(anchor, S);
  const lo = Math.max(0, a - behind);
  const hi = Math.min(S - 1, a + ahead);

  // Measure the field at every cursor in the reach — the random-access regime: the
  // field is stateless in the cursor, so it can be read anywhere and leapt to.
  const readings = [];
  for (let c = lo; c <= hi; c++) readings[c] = readingAt(doc, c);
  const bayesAt = (c) => readings[c]?.bayes ?? 0;
  const figAt   = (c) => readings[c]?.predicted?.figures?.[0] || null;

  // The per-cursor trace (warmth + surprise + novelty), for the audit.
  const field = [];
  for (let c = lo; c <= hi; c++) {
    field.push({ idx: c, focus: figAt(c), bayes: readings[c].bayes, surprisalBits: readings[c].surprisalBits });
  }
  const reachBayes = field.map(f => f.bayes);

  // The FRAME axis: run the enacted loop over the reach, calibrated to the reach, and
  // collect the cursors where a frame broke. The same loop the significance engine
  // runs, so cursor and frame never disagree — both ride `bayes`.
  const cal = calibrateReader(reachBayes);
  let recCursors = [];
  try {
    const loop = createEnactedLoop({
      read: (c) => ({ surprise: bayesAt(c), terms: readings[c]?.predicted?.figures || [] }),
      confirmBand: cal.confirmBand,
      thresholds:  cal.thresholds,
    });
    for (let c = lo; c <= hi; c++) loop.step(c);
    recCursors = [...new Set(loop.events.filter(e => e.op === 'REC').map(e => e.cursor))]
      .filter(c => c >= lo && c <= hi).sort((x, y) => x - y);
  } catch { recCursors = []; }

  // The CURSOR axis: arrest on the peaks. The arrest band is calibrated to the reach
  // (the median), not a fixed floor — `bayes` clusters low, so a constant floor would
  // arrest nowhere. The anchor is always a stop (retrieval set it down); every REC
  // cursor is always a stop (a frame broke there); the strongest remaining peaks fill
  // toward maxStops, never the flat between them.
  const band = medianOf(reachBayes);
  const stops = new Set([a, ...recCursors]);
  const peaks = field
    .filter(f => f.bayes > band && !stops.has(f.idx))
    .sort((x, y) => y.bayes - x.bayes);
  for (const p of peaks) {
    if (stops.size >= maxStops) break;
    stops.add(p.idx);
  }
  const stopList = [...stops].sort((x, y) => x - y);

  // The peak: the steepest stop — where to take the significance reading.
  let peak = a;
  for (const c of stopList) if (bayesAt(c) > bayesAt(peak)) peak = c;

  // The focus: the warmest figure across the stops — each stop votes its warmest
  // figure; the peak's figure breaks ties so the eye sits where the field is steepest.
  const votes = new Map();
  for (const c of stopList) { const f = figAt(c); if (f) votes.set(f, (votes.get(f) || 0) + 1); }
  let focus = figAt(peak);
  let best  = votes.get(focus) || 0;
  for (const [f, v] of votes) if (v > best) { best = v; focus = f; }

  return { anchor: a, stops: stopList, peak, focus, field, recCursors, rode: 'bayesian-figure' };
};

const clampIdx = (x, S) => Math.max(0, Math.min(S - 1, x | 0));
const medianOf = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
