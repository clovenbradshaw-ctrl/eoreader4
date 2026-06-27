// write/voids.js — the open-Resolution query: the fuel and the "Open" ledger. (SPEC §15, §16)
//
// The idle loop walks the OPEN RESOLUTIONS — the void-set: referents INS'd but not
// DEF'd, deferred identities, hedged claims, threads left open (§1–§2). These are
// exactly the points where more thinking can still PAY — where the model is not yet
// committed, so a fresh document can still produce compression progress (§14).
// Re-narrating the FIRM log is rumination (no new likelihood); chasing pure noise is
// dreaming (incompressible). The voids are the fuel; the firm record is not.
//
// The same query feeds the §16 UX: "Open" is the centerpiece — the instrument's
// standing not-knowing, made legible. An entry is { rid, head, text, band, reason }
// with band ∈ { void, hedged }, the form the prototype (idle-ux.html) renders.

import { isVoid } from '../core/index.js';

// Below this firm probability a commitment is HEDGED, not settled (§10): proper-
// scorable but not yet confident enough to leave the open set. The candidate /
// duty-cycle threshold (open question §13.6) lives one level up, in idle.js.
export const HEDGE_BELOW = 0.7;

// openLedger — read the open-Resolution set off a fold (write/fold.js). Three ways a
// referent is open:
//   VOID identity  — appeared but carries unsettled (void) attributes, OR appeared
//                    with no firm descriptor at all (INS without DEF).
//   HEDGED         — firm but low-p (resolution map), proper-scorable yet uncommitted.
// A referent with firm, confident descriptors and no void attrs is SETTLED and is
// not in the ledger. `resolution` is the optional per-referent Resolution map.
export const openLedger = (fold, { t = Infinity, resolution = null, hedgeBelow = HEDGE_BELOW } = {}) => {
  if (!fold || !fold.refs) return [];
  const entries = [];
  for (const [rid, r] of fold.refs) {
    const appeared = fold.has ? fold.has(rid) : true;
    if (!appeared) continue;                                  // not yet on the frontier — not an open question, a non-appearance
    const d = fold.dossierOf ? fold.dossierOf(rid, t) : { descriptors: [], open: [] };
    const res = resolution?.get ? resolution.get(rid) : null;

    if (d.open && d.open.length) {
      entries.push(openEntry(rid, r.head, 'void', `unsettled: ${d.open.map(x => x.attr ?? x).join('; ')}`));
    } else if (!d.descriptors || d.descriptors.length === 0) {
      entries.push(openEntry(rid, r.head, 'void', 'appeared but not yet characterized (INS without DEF)'));
    } else if (res && !isVoid(res) && Number.isFinite(res.p) && res.p < hedgeBelow) {
      entries.push(openEntry(rid, r.head, 'hedged', `committed at p=${res.p.toFixed(2)} — proper-scorable, not yet confident`));
    }
  }
  return entries;
};

// openResolutions — the same query off a flat list of {hash, head, res, hasDef,
// open?} items (or scheduler cells), for callers that do not hold a fold. void
// dominates: a void resolution OR open attributes → void; a firm low-p item →
// hedged. Settled items are omitted.
export const openResolutions = (items, { hedgeBelow = HEDGE_BELOW } = {}) => {
  const out = [];
  for (const it of items || []) {
    const rid = it.hash ?? it.rid ?? it.id;
    const head = it.head ?? it.name ?? rid;
    const open = it.open && it.open.length;
    if (isVoid(it.res) || open) {
      out.push(openEntry(rid, head, 'void', open ? `unsettled: ${[].concat(it.open).join('; ')}` : 'void identity'));
    } else if (it.hasDef === false) {
      out.push(openEntry(rid, head, 'void', 'appeared but not yet characterized (INS without DEF)'));
    } else if (it.res && Number.isFinite(it.res.p) && it.res.p < hedgeBelow) {
      out.push(openEntry(rid, head, 'hedged', `committed at p=${it.res.p.toFixed(2)}`));
    }
  }
  return out;
};

const openEntry = (rid, head, band, reason) =>
  Object.freeze({ rid, head, text: head, band, reason });

export const isOpen = (entry) => entry && (entry.band === 'void' || entry.band === 'hedged');

// learningProgress — the DERIVATIVE OF COMPETENCE for one void, read off its
// chronological REC observations (oldest → newest; each the accommodation that
// re-surfing the void produced on that idle pass — idle.js `trail`). Curiosity is
// not the level of confusion; it is the rate at which confusion SHRINKS when you
// poke it. So this is the recent REDUCTION in that REC:
//   > 0  the void is being learned — re-surfing it pays a little less each time;
//        this is the FRONTIER, the edge where the model is improving fastest.
//   ≈ 0  poking changes nothing. Either EXHAUSTED (REC already ~0 — the too-easy,
//        bores) or a WALL whose REC stays high forever (the noisy-TV / garbled-OCR
//        trap — maximally surprising, never gets less so). Both are uninteresting,
//        and a naive curiosity that chased raw surprise would lick the wall forever.
//   < 0  re-surfing makes it WORSE (REC rising) — the too-hard region; repel.
// Recency (`window`): only the last few pokes count, so a void that fell early and
// then flatlined reads as exhausted NOW, not as still-paying. Returns null when
// there are too few observations to show a trend — the caller supplies the prior.
export const learningProgress = (series, { window = 4 } = {}) => {
  const xs = (series || []).filter(Number.isFinite);
  if (xs.length < 2) return null;                          // unmeasured — no trend yet
  const recent = xs.slice(-window);
  const mid = Math.floor(recent.length / 2) || 1;
  const earlier = recent.slice(0, mid);
  const later = recent.slice(mid);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return mean(earlier) - mean(later);                      // positive ⇒ REC falling ⇒ progress
};

// voidScore — the attention value of a void: its learning progress, or, when it has
// not been poked enough to show one, an OPTIMISTIC prior (`priorLP`). Optimism under
// uncertainty is what makes it explore the genuinely unknown — "the edge of its own
// knowing" — before it can possibly know whether that edge is a frontier or a wall.
// Tune `priorLP` down to let a hot, already-found frontier compete with the unpoked.
export const voidScore = (rid, history, { priorLP = 1, window = 4 } = {}) => {
  const series = history && history.get ? history.get(rid) : null;
  const lp = learningProgress(series, { window });
  return lp == null ? priorLP : lp;
};

// rankByLearningProgress — the open ledger ordered by the derivative of competence,
// highest first: drawn to the frontier, repelled by the wall. Deterministic and
// stable (ties keep ledger order), so it is the testable keystone the idle walk and
// the day-scheduler both read. `history` is a Map rid → number[] of REC pokes.
export const rankByLearningProgress = (ledger, history, opts = {}) =>
  (ledger || [])
    .filter(isOpen)
    .map((e, i) => ({ e, i, s: voidScore(e.rid, history, opts) }))
    .sort((a, b) => (b.s - a.s) || (a.i - b.i))
    .map((x) => x.e);

// pickVoid — choose WHICH open void to attend next. Seeded randomness plays only the
// humble correct role (§15, I5): it varies which void gets attention so attention
// does not lock — it never manufactures content. `rng` is a function → [0,1); a
// deterministic seed makes the walk reproducible. Returns null on an empty ledger
// (nothing open → nothing to think about).
//
// With no `history` the walk is seeded-UNIFORM — byte-identical to the original I5
// attention (the default path; existing callers and goldens are unchanged). Given a
// poke-history it becomes FRONTIER-BIASED: attention is weighted by learning progress
// so the walk is drawn to where competence grows fastest and away from the wall —
// yet every open void keeps a probability floor, so attention biases but never LOCKS
// (I5 holds: noise still steers WHICH, the bias never silences a void entirely).
export const pickVoid = (ledger, rng = Math.random, { history = null, ...opts } = {}) => {
  const open = (ledger || []).filter(isOpen);
  if (!open.length) return null;
  if (!history) return open[Math.floor(rng() * open.length) % open.length];

  const FLOOR = 1e-3;                                      // I5 — no void is ever silenced
  const weights = open.map((e) => Math.max(0, voidScore(e.rid, history, opts)) + FLOOR);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rng() * total;                                   // one draw per step — rng stream advances as before
  for (let k = 0; k < open.length; k++) { r -= weights[k]; if (r <= 0) return open[k]; }
  return open[open.length - 1];
};
