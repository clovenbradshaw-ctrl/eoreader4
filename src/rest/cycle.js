// rest/cycle.js — the driver: when to rest, and at which frequency. (docs/how-to-rest.md)
//
// rest() (rest/index.js) runs ONE pass — it does not decide when. That decision is
// the whole point of ingest that arrives faster than it can be folded, and it is what
// this module adds. createRestCycle is the deliberate sibling of createIdleLoop
// (write/idle.js): a deterministic engine — no timers, no DOM, the faculties injected,
// the outputs behind the §8 reafference firewall, the host driving the clock. The idle
// loop runs while the frontier MOVES; the dream cycle runs when it should HOLD STILL.
//
//   pressure(fold) read off the LIVE fold, never a clock. Saturation is not a row
//                  count — it is the integral losing its shape, the failure reproject
//                  names: every binding loud, nothing standing forward. Per referent,
//                  re-project the dossier to its own peak and look at the `rel`
//                  distribution. A healthy dossier is PEAKED (one or two descriptors
//                  stand forward, the rest fall away); a saturated one is FLAT-HIGH
//                  (many near the ceiling). Two signals — `saturation` and `load` (the
//                  day's intake against a budget) — combined as a weighted max so that
//                  either too-flat or too-much trips the night. A pure read; no
//                  accumulation, consistent with the no-store rule.
//   observe(event) the day's intake — the sibling of idle.arrive(doc). The host feeds
//                  the cycle the SAME event stream it folds, so `load` has something to
//                  count and a blink re-projects the right referents. It folds nothing;
//                  it is bookkeeping.
//   tick(now)      choose the cadence. Read pressure and run a BLINK unless `value`
//                  crosses `nightPressure` AND the day is at least `minDay` long, in
//                  which case run a NIGHT. A night needs a minimum day so the cycle
//                  never sleeps on nothing (the refractory sibling of the idle loop's
//                  median-band quiesce). The blink re-projects only the referents the
//                  day touched; the night descends the ladder, marks the survivors as
//                  hypotheses, queues them, and resets the day counters.
//   wake(evaluate) the morning — recouple run over the queue. Every pending hypothesis
//                  is forced through a fresh EVA, the world's second look. Survivors
//                  come back as PROPOSALS, and a proposal is STILL not grounded — the
//                  witness act promotes. The broken ones are the dreams the world
//                  refused, and they are dropped (forgetting again).
//
// THE FIREWALL IS THE TYPE, not a flag. Every hypothesis the night mints carries
// `fromEnactor`, so `canWitness` is false and `canGround` returns false — identical to
// the idle loop's candidate discipline. A dream hypothesis can never ground itself.

import { fromEnactor, canWitness } from '../core/index.js';
import { reproject, rest } from './index.js';

export const AWAKE = 'awake';       // differentiating — the frontier moves
export const RESTING = 'resting';   // a night has run; its hypotheses await wake

// Cadence defaults — measured-ish, all tunable. nightPressure is where a flat-high
// integral (or a full day) owes a night; minDay is the refractory floor so the cycle
// never sleeps on an empty day; budget is the day's intake ceiling `load` counts
// against; the weights let either signal trip the night on its own (a weighted max).
export const DEFAULT_NIGHT_PRESSURE = 0.6;
export const DEFAULT_MIN_DAY = 8;
export const DEFAULT_BUDGET = 64;
export const DEFAULT_WEIGHTS = Object.freeze({ saturation: 1, load: 1 });

// createRestCycle — the deterministic cadence engine over a live fold.
//   fold        the running fold (write/fold.js) — the integral pressure reads and the
//               blink/night re-project. Required.
//   enacted     the enacted loop (core/enacted/loop.js) — the patterns the night
//               descends (reverse-learns). Optional; without it the night still
//               re-projects and holds Ground, it just has no frames to forget.
//   figurable   INJECTED Figure test for the night's holdAsGround (the faculty's, not
//               rest's — exactly as the idle loop injects `surf`). Optional.
//   nightPressure  pressure `value` at or above which a night is owed (and the day is long enough)
//   minDay      observations a day must hold before a night may run (the refractory floor)
//   budget      the day's intake ceiling `load` is measured against
//   weights     { saturation, load } — the weighted max that combines the two signals
//   enactment   the provenance stamp every minted hypothesis carries (the firewall)
export const createRestCycle = ({
  fold,
  enacted = null,
  figurable = null,
  nightPressure = DEFAULT_NIGHT_PRESSURE,
  minDay = DEFAULT_MIN_DAY,
  budget = DEFAULT_BUDGET,
  weights = DEFAULT_WEIGHTS,
  enactment = 'rest',
} = {}) => {
  if (!fold || typeof fold.dossierOf !== 'function') {
    throw new Error('createRestCycle: a fold (write/fold.js) must be injected');
  }
  const wSat = weights.saturation ?? 1;
  const wLoad = weights.load ?? 1;

  let phase = AWAKE;
  let lastMode = null;                 // 'blink' | 'night' — the last cadence run, for the UI
  const queue = [];                    // pending hypotheses minted by the night, awaiting wake
  const day = { count: 0, touched: new Set(), residue: [] };   // the day's intake — reset each night

  const resetDay = () => { day.count = 0; day.touched.clear(); day.residue = []; };

  // ── pressure — read the shape of the live integral (pure; no accumulation) ──────
  // Saturation: per referent, re-project the dossier to its OWN peak (the shape) and
  // read the tail of the `rel` distribution. The peak is rel = 1 by construction; what
  // says flat-high vs peaked is whether the REST of the descriptors stayed near the
  // ceiling (saturated) or fell away (healthy). So saturation per referent is the mean
  // `rel` of the tail (everything below the peak); a single-descriptor dossier has no
  // tail and contributes nothing (it is the most peaked thing there is, not flat-high).
  // The fold's saturation is the mean of the per-referent tail means.
  //
  // The shape only differentiates under RECENCY: the fold weights every descriptor
  // equally at the open cursor (Infinity), so we read at the fold's OWN latest binding
  // time — the live "now". Then γ-decay spreads a healthy dossier (a recent peak, the
  // older bindings fallen away) and leaves a saturated one flat (everything bound
  // recently). `t` may be overridden, but the default keeps pressure a pure read of the
  // fold, no external clock — exactly the no-store discipline.
  //
  // Load: the day's raw intake against the budget, clamped to [0,1].
  //
  // value: the weighted max — either too-flat OR too-much owes a night.
  const pressure = (f = fold, { t } = {}) => {
    const hashes = f.frontier ? [...f.frontier] : [];
    const now = t != null ? t : latestBindingTime(f, hashes);
    const tails = [];
    for (const h of hashes) {
      // UNFILTERED (keep:-1): the wake fold's absolute keep would drop faded descriptors
      // before the shape is even seen — the length-decides-standing failure rest corrects.
      const d = f.dossierOf(h, now, { keep: -1 });
      if (!d.descriptors || d.descriptors.length <= 1) continue;   // no tail → not flat-high
      const re = reproject(d.descriptors.map(x => ({ key: x.attr, weight: x.w })), { volume: 1 });
      const rels = re.items.map(it => it.rel).sort((a, b) => b - a);
      const tail = rels.slice(1);                                  // drop the peak (rel = 1)
      tails.push(tail.reduce((s, r) => s + r, 0) / tail.length);
    }
    const saturation = tails.length ? round(tails.reduce((s, t2) => s + t2, 0) / tails.length) : 0;
    const load = round(Math.min(1, budget > 0 ? day.count / budget : 0));
    const value = round(Math.max(wSat * saturation, wLoad * load));
    return { saturation, load, value, referents: tails.length, day: day.count };
  };

  // ── observe — the day's intake (bookkeeping; folds nothing) ─────────────────────
  // The host feeds the cycle the same events it folds. We count the day (for `load`),
  // remember which referents the day touched (so a blink re-projects the right ones),
  // and keep the raw events as the day's residue (what the night holds as Ground).
  const observe = (event) => {
    if (event == null) return { day: day.count };
    day.count++;
    day.residue.push(event);
    for (const h of hashesOf(event)) day.touched.add(h);
    return { day: day.count, touched: day.touched.size };
  };

  // mint — stamp a night's hypothesis with the §8 firewall. It came from the descent,
  // not the world, so its provenance is the enactor door: canWitness === false, hence
  // canGround === false. Only a wake re-coupling to EVA (and then a witness act) can
  // promote it. The flag is the type, surfaced for the wake audit.
  const mint = (h) => Object.freeze({ ...h, prov: fromEnactor(enactment), hypothesis: true, grounded: false });

  // ── tick — choose the cadence (the blink and the night) ─────────────────────────
  // Read pressure; blink unless a night is OWED — `value` at/above nightPressure AND
  // the day at least minDay long. The blink re-projects only the day's touched
  // referents (near-full volume); it does not descend or forget, and it leaves the day
  // running. The night descends the whole ladder, re-projects the integral toward
  // baseline, mints the survivors as hypotheses, queues them, and clears the day —
  // the backlog is cleared the moment the integral is re-projected toward baseline.
  const tick = (now = Infinity) => {
    const p = pressure();
    const owed = p.value >= nightPressure && day.count >= minDay;

    if (!owed) {
      const hashes = [...day.touched];
      const report = rest({ fold, hashes }, { mode: 'blink', t: now });
      lastMode = 'blink';
      return { mode: 'blink', pressure: p, reprojected: report.reprojected, hypotheses: null };
    }

    const events = enacted?.events ?? [];
    const hashes = fold.frontier ? [...fold.frontier] : [];        // re-project the WHOLE integral toward baseline
    const report = rest(
      { fold, hashes, events, residue: day.residue },
      { mode: 'night', t: now, ...(figurable ? { figurable } : {}) },
    );
    const minted = (report.hypotheses || []).map(mint);
    queue.push(...minted);
    phase = RESTING;
    lastMode = 'night';
    resetDay();
    return {
      mode: 'night', pressure: p,
      reprojected: report.reprojected, forgotten: report.forgotten,
      ground: report.ground, hypotheses: minted,
    };
  };

  // ── wake — the morning: recouple the queue to EVA ────────────────────────────────
  // Every pending hypothesis is forced through a fresh EVA (the injected `evaluate`,
  // the world's second look). Survivors come back as PROPOSALS — still ungrounded, the
  // witness act promotes them elsewhere. The broken ones are the dreams the world
  // refused and are dropped (the integral ceasing to support them). The queue clears
  // and the cycle is awake again.
  const wake = (evaluate) => {
    if (typeof evaluate !== 'function') throw new Error('wake: evaluate(hypothesis) must be injected (the wake EVA)');
    const proposals = [], broken = [];
    for (const h of queue) (evaluate(h) ? proposals : broken).push(h);
    queue.length = 0;
    phase = AWAKE;
    // a proposal is STILL not grounded — the firewall holds through wake; only the
    // witness act promotes. We mark it a proposal and keep grounded:false.
    return {
      proposals: proposals.map(h => Object.freeze({ ...h, proposal: true })),
      broken,
    };
  };

  return {
    get phase() { return phase; },                 // 'awake' | 'resting'
    get lastMode() { return lastMode; },           // 'blink' | 'night' | null
    get pending() { return queue.length; },        // hypotheses awaiting wake
    get hypotheses() { return queue.slice(); },
    get day() { return day.count; },
    pressure, observe, tick, wake,
    isResting: () => phase === RESTING,
    // the firewall, surfaced as a predicate (sibling of idle.canGround): a dream
    // hypothesis can NEVER ground itself — its reafferent type bars it.
    canGround: (h) => canWitness(h?.prov ?? null),
  };
};

// hashesOf — pull the referent hashes an event touches, tolerating the shapes the host
// folds: a bare `{ hash }` / `{ rid }`, or the formal Event's `site` / `sites`
// (string | { hash } | list). Enacted-loop events carry no hash and touch nothing —
// they still count toward `load`, they just don't steer a blink's re-projection.
const hashesOf = (event) => {
  const out = [];
  if (typeof event.hash === 'string') out.push(event.hash);
  if (typeof event.rid === 'string') out.push(event.rid);
  const s = event.site ?? event.sites ?? null;
  if (s != null) {
    for (const x of (Array.isArray(s) ? s : [s])) {
      if (typeof x === 'string') out.push(x);
      else if (x && typeof x.hash === 'string') out.push(x.hash);
    }
  }
  return out;
};

// latestBindingTime — the fold's own "now": the most recent descriptor time across the
// live frontier. Read at the open cursor (Infinity) the fold returns every descriptor
// with its `t` undecayed, so this is a cheap pure scan — no clock, no accumulation.
const latestBindingTime = (f, hashes) => {
  let max = -Infinity;
  for (const h of hashes) {
    const d = f.dossierOf(h, Infinity, { keep: -1 });
    for (const x of d.descriptors) if (x.t > max) max = x.t;
  }
  return max === -Infinity ? Infinity : max;
};

const round = (x) => Math.round(x * 1000) / 1000;
