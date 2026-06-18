// The enact holon — the enacted DEF–EVA–REC loop (the significance engine).
//
// Two loops, kept apart (§2, §10):
//
//   DEPICTED   classify/   a clause's phasepost perception — what a clause
//               reports — content, timeless, recomputable, tagged
//               `kind:'phasepost'`. NOT this holon.
//   ENACTED    this holon   the reading's own act of establishing terms (DEF),
//               testing particulars against them (EVA), and restructuring its
//               frame when the testing breaks it (REC) — temporal, ordered,
//               cross-layer, tagged `register:'enacted'`. The cognition.
//
// createEnactedLoop is pure on an injected `read(cursor) → { surprise, terms }`.
// enactedReadingTo wires it to the cheap γ-mass surprise that already runs over
// the whole document (read/readingAt), builds the enacted log once per doc in
// generation order, and folds it to a cursor — the mechanical skeleton the spec
// scopes for today, to be deepened with no shape change once the meaning reader is
// live (§11).

import { readingAt } from '../read/index.js';
import { createEnactedLoop, calibrateReader } from './loop.js';
import { replayFrames, loopStats } from './replay.js';
import { buildMeaningRead } from './meaning.js';

export { createEnactedLoop, calibrateReader, DEFAULT_THRESHOLDS, DEFAULT_CONFIRM_BAND } from './loop.js';
export { replayFrames, loopStats } from './replay.js';
export { createFrame, snapshotFrame, sameTerms, DEFAULT_STRAIN_LEAK } from './frame.js';
export { isEnacted, isDepicted, assertSingleRegister } from './register.js';
export { buildMeaningRead } from './meaning.js';

// The cheap surprise provider — now the BAYESIAN γ-mass surprise over the field
// (docs/bayesian-surprise.md), the only strain honestly computable until the meaning
// reader is live (§11). It rides `bayes` (the significance channel), not `surprise`
// (novelty), so a frame breaks on a genuine restructuring of the reading rather than
// on an inert improbability. The terms are the figures the reading predicts are in
// play at the cursor: a real, mechanical term-set the frame stands on, re-read
// whenever a frame is set, so a document frame (re-read only on its rare RECs) stays
// older and stickier than a proposition frame — which is why the same referent reads
// differently at two ages of the loop.

// Build the full enacted log for a doc once, in generation order, and cache it. The
// log is append-only and the arrow runs forward, so the whole-document log is the
// superset of every cursor's reading; the fold (replayFrames) reconstitutes any
// cursor from it. Same discipline as projectGraph's memo — keyed by the doc, which
// is immutable post-parse — so the loop is run once, not per cursor move.
//
// The readings are computed once over the whole document, both to drive the loop and
// to CALIBRATE the band + thresholds to this text's `bayes` scale (calibrateReader):
// `bayes` clusters far below the old surprisal band, so without the fit the frame
// goes numb. A caller's explicit confirmBand/thresholds (opts) always win.
const LOGS = new WeakMap();
const enactedLogOf = (doc, opts) => {
  const cached = LOGS.get(doc);
  if (cached && !opts) return cached;
  const units = doc.units || doc.sentences || [];
  const readings = units.map((_, c) => readingAt(doc, c));
  const cal = calibrateReader(readings.map(r => r.bayes));
  const loop = createEnactedLoop({
    read: (c) => ({ surprise: readings[c]?.bayes ?? 0, terms: readings[c]?.predicted?.figures || [] }),
    confirmBand: cal.confirmBand,
    thresholds: cal.thresholds,
    ...(opts || {}),                  // an explicit band/thresholds overrides the fit
  });
  if (units.length) loop.runTo(units.length - 1);
  if (!opts) LOGS.set(doc, loop.events);
  return loop.events;
};

// The reader's frames as of a cursor — the cross-layer enacted loop replayed to
// that cursor (§7). Returns the frames per layer (terms + live strain), the RECs
// fired up to here, the convergence/thrash stats over the whole reading, and the
// enacted log itself (generation order). The whole point of folding to a cursor is
// that the reading there is whatever the loop had arrived at by then, no further.
export const enactedReadingTo = (doc, cursor, opts) => {
  const events = enactedLogOf(doc, opts);
  const fold = replayFrames(events, cursor);
  return { ...fold, stats: loopStats(events), events, reader: 'cheap' };
};

// The meaning reader's REC thresholds, on its own scale. The meaning surprise
// (1 − cos) lives far above the γ-mass band, so the skeleton's 1.5/4 would fire on
// every line; these are measured against the worked corpus (Pride and Prejudice,
// real all-MiniLM embeddings) to a converging, non-thrashing reading — the
// document frame restructuring on the order of once per few chapters. Measured,
// per reader, overridable (§11).
export const MEANING_THRESHOLDS = Object.freeze({ proposition: 5, document: 16 });

// The DEEP reading — the same fold, driven by the meaning reader instead of the
// γ-mass skeleton (§11). When the embedder measures meaning, the surprise is the
// prediction error in meaning space, so frames restructure on semantic turns the
// cheap reader is blind to. Async (embedding is async); the per-clause embeddings
// are built once per (doc, embedder) and cached, so subsequent cursor folds only
// re-run the cheap loop. Under the hash organ it falls back to the cheap reader —
// callers can always await this and get an honest result either way.
const MEANING_READS = new WeakMap();   // doc → Map<embedderId, { surprise, terms } | null>
export const enactedReadingMeaning = async (doc, cursor, { embedder, confirmBand, thresholds, ...opts } = {}) => {
  const fallback = () => enactedReadingTo(doc, cursor, { confirmBand, thresholds, ...opts });
  if (!embedder?.measuresMeaning) return fallback();           // firewall → skeleton

  let perDoc = MEANING_READS.get(doc);
  if (!perDoc) { perDoc = new Map(); MEANING_READS.set(doc, perDoc); }
  let mr = perDoc.get(embedder.id);
  if (mr === undefined) {
    mr = await buildMeaningRead(doc, embedder, { termsAt: (c) => readingAt(doc, c).predicted?.figures || [] });
    perDoc.set(embedder.id, mr);                               // cache the embeddings (incl. a null result)
  }
  if (!mr) return fallback();                                  // could not measure → skeleton

  // Self-calibrate the confirm band to a "normal step" in THIS text's meaning
  // space — the median surprise — because the 1 − cos scale is text- and
  // embedder-dependent and far above the γ-mass band (sentence cosines cluster).
  // Half the lines confirm, half strain, the same balance the γ-mass band struck
  // at 0.25. Thresholds default to the meaning scale, calibrated on the corpus.
  const band = confirmBand ?? medianOf(mr.surprise);
  const units = doc.units || doc.sentences || [];
  const loop = createEnactedLoop({
    read: (c) => ({ surprise: mr.surprise[c], terms: mr.terms[c] }),
    confirmBand: band,
    thresholds: thresholds ?? MEANING_THRESHOLDS,
    ...opts,
  });
  if (units.length) loop.runTo(units.length - 1);
  const fold = replayFrames(loop.events, cursor);
  return { ...fold, stats: loopStats(loop.events), events: loop.events, reader: 'meaning', confirmBand: round3(band) };
};

const medianOf = (xs) => {
  if (!xs?.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round3 = (x) => Math.round(x * 1000) / 1000;
