// A frame — the unit the enacted loop runs over.
//
// A frame is the set of terms the reading has established at a layer, at a point
// in read time. It is NOT the depicted DEF (a clause's classified phasepost cell,
// classify/) — that is content, a perception of what a clause reports. A frame is
// the reading's OWN standing commitment: "as of here, this layer is about these
// terms," against which the next particular is tested. The depicted loop is the
// transformation classified in the text; the frame belongs to the enacted loop,
// the reading's act of establishing its terms (§2).
//
// The frame carries the two things the loop turns on: a running STRAIN
// accumulator (the sum of surprise from EVAs tested against it) and the REC
// THRESHOLD it has not yet crossed. When strain reaches threshold the frame can no
// longer hold its terms and the owning layer RECs it (loop.js) — anomaly
// accumulation to crisis, the protective belt giving way (§1).
//
// The live frame is mutable in exactly one field — `strain` — because strain is
// inherently a running sum over read time. Everything else is fixed at the cursor
// the frame was set. The log records frozen SNAPSHOTS (snapshotFrame); the live
// accumulator lives only inside the loop, and the fold reconstitutes it by replay.

export const createFrame = ({ layer, cursor, terms = [], threshold }) => ({
  layer,
  cursor,                                 // the read-time point the frame was set at
  terms: Object.freeze([...terms]),       // the terms this layer currently stands on
  threshold,                              // the REC threshold — the size of the belt
  strain: 0,                              // running Σ surprise from EVAs against it
});

// A frozen snapshot for the log — a frame as it stood, without its live mutable
// accumulator. What an enacted DEF or REC event carries; replay reads it back.
export const snapshotFrame = (frame) => Object.freeze({
  layer: frame.layer,
  cursor: frame.cursor,
  terms: frame.terms,
  threshold: frame.threshold,
});

// Two frames share terms when their term-sets are equal, order-insensitive. Used
// by the thrash detector (§11): a layer whose RECs keep re-installing a term-set it
// just left is oscillating between two frames, not reading — the threshold error
// made visible, never mistaken for genuine turbulence.
export const sameTerms = (a, b) => {
  const sa = new Set(a || []), sb = new Set(b || []);
  if (sa.size !== sb.size) return false;
  for (const t of sa) if (!sb.has(t)) return false;
  return true;
};
