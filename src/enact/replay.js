// The fold — replay the enacted events to a cursor and reconstitute the reader's
// frames as of that cursor.
//
// The reading at a cursor IS the cross-layer enacted loop replayed to that cursor
// and no further (§5, §7, §8). Fold to an earlier cursor and the frames are
// younger — they have survived fewer tests and absorbed less cross-layer strain,
// and may still hold terms a later particular will break. The baker and the
// unreliable narrator are the same referent under a document frame at two ages of
// the loop; the fold reconstitutes the frame as of the cursor by replaying the
// enacted loop to that point. This is the same fold-decides discipline as
// projectGraph: a pure function of (events, cursor), because the loop's generation
// order is all the fold needs — the order is the reading's arrow of time, and any
// sorted or grouped view would destroy exactly the temporal structure being read.

import { sameTerms } from './frame.js';

const round = (x) => Math.round(x * 1000) / 1000;

export const replayFrames = (events, cursor = Infinity) => {
  const frames = new Map();   // layer → reconstituted live frame (terms, strain, …)
  const recs = [];            // RECs fired up to the cursor, in order

  for (const e of events) {
    // Never read past the fold point — the arrow of time. Events are in generation
    // order and the loop runs forward, so cursors are non-decreasing across the
    // log: once one event is past the cursor, all the rest are too.
    if (e.cursor > cursor) break;

    if (e.op === 'DEF') {
      // A frame is established (initial, or installed by a REC). Strain resets,
      // because strain is measured against THIS frame from here forward.
      frames.set(e.layer, { ...e.frame, strain: 0 });
    } else if (e.op === 'EVA') {
      // A particular tested against a frame adds its strain delta to that frame's
      // accumulator — including a cross-layer EVA, which adds to the higher frame.
      const f = frames.get(e.frameLayer);
      if (f) f.strain = round(f.strain + (e.strainDelta || 0));
    } else if (e.op === 'REC') {
      recs.push({
        layer: e.layer, cursor: e.cursor,
        from: e.from, strainSum: e.strainSum, forcedBy: e.forcedBy, seq: e.seq,
      });
    }
  }
  return { cursor, frames, recs };
};

// The REC rate over read time — the convergence signal (§11). A converging spiral
// RECs ever more rarely: the eigenform, the reading stable under further reading.
// A text the reading cannot settle keeps RECing late — a real finding about the
// text, not a failure to suppress. A thrash — RECs oscillating between two
// term-sets — is the threshold set too low, surfaced here so it is visible as the
// error it is rather than mistaken for genuine turbulence.
export const loopStats = (events) => {
  const installs = new Map();   // layer → [{ cursor, terms, viaRec }]  (every DEF)
  const recCursors = new Map(); // layer → [cursor]                     (every REC)

  for (const e of events) {
    if (e.op === 'DEF') {
      if (!installs.has(e.layer)) installs.set(e.layer, []);
      installs.get(e.layer).push({ cursor: e.cursor, terms: e.frame.terms, viaRec: e.producedBy !== 'initial' });
    } else if (e.op === 'REC') {
      if (!recCursors.has(e.layer)) recCursors.set(e.layer, []);
      recCursors.get(e.layer).push(e.cursor);
    }
  }

  const out = {};
  for (const layer of new Set([...installs.keys(), ...recCursors.keys()])) {
    const seq = installs.get(layer) || [];
    const cursors = recCursors.get(layer) || [];
    const gaps = cursors.slice(1).map((c, i) => c - cursors[i]);
    // Converging: the gaps between RECs are growing — restructuring is getting
    // rarer as the frame stabilises. Needs at least two gaps to read a trend.
    const converging = gaps.length >= 2 && gaps[gaps.length - 1] >= gaps[0];
    // Thrash: an installed term-set returns the one from two installs back while
    // differing from the one between — A → B → A, the frame oscillating, not
    // settling. The detector of a threshold set too low.
    let thrash = false;
    for (let i = 2; i < seq.length; i++) {
      if (sameTerms(seq[i].terms, seq[i - 2].terms) && !sameTerms(seq[i].terms, seq[i - 1].terms)) {
        thrash = true; break;
      }
    }
    out[layer] = { recs: cursors.length, cursors, gaps, converging, thrash };
  }
  return out;
};
