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
import { createEnactedLoop } from './loop.js';
import { replayFrames, loopStats } from './replay.js';
import { buildMeaningRead } from './meaning.js';

export { createEnactedLoop, DEFAULT_THRESHOLDS, DEFAULT_CONFIRM_BAND } from './loop.js';
export { replayFrames, loopStats } from './replay.js';
export { createFrame, snapshotFrame, sameTerms } from './frame.js';
export { isEnacted, isDepicted, assertSingleRegister } from './register.js';
export { buildMeaningRead } from './meaning.js';

// The cheap surprise provider — the mechanical γ-mass surprise over the field, the
// only strain honestly computable until the meaning reader is live (§11). The terms
// are the figures the reading predicts are in play at the cursor: a real,
// mechanical term-set the frame stands on, re-read whenever a frame is set, so a
// document frame (re-read only on its rare RECs) stays older and stickier than a
// proposition frame — which is why the same referent reads differently at two ages
// of the loop.
const cheapRead = (doc) => (cursor) => {
  const r = readingAt(doc, cursor);
  return { surprise: r.surprise, terms: r.predicted?.figures || [] };
};

// Build the full enacted log for a doc once, in generation order, and cache it. The
// log is append-only and the arrow runs forward, so the whole-document log is the
// superset of every cursor's reading; the fold (replayFrames) reconstitutes any
// cursor from it. Same discipline as projectGraph's memo — keyed by the doc, which
// is immutable post-parse — so the loop is run once, not per cursor move.
const LOGS = new WeakMap();
const enactedLogOf = (doc, opts) => {
  const cached = LOGS.get(doc);
  if (cached && !opts) return cached;
  const units = doc.units || doc.sentences || [];
  const loop = createEnactedLoop({ read: cheapRead(doc), ...(opts || {}) });
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

// The DEEP reading — the same fold, driven by the meaning reader instead of the
// γ-mass skeleton (§11). When the embedder measures meaning, the surprise is the
// prediction error in the centroids' space, so frames restructure on semantic
// turns the cheap reader is blind to. Async (embedding is async); the meaning log
// is built once per (doc, embedder) and cached, so subsequent cursor folds are
// the same cheap replay. Under the hash organ it falls back to the cheap reader —
// callers can always await this and get an honest result either way.
const MEANING_LOGS = new WeakMap();   // doc → Map<embedderId, events>
export const enactedReadingMeaning = async (doc, cursor, { embedder, ...opts } = {}) => {
  if (!embedder?.measuresMeaning) return enactedReadingTo(doc, cursor, opts);   // firewall → skeleton

  let perDoc = MEANING_LOGS.get(doc);
  if (!perDoc) { perDoc = new Map(); MEANING_LOGS.set(doc, perDoc); }
  let events = perDoc.get(embedder.id);
  if (!events) {
    const mr = await buildMeaningRead(doc, embedder, {
      termsAt: (c) => readingAt(doc, c).predicted?.figures || [],
    });
    if (!mr) return enactedReadingTo(doc, cursor, opts);       // could not measure → skeleton
    const units = doc.units || doc.sentences || [];
    const loop = createEnactedLoop({
      read: (c) => ({ surprise: mr.surprise[c], terms: mr.terms[c] }),
      ...opts,
    });
    if (units.length) loop.runTo(units.length - 1);
    events = loop.events;
    perDoc.set(embedder.id, events);
  }
  const fold = replayFrames(events, cursor);
  return { ...fold, stats: loopStats(events), events, reader: 'meaning' };
};
