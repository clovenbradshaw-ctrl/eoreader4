// The enacted DEF–EVA–REC loop — the significance engine.
//
// This is the ENACTED loop, not the depicted one. The depicted loop (classify/)
// is content: a clause's phasepost perception, a Figure-grain reading of what a
// clause reports, timeless and recomputable at any cursor. The enacted loop is
// COGNITION: the reading establishing its own terms (DEF), testing its own
// particulars against them (EVA), and restructuring its own frame when the testing
// accumulates past what the frame can hold (REC). It is temporal, ordered, and
// cross-layer. It is the reading thinking. The two are never conflated in the log
// (§2, §10): a clause can report a REC in the story while the reading undergoes
// none, and the reading's frame can break on a clause that reports nothing of the
// kind.
//
// THE ARROW OF TIME is constitutive, not decoration (§5). The loop runs forward,
// one cursor at a time. Every EVA tests the frame as it stood at the cursor —
// never a frame from the future. Cross-layer influence is legal precisely because
// it is cross-layer AND backward in time: the higher frame that conditions a lower
// particular was established earlier in the reading than the particular it
// conditions. Remove the arrow and the loop is a paradox (the document frame
// conditions the proposition reading conditions the document frame, with no ground
// and no termination); keep it and the loop is a spiral that converges, or records
// honestly where it could not (§11).
//
// THE THROTTLE is surprise (§3, §6). Each EVA carries the per-particular
// divergence between what the frame predicted and what the line delivered. A
// confirming EVA (low surprise) holds the frame and adds nothing — assimilation,
// the frame absorbs. A straining EVA accumulates. REC fires when the running sum
// breaks the frame's threshold — never on a single anomaly; accommodation, the
// frame restructures. This is the same surprise that warms the activation field;
// here it drives restructuring, and its rate over read time is the reading's
// effort — a quiet stable reading or a turbulent hard one.
//
// THE DISCIPLINE (§7). The cross-layer EVA tests a frame; it does not author one.
// A lower particular can strain the document frame until the document layer fires
// its OWN REC, but the lower layer never reaches up and rewrites the higher frame
// by hand. A layer feeds EVAs upward and receives a frame downward; neither writes
// the other's frame. The owning layer is the one that decides, by RECing its own
// frame when the strain it accumulated breaks it.
//
// THE SKELETON (§11). The rich, meaning-distance surprise that distinguishes a
// frame breaking from a word merely being unusual needs the geometric reader
// (MiniLM). With the embedder degenerate the only honest strain is the mechanical
// γ-mass surprise over the field — real but thin. So this builds the skeleton on
// that cheap surprise: `read(cursor) → { surprise, terms }` is injected (index.js
// defaults it to readingAt's γ-mass surprise). When the meaning reader is live the
// same machinery deepens with no shape change — only a richer `read`.

import { createFrame, snapshotFrame } from './frame.js';

// Higher layers hold harder. A document frame should be harder to break than a
// proposition frame — its threshold is the size of its protective belt (Lakatos,
// §1/§11). These are the skeleton's defaults, a measured threshold per layer, not
// a constant; tune against the worked-example goldens, watching for thrash (too
// low, the frame never holds) and numbness (too high, the frame cannot be
// surprised).
export const DEFAULT_THRESHOLDS = Object.freeze({
  proposition: 1.5,
  document: 4.0,
});

// The assimilation band. Surprise below this is the frame predicting the
// particular — it confirms and contributes no strain (Piaget's assimilation, §1).
// Above it the excess accrues toward accommodation. The knob that sets where
// holding ends and accumulating begins.
export const DEFAULT_CONFIRM_BAND = 0.25;

// Calibrate the confirm band and the layer thresholds to THIS reader's scale.
//
// The skeleton's defaults (0.25 band, 1.5/4.0 thresholds) were measured on the
// SURPRISAL scale. The loop now rides Bayesian surprise (docs/bayesian-surprise.md),
// which clusters far below it — most lines under 0.1 — so on `bayes` the frame goes
// numb: strain never accumulates, no REC ever fires. The fix is the move the meaning
// reader already makes — fit the scale to the text:
//
//   band      = median surprise            (half the lines confirm, half strain)
//   step      = mean excess over the band  (the typical accommodation per line)
//   threshold = { proposition: 3·step, document: 8·step }
//
// Adaptive, scale-free, per reader. The 8:3 ratio preserves "the higher layer holds
// harder" (document RECs ~3× rarer) under any rescaling — the same ratio as the
// static 4.0:1.5 defaults. Falls back to the static defaults when the distribution
// is too thin to fit (fewer than a handful of lines, or no excess to measure).
export const calibrateReader = (surprises, {
  layers = ['proposition', 'document'],
  perLayerSteps = { proposition: 3, document: 8 },
  defaults = DEFAULT_THRESHOLDS,
  defaultBand = DEFAULT_CONFIRM_BAND,
} = {}) => {
  const xs = (surprises || []).filter(x => Number.isFinite(x));
  if (xs.length < 4) return { confirmBand: defaultBand, thresholds: { ...defaults }, fitted: false };

  const band = medianOf(xs);
  const excess = xs.map(x => Math.max(0, x - band)).filter(e => e > 0);
  const step = excess.length ? excess.reduce((s, e) => s + e, 0) / excess.length : 0;
  if (step <= 0) return { confirmBand: defaultBand, thresholds: { ...defaults }, fitted: false };

  const thresholds = {};
  for (const layer of layers) {
    const k = perLayerSteps[layer] ?? perLayerSteps.proposition ?? 3;
    thresholds[layer] = k * step;
  }
  return { confirmBand: band, thresholds, fitted: true, band: round(band), step: round(step) };
};

const medianOf = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const createEnactedLoop = ({
  layers = ['proposition', 'document'],
  thresholds = DEFAULT_THRESHOLDS,
  confirmBand = DEFAULT_CONFIRM_BAND,
  read,                              // (cursor) => { surprise ∈ [0,1], terms } — the cheap γ-mass signal
} = {}) => {
  if (typeof read !== 'function') {
    throw new TypeError('createEnactedLoop: `read` must be (cursor) → { surprise, terms }');
  }
  const orderedLayers = [...layers];
  const base = orderedLayers[0];     // the layer particulars originate at (proposition)
  const events = [];                 // the enacted log, in GENERATION ORDER (§8, §10)
  const live = new Map();            // layer → live frame (the only mutable state)
  const sinceSet = new Map();        // layer → [seq] of EVAs since the frame was set
  let lastCursor = -1;               // the arrow of time — strictly increasing

  const emit = (e) => {
    // Every enacted event is tagged with its register and its reader. The reader
    // is the reading itself: an enacted act is witnessed by the reading, the way a
    // depicted perception is witnessed by a measuring organ. The tag is the
    // firewall that keeps the two loops apart in any log they share (register.js).
    const sealed = Object.freeze({ ...e, register: 'enacted', reader: 'reading', seq: events.length });
    events.push(sealed);
    return sealed;
  };

  const thresholdOf = (layer) =>
    thresholds[layer] ?? DEFAULT_THRESHOLDS[layer] ?? thresholds[base] ?? 1.5;

  // Establish a frame at a layer — an enacted DEF. `producedBy` is 'initial' for
  // the opening frame, or { rec: seq } when a REC installs the new terms (§8: a DEF
  // carries the EVAs or REC that produced it). Resets the EVA accumulator for the
  // layer, because strain is measured against THIS frame from here forward.
  const def = (layer, cursor, terms, producedBy) => {
    const frame = createFrame({ layer, cursor, terms, threshold: thresholdOf(layer) });
    live.set(layer, frame);
    sinceSet.set(layer, []);
    emit({ op: 'DEF', layer, cursor, frame: snapshotFrame(frame), producedBy });
    return frame;
  };

  // Test the particular at `cursor` against the frame at `layer` — an enacted EVA.
  // testLayer is where the particular originates (the base layer: every sentence is
  // a proposition-grain particular). `cross` is true when the frame tested sits at
  // a HIGHER layer than the particular — the cross-layer EVA, a lower particular
  // bearing on a higher frame (§4). Its verdict carries BOTH directions of
  // influence: a confirm is the high holding the low (the document frame
  // conditioning a proposition that fits it); a strain is the low bearing on the
  // high (accumulating toward the higher frame's REC).
  const eva = (layer, cursor, surprise, particular) => {
    const frame = live.get(layer);
    // ARROW OF TIME (§5, §10, §11). An EVA tests the frame as of the cursor, never
    // a future frame. The frame was established at frame.cursor; that must not be
    // after the particular it conditions. This is the guard the whole
    // non-circularity rests on — break it (the likeliest way: a second pass leaking
    // the final frame backward into earlier EVAs) and the reading validates early
    // particulars against a conclusion it has not yet earned.
    if (frame.cursor > cursor) {
      throw new Error(`enacted EVA tested a FUTURE frame: ${layer}@${frame.cursor} vs particular@${cursor} (§5)`);
    }
    const verdict = surprise < confirmBand ? 'confirm' : 'strain';
    const strainDelta = Math.max(0, surprise - confirmBand);
    frame.strain += strainDelta;
    const ev = emit({
      op: 'EVA',
      testLayer: base, frameLayer: layer, frameCursor: frame.cursor,
      cross: layer !== base,
      cursor, particular,
      verdict, surprise: round(surprise), strainDelta: round(strainDelta),
    });
    sinceSet.get(layer).push(ev.seq);
    return frame;
  };

  // Restructure the frame at `layer` — an enacted REC. Fires only when accumulated
  // strain has broken the threshold (the caller checks). Records the frame it
  // restructured, the strain sum at firing, and the EVAs that forced it, then
  // installs the new frame via a DEF that cites this REC (§3, §8). The entry
  // mirrors eoreader3's RULES_LEDGER op:'REC' with target/action, extended with the
  // strain sum and the forcing EVAs (§9) — this IS the enacted-REC ledger.
  const rec = (layer, cursor, terms) => {
    const old = live.get(layer);
    const forcedBy = sinceSet.get(layer).slice();
    const recEv = emit({
      op: 'REC',
      target: layer, action: 'restructure',   // RULES_LEDGER shape, borrowed (§9)
      layer, cursor,
      from: snapshotFrame(old),
      strainSum: round(old.strain),
      forcedBy,
    });
    def(layer, cursor, terms, { rec: recEv.seq });   // the REC installs the new frame
    return recEv;
  };

  // One step of the arrow. Advance to `cursor` (strictly forward), read the cheap
  // surprise + terms there, and run the loop across every layer low → high. The
  // base layer tests the particular against its own frame; every higher layer
  // receives the SAME particular as a cross-layer EVA against its frame. Strain
  // accumulates independently per layer; each layer RECs on its own threshold — the
  // higher layer restructures ITSELF, the lower never writes it (§7). A higher
  // threshold means the higher frame absorbs more before it breaks: document RECs
  // are rarer than proposition RECs, which is what a document frame being harder to
  // break than a proposition frame looks like in the log.
  const step = (cursor) => {
    if (cursor <= lastCursor) {
      throw new Error(`enacted loop runs forward only: cursor ${cursor} ≤ last ${lastCursor} (§5)`);
    }
    lastCursor = cursor;
    const r = read(cursor) || {};
    const s = clamp01(Number(r.surprise) || 0);
    const terms = r.terms || [];

    for (const layer of orderedLayers) {
      if (!live.has(layer)) { def(layer, cursor, terms, 'initial'); continue; }
      const frame = eva(layer, cursor, s, cursor);
      if (frame.strain >= frame.threshold) rec(layer, cursor, terms);
    }
    return { cursor, surprise: round(s) };
  };

  // Drive the arrow forward to `cursor`, stepping every intervening position so no
  // particular is skipped. Returns the enacted log (generation order).
  const runTo = (cursor) => {
    for (let c = lastCursor + 1; c <= cursor; c++) step(c);
    return events;
  };

  return {
    step, runTo,
    get events() { return events; },
    get cursor() { return lastCursor; },
    frameAt: (layer) => { const f = live.get(layer); return f ? snapshotFrame(f) : null; },
    strainAt: (layer) => live.get(layer)?.strain ?? 0,
    layers: Object.freeze([...orderedLayers]),
    // The enacted-REC ledger as JSONL — the same shape as the audit trail and
    // eoreader3's conventions.jsonl, so the reading is tuned against the record (§9).
    exportJSONL: () => events.map(e => JSON.stringify(e)).join('\n'),
  };
};

const round = (x) => Math.round(x * 1000) / 1000;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
