// surfaceNote — the artifact under test (docs/surfing-success.md §1).
//
// The talker is out of the loop. The bench scores the surfaced STRUCTURED NOTE
// directly: a topic-pivoted view of the graph in the notes register — entity
// nodes, typed/directed relations, the spans that ground each element, and the
// significance frame-turn when the question asks for one. This builds that note
// for a probe (a query phrasing) under a force configuration, so the scorer can
// judge it against a frozen gold note without anyone reading it as prose.
//
// It reuses the live spine end to end: retrieve sets the surfer down, the SURFER
// (read/surf.js) steps the field and widens the window, and the structure surface
// (read/surfaces.js) folds the graph over that window. The one thing it adds over
// the production fold is FORCE CONTROL: the read-time forces (the strain leak, the
// confirm band, the layer thresholds, the impulse, the surprise depth) are threaded
// into the frame-turn reading so a sweep moves the note, not just the prose.

import { retrieveHybrid }   from '../retrieve/index.js';
import { retrieveLexical }  from '../retrieve/index.js';
import { surfFold } from '../surfer/index.js';
import { structureSurface, referentialConfidence } from '../perceiver/index.js';
import { enactedReadingTo, enactedReadingMeaning } from '../enact/index.js';
import { unsettled } from '../turn/reread.js';

// The read-time forces, defaulted to the live system's own. A sweep overrides one
// (or a small joint set) per run; everything else holds at the baseline.
export const DEFAULT_FORCES = Object.freeze({
  k: 8,                  // retrieval breadth — how many spans the surfer is set down over
  behind: 4, ahead: 16,  // the surf reach (read/surf.js DEFAULT_REACH)
  leak: undefined,       // strain leak (core/enacted/frame.js DEFAULT_STRAIN_LEAK when undefined)
  confirmBand: undefined,// the assimilation band (calibrated to the reach when undefined)
  thresholds: undefined, // per-layer REC thresholds (calibrated when undefined)
  impulse: undefined,    // the shock threshold (DEFAULT_IMPULSE when undefined)
  depth: 'cheap',        // 'cheap' (γ-mass) | 'meaning' (MiniLM, needs a meaning embedder)
  reread: false,         // the active-inference re-read (turn/reread.js): widen the window
                         // when the reading did not SETTLE on a figure. Off → byte-identical.
});

// Surface the note for one probe. Async because retrieval and the meaning reader
// embed. Returns the structured note plus the window's span text, so the scorer
// can ground each element and check the silence slots without re-reading the doc.
export const surfaceNote = async (doc, query, { embedder = null, forces = {} } = {}) => {
  const f = { ...DEFAULT_FORCES, ...forces };
  const units = doc.units || doc.sentences || [];
  const S = units.length;

  // 1 — retrieve. Lexical is the hot, model-free path; hybrid blends the semantic
  // reader when an embedder is warm (the only way a zero-overlap paraphrase can
  // pivot to the right region — and, under the hash organ, the honest limit the
  // consistency number is built to expose).
  let hits = [];
  try {
    hits = embedder ? await retrieveHybrid(doc, query, embedder, f.k)
                     : retrieveLexical(doc, query, f.k);
  } catch { hits = retrieveLexical(doc, query, f.k); }
  const anchor = hits.length ? hits[0].idx : 0;

  // 2 — surf. The surfer steps the field from the anchor and arrests on the peaks
  // and the frame breaks; its stops widen the window so a high-significance line
  // retrieval missed is still read and still citable.
  const surf = surfFold(doc, anchor, { behind: f.behind, ahead: f.ahead });
  const window = [...new Set([...hits.map(h => h.idx), ...surf.stops])]
    .filter(i => i >= 0 && i < S).sort((a, b) => a - b);
  if (window.length === 0 && S > 0) window.push(anchor);

  // 2b — the active-inference RE-READ (turn/reread.js, surfing-next.md §3), opt-in via
  // forces.reread so the baseline window is byte-identical. When the reading did not SETTLE
  // on a figure — a diffuse coref posterior at the peak (the referent-ambiguous measure) —
  // read more of the document on the figure it focused on and fold the fresh spans into the
  // window. This is the same widening the turn does; surfacing it here lets the BENCH measure
  // whether reading-more-on-the-open-figure improves the note (the gate on flipping it on).
  if (f.reread && doc.corefField) {
    const referential = referentialConfidence(doc.corefField.fieldGrounded(surf.peak));
    if (unsettled(surf, 'answer', referential)) {
      const q = `${query} ${surf.focus}`.trim();
      let more = [];
      try { more = embedder ? await retrieveHybrid(doc, q, embedder, 4) : retrieveLexical(doc, q, 4); }
      catch { more = retrieveLexical(doc, q, 4); }
      for (const h of more) if (h.idx >= 0 && h.idx < S && !window.includes(h.idx)) window.push(h.idx);
      window.sort((a, b) => a - b);
    }
  }

  // 3 — fold the graph over the window (the notes register, structured), then
  // PIVOT to the topic. The note is "a topic-pivoted view of the graph" (§1): its
  // relations are the edges BETWEEN entity nodes (figure → figure), the typed,
  // citable claims. The open-vocab NP-referent edges (gregor → morning, → back)
  // are the propositional substrate, real but not the topic-pivoted note; they ride
  // in `referents` so a sweep that pulls in stale FIGURE relations still prices
  // precision, without every incidental noun swamping the parsimony measure.
  const structure = structureSurface(doc, window);
  const figureIds = new Set(snapshot(doc).filter(e => e.op === 'INS').map(e => e.id));
  const figureRel = (r) => figureIds.has(r.src.id) && figureIds.has(r.tgt.id);

  // 4 — the frame-turn axis, read under the swept forces. The significance reading
  // is taken at the surf PEAK; the RECs within the window are the turns the note
  // carries. Surprise depth picks the reader: the cheap γ-mass skeleton, or the
  // meaning reader when a meaning embedder is live (it falls back honestly).
  const readOpts = forceOpts(f);
  let recs = [];
  try {
    const reading = f.depth === 'meaning' && embedder?.measuresMeaning
      ? await enactedReadingMeaning(doc, S - 1, { embedder, ...readOpts })
      : enactedReadingTo(doc, S - 1, Object.keys(readOpts).length ? readOpts : undefined);
    const lo = window[0], hi = window[window.length - 1];
    recs = reading.events
      .filter(e => e.op === 'REC' && e.cursor >= lo && e.cursor <= hi)
      .map(e => ({ layer: e.layer, cursor: e.cursor, strainSum: e.strainSum,
                   trigger: e.trigger, terms: e.from?.terms || [] }));
  } catch { recs = []; }

  const spanText = {};
  for (const i of window) spanText[i] = units[i];

  return {
    query,
    anchor,
    peak: surf.peak,
    focus: surf.focus,                   // the figure the surf settled on (null when none) — what a re-read widens on
    spans: window,                       // the cited sentence indices (the citation channel)
    spanText,                            // window index → verbatim line (for grounding + silence)
    entities: structure.figures.map(x => ({ id: x.id, label: x.label, count: x.count })),
    relations: structure.relations.filter(figureRel).map(r => ({
      src: r.src, tgt: r.tgt, via: r.via, type: r.type, idx: r.idx,
    })),
    referents: structure.relations.filter(r => !figureRel(r)).map(r => ({
      src: r.src, tgt: r.tgt, via: r.via, type: r.type, idx: r.idx,
    })),
    defs: structure.defs.map(d => ({ id: d.id, label: d.label, value: d.value, idx: d.idx })),
    frameTurns: recs,
    forces: f,
  };
};

// Translate the bench's force names into the enacted loop's option names, omitting
// any left at the baseline so an unswept run keeps the live system's calibration
// (a passed confirmBand/thresholds always overrides the per-reach fit).
const forceOpts = (f) => {
  const o = {};
  if (f.leak        != null) o.strainLeak       = f.leak;
  if (f.confirmBand != null) o.confirmBand       = f.confirmBand;
  if (f.thresholds  != null) o.thresholds        = f.thresholds;
  if (f.impulse     != null) o.impulseThreshold  = f.impulse;
  return o;
};

// Does any element of the note name `token` (case-insensitive, whole-word)? Scans
// entity labels, relation verbs, def values, and the cited span text. This is the
// silence probe: a slot the text leaves empty (the species) must not be filled by
// any element the note carries — the §4 false-certainty gate, read off the note.
export const noteMentions = (note, token) => {
  const re = new RegExp(`\\b${escapeRe(String(token).toLowerCase())}\\b`, 'i');
  if (note.entities.some(e => re.test(e.label || ''))) return true;
  if (note.relations.some(r => re.test(r.via || '') || re.test(r.src?.label || '') || re.test(r.tgt?.label || ''))) return true;
  if (note.defs.some(d => re.test(d.value || '') || re.test(d.label || ''))) return true;
  for (const i of note.spans) if (re.test(note.spanText[i] || '')) return true;
  return false;
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const snapshot = (doc) =>
  typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);
