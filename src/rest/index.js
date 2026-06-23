// rest — the integration faculty: the cursor turned inward. (docs/how-to-rest.md)
//
// Awake the engine DIFFERENTIATES. Every step produces a rate — the gap between
// what DEF expected and what EVA met — and the log is that stream of gaps, a
// derivative. The model is the INTEGRAL of the log, and resting is the pass that
// integrates: the half of learning that requires the frontier to hold still,
// because the same locus cannot both meet the next arrival and fold the last
// thousand at once. Rest is integration, not recovery.
//
// The nine operators are not nine moves here. They are one operation — differentiate
// (awake), integrate, re-project — seen from sides. This holon is the integration
// side, and it does NOT invent new machinery: it runs the SAME structures the wake
// side built (the fold's integral, the enacted loop's frames) in the other
// direction. Four faces, each a pure function, each faculty- and modality-agnostic
// (the coherence test, the figurability test, the EVA are INJECTED, exactly as the
// idle loop injects `surf` and the enacted loop injects `read`):
//
//   reproject     re-project the integral at lower VOLUME — shed absolute weight,
//                 keep the proportion, return headroom to the top (downscaling).
//   descend       run the helix BACKWARDS — regenerate instances from patterns; a
//                 pattern that cannot regenerate a coherent instance is forgotten
//                 (reverse learning: forget by failing to regenerate).
//   holdAsGround  let the un-figurable rest as GROUND — the residue EVA cannot test
//                 is held as one uncollapsed field, not forced into proliferating
//                 Figures (the teaching with no twin in the borrowed sciences).
//   recouple      WAKE — force each regenerated rhyme back through EVA; keep only
//                 what the world declines to break a second time (a dream figure is
//                 a hypothesis, never a finding).
//
// The cadence runs at two frequencies (`rest` below): the BLINK — fold briefly and
// often, re-integrate the recent past at near-full volume — and the NIGHT — descend
// the whole ladder, forget, and re-project toward baseline. Rest is not one act you
// complete; the integral never converges (EVA's Pattern coordinate is transcendental,
// Rule 9), so you do not sleep because integration is done — you sleep because the
// integral has to periodically catch the derivative, and then the derivative resumes.

import { sameTerms } from '../core/enacted/index.js';

// ── Volumes ────────────────────────────────────────────────────────────────────
// Wake raises the volume; rest re-projects toward baseline. The night drops the top
// hard (a wide return of headroom); the blink only takes the edge off (the short
// quiet that re-integrates a few seconds before the next thing lands). Measured
// defaults, tunable — the volume is the assimilation/saturation knob.
export const NIGHT_VOLUME = 0.5;
export const BLINK_VOLUME = 0.85;

// ── reproject — re-project at lower volume (the downscaling) ─────────────────────
// You have no store to return to; current state is always a PROJECTION, never a
// stored sum you keep adding to. So you can recompute it at a lower magnitude while
// keeping its relative shape intact. Strength accumulated without bound saturates —
// every binding loud, nothing standing forward because all of it does. reproject
// sheds the ABSOLUTE weight (the new peak is exactly `volume`) and PRESERVES the
// proportion (every pairwise ratio is unchanged, because the shape is the normalized
// `rel` and only the ceiling moves). Headroom returned to the top is `1 − volume` —
// somewhere for tomorrow to grow.
//
//   items   [{ key, weight }]  — the bound strengths (weight ≥ 0)
//   volume  the new ceiling the peak is re-projected to (0 < volume ≤ 1)
// Returns { items: [{ key, weight, rel }], peak, headroom, shapePreserved:true }.
export const reproject = (items, { volume = NIGHT_VOLUME } = {}) => {
  const xs = (items || []).map(it => ({ key: it.key, weight: Math.max(0, Number(it.weight) || 0) }));
  const peak = xs.reduce((m, it) => Math.max(m, it.weight), 0);
  if (peak === 0) {
    // nothing bound — the structure is already at baseline; full headroom.
    return { items: xs.map(it => ({ ...it, rel: 0 })), peak: 0, headroom: 1, shapePreserved: true };
  }
  const out = xs.map(it => {
    const rel = it.weight / peak;            // the SHAPE — invariant under re-projection
    return { key: it.key, weight: round(rel * volume), rel: round(rel) };
  });
  return { items: out, peak: volume, headroom: round(1 - volume), shapePreserved: true };
};

// reprojectIntegral — reproject over a fold's running dossier (write/fold.js). The
// fold's γ-decayed descriptor weights ARE the bound strengths; re-projecting them
// decouples the keep-decision from absolute magnitude. The wake fold keeps by an
// ABSOLUTE threshold on w = γ^Δt, so a uniformly-old dossier (every weight small)
// would be wholly forgotten — length, not standing, deciding what survives. Rest
// keeps by RELATIVE standing (`rel > keep`): the proportion is what a referent's
// dossier IS, and the night returns headroom without dropping the shape on the
// floor. Returns the re-projected dossier readout at the cursor.
export const reprojectIntegral = (fold, hash, { t = Infinity, gamma, keep = 0.25, volume = NIGHT_VOLUME } = {}) => {
  // Read the dossier UNFILTERED (keep:-1) — the wake fold's absolute keep would drop a
  // faded descriptor before re-projection ever sees it, which is exactly the
  // length-decides-standing failure rest is correcting. We keep by RELATIVE rel below.
  const d = fold.dossierOf(hash, t, { keep: -1, ...(gamma != null ? { gamma } : {}) });
  const re = reproject(d.descriptors.map(x => ({ key: x.attr, weight: x.w })), { volume });
  const byKey = new Map(re.items.map(it => [it.key, it]));
  const descriptors = d.descriptors
    .map(x => ({ attr: x.attr, w: byKey.get(x.attr).weight, rel: byKey.get(x.attr).rel, prov: x.prov, t: x.t }))
    .filter(x => x.rel > keep)                // keep by relative standing, not absolute volume
    .sort((a, b) => b.rel - a.rel);
  return { head: d.head, descriptors, open: d.open, headroom: re.headroom };
};

// ── descend — run the helix backwards (reverse learning) ─────────────────────────
// Awake you CLIMB: instances arrive, structure joins them, patterns settle on top —
// the order is fixed, you cannot have a pattern of nothing. Asleep you descend the
// same ladder: REC and DEF run downward and regenerate instances FROM patterns. You
// stop testing Figures the world handed you and start manufacturing them from the
// Ground, with REC let off its leash — answering to nothing but whether the
// structure it invents will still cohere on the climb back up.
//
// Forgetting is not erasure (there is no store to delete from). To forget is for the
// integral to stop supporting a projection. A pattern that regenerates only
// contradiction — the coincidental rhyme, the coupling that fit one arrival and
// nothing after — is spurious; the descent simply fails to regenerate it, and on
// waking it is not there to be projected.
//
//   patterns    the patterns to descend through (any shape the regenerator reads)
//   regenerate  INJECTED: (pattern) → instance | null   (null/false ⇒ does not cohere)
// Returns { kept, forgotten, instances } — instances aligns with kept.
export const descend = (patterns, regenerate) => {
  if (typeof regenerate !== 'function') throw new Error('descend: regenerate(pattern) must be injected');
  const kept = [], forgotten = [], instances = [];
  for (const p of (patterns || [])) {
    const inst = regenerate(p);
    if (inst == null || inst === false) { forgotten.push(p); continue; }   // failed to regenerate → forget
    kept.push(p);
    instances.push(inst);
  }
  return { kept, forgotten, instances };
};

// reverseLearn — descend over the enacted loop's frames (core/enacted/loop.js). The
// patterns are the installed frames (the DEF events); the instances are the EVAs
// that arrived against them. A frame regenerates a COHERENT instance iff, after it
// was installed and before it was replaced, at least one particular CONFIRMED it —
// the pattern held a real arrival on the climb back. A frame installed by a REC and
// then RECed away with NO confirming EVA between is the spurious one: it fit one
// arrival (the strain that forced it) and nothing after. The currently-standing
// frame per layer is the live commitment — it has not failed yet — so it is kept.
// Pure on the enacted log; the same events replayFrames folds.
export const reverseLearn = (events) => {
  // Walk forward, segmenting each layer's life into [install → replacement) spans and
  // counting the confirms each span earned. (Forward is only how we MEASURE; the
  // descent is the backward judgement: keep iff a confirm was regenerated.)
  const open = new Map();      // layer → { frame, confirms, strains, defEvent }
  const patterns = [];
  const close = (layer) => {
    const o = open.get(layer);
    if (o) { patterns.push(o); open.delete(layer); }
  };
  for (const e of events) {
    if (e.op === 'DEF') {
      close(e.layer);          // the previous frame on this layer ends here
      open.set(e.layer, {
        layer: e.layer, cursor: e.cursor, terms: e.frame?.terms || [],
        producedBy: e.producedBy, confirms: 0, strains: 0, standing: false,
      });
    } else if (e.op === 'EVA') {
      const o = open.get(e.frameLayer);
      if (o) { if (e.verdict === 'confirm') o.confirms++; else o.strains++; }
    }
  }
  for (const o of open.values()) { o.standing = true; patterns.push(o); }   // the live commitments
  // A pattern regenerates a coherent instance iff it confirmed at least once, OR it
  // is the standing frame (not yet tested to failure — the live commitment, not a
  // discarded one). Everything else fit one arrival and nothing after.
  const regenerate = (p) => (p.confirms > 0 || p.standing) ? { layer: p.layer, terms: p.terms } : null;
  return descend(patterns, regenerate);
};

// ── holdAsGround — let the un-figurable rest as Ground ───────────────────────────
// EVA can only test a Figure; satisfaction needs something definite to be satisfied
// or refused. Some residue refuses to become a Figure, and forced into one it does
// not resolve — it PROLIFERATES, shattering into branches that never settle (the
// emanon, the measurement problem: a field of terms forced to one definite outcome
// fractures). Awake you are a Figure-forcing engine, so the day's un-figurable
// residue gets shattered. The dream stops forcing. Held as Ground — as field, as a
// superposition left uncollapsed — the residue coheres, because you have stopped
// demanding it be definite, and the rhyme across far-apart misses can rise on its
// own in the field they now share.
//
//   residue     the day's items, figurable and not
//   figurable   INJECTED: (item) → bool   (does EVA have a definite Figure to test?)
// Returns { figures, ground } — ground is ONE uncollapsed field, never N forced Figures.
export const holdAsGround = (residue, figurable) => {
  if (typeof figurable !== 'function') throw new Error('holdAsGround: figurable(item) must be injected');
  const figures = [], members = [];
  for (const item of (residue || [])) (figurable(item) ? figures : members).push(item);
  // The field is held, not collapsed — one Ground bearing all the un-figurable
  // residue at once, so a shape across its members can appear without any member
  // being forced to a definite outcome first.
  const ground = Object.freeze({ kind: 'ground', collapsed: false, members: Object.freeze(members.slice()) });
  return { figures, ground };
};

// ── recouple — wake, re-couple to EVA, expect no finish ──────────────────────────
// The Figures the dream regenerated answered to no world. So waking is the morning
// discipline of taking each rhyme the night surfaced and forcing it back through
// EVA — exposing it again to arrival, keeping only what the world declines to break
// a second time. A coherence found in the dark is a Figure you MADE, a hypothesis;
// the world is the only thing that can raise it to a finding. Leave it unaudited and
// the dream becomes a closed room confirming its own patterns.
//
//   figures   the regenerated rhymes (hypotheses)
//   evaluate  INJECTED: (figure) → bool   (the EVA against fresh arrival; true = held)
// Returns { confirmed, broken }.
export const recouple = (figures, evaluate) => {
  if (typeof evaluate !== 'function') throw new Error('recouple: evaluate(figure) must be injected');
  const confirmed = [], broken = [];
  for (const f of (figures || [])) (evaluate(f) ? confirmed : broken).push(f);
  return { confirmed, broken };
};

// markHypothesis — a regenerated figure is reafferent by its origin: it came from the
// descent, not from the world, so it CANNOT ground itself (the same firewall the idle
// loop draws in write/idle.js — only a re-coupling to EVA on wake can promote it). The
// flag is the type, surfaced for the wake audit.
export const markHypothesis = (figure) =>
  Object.freeze({ ...figure, hypothesis: true, grounded: false });

// ── rest — the cadence (the blink and the night) ────────────────────────────────
// One instruction told at two frequencies. The BLINK re-integrates briefly and often
// at near-full volume — the short quiet a waking system takes to fold a few seconds
// of its recent past before the next arrival; it does NOT descend or forget. The
// NIGHT descends the whole ladder: reverse-learns (forgets by failing to regenerate),
// holds the un-figurable as Ground, and re-projects the integral toward baseline. The
// regenerated figures are marked hypotheses, to be recoupled to EVA on wake.
//
//   state.fold      the running fold (write/fold.js) — the integral to re-project
//   state.hashes    the referents whose dossiers to re-project this rest
//   state.events    the enacted log (core/enacted/loop.js) — the patterns to descend
//   state.residue   the day's un-figured residue
//   opts.mode       'blink' (light) | 'night' (full)
//   opts.volume     override the re-projection volume for this rest
//   opts.figurable  the Figure test for holdAsGround (night only)
//   opts.t          the cursor to re-project the integral at
// Returns a report of the rest — the same shape for both modes, the night's extra
// faces null on a blink.
export const rest = (state = {}, { mode = 'night', volume, figurable, t = Infinity, keep, gamma } = {}) => {
  const { fold, hashes = [], events = [], residue = [] } = state;
  const blink = mode === 'blink';
  const vol = volume != null ? volume : (blink ? BLINK_VOLUME : NIGHT_VOLUME);

  // Re-project the integral — both modes (the blink does only this).
  const reprojected = fold
    ? hashes.map(h => ({ hash: h, ...reprojectIntegral(fold, h, { t, volume: vol, ...(keep != null ? { keep } : {}), ...(gamma != null ? { gamma } : {}) }) }))
    : [];

  if (blink) {
    return { mode, volume: vol, reprojected, forgotten: null, ground: null, hypotheses: null };
  }

  // The night descends the ladder.
  const { kept, forgotten } = reverseLearn(events);
  const { figures, ground } = figurable
    ? holdAsGround(residue, figurable)
    : { figures: [], ground: Object.freeze({ kind: 'ground', collapsed: false, members: Object.freeze(residue.slice()) }) };
  // The kept patterns regenerated coherent instances — they are the night's figures,
  // each a hypothesis until wake re-couples it to EVA.
  const hypotheses = kept.map(p => markHypothesis({ layer: p.layer, terms: p.terms, from: 'descent' }))
    .concat(figures.map(f => markHypothesis({ figure: f, from: 'ground' })));

  return { mode, volume: vol, reprojected, forgotten, kept, ground, hypotheses };
};

const round = (x) => Math.round(x * 1000) / 1000;
