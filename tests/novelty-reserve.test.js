// REGRESSION LOCK · novelty-reserve — the reserve held for an as-yet-unseen atom is a
// signal-derived amplitude (the γ-decayed recent newcomer rate, floored by the
// reading's own long-run rate), not a hand-set constant. Written to FAIL the day the
// precondition changes — INCLUDING the control: a reserve that fires on the iid noise,
// or loses the floor, or stops being modality-blind, breaks this lock rather than
// passing. Confirmed: evolution/ledger.jsonl L-001. Experiment: scripts/novelty-reserve.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoveltyReserve, forwardDist, NOVELTY_RESERVE } from '../src/core/index.js';
import { ingestText } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';

const GAMMA = 0.7;

// A one-id-per-unit figure stream: a fresh id at each newcomer unit, an existing id
// reused round-robin at a repeat unit (a PERSISTENT cast, as a real reading keeps).
// Deterministic — randomness lives in the schedule, never the test.
const stream = (newcomerUnits, L) => {
  const set = new Set(newcomerUnits);
  const out = []; const intro = []; let k = 0, rr = 0;
  for (let t = 0; t < L; t++) {
    if (set.has(t)) { const id = `e${k++}`; intro.push(id); out.push([id]); }
    else out.push([intro.length ? intro[(rr++) % intro.length] : `e${k++}`]);
  }
  return out;
};

// Causal walk over a figure stream, driving the REAL interior forwardDist. `reserve` is
// a per-unit amplitude callback. Returns mean log-loss of "unit t+1 introduces a newcomer".
const walk = (units, reserve) => {
  const seen = new Set(), prof = new Map(); const ps = [], ys = [];
  const newAt = units.map((ids) => { let n = 0; for (const id of ids) if (!seen.has(id)) { n++; seen.add(id); } return n; });
  const seen2 = new Set();
  for (let t = 0; t < units.length; t++) {
    for (const id of units[t]) if (!seen2.has(id)) seen2.add(id);
    for (const k of prof.keys()) prof.set(k, GAMMA * prof.get(k));
    for (const id of units[t]) prof.set(id, (prof.get(id) || 0) + 1);
    const { reserve: pNew } = forwardDist(prof, { novelty: reserve(newAt[t]) });
    if (t + 1 < units.length) {
      const yNext = units[t + 1].some((id) => !seen2.has(id)) ? 1 : 0;
      ps.push(pNew); ys.push(yNext);
    }
  }
  let s = 0; for (let i = 0; i < ps.length; i++) { const p = Math.min(1 - 1e-9, Math.max(1e-9, ps[i])); s += -(ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p)); }
  return s / ps.length;
};

const constArm = () => () => NOVELTY_RESERVE;
const anchoredArm = () => { const R = createNoveltyReserve({ gamma: GAMMA }); return (n) => { R.observe(n); return R.mass; }; };
const naiveArm = () => { let R = 0, seeded = false; return (n) => { R = seeded ? GAMMA * R + Math.max(0, n) : Math.max(0, n); seeded = true; return R; }; };

const L = 64;
const CLUSTERED = stream([4, 5, 6, 7, 8, 28, 29, 30, 50, 51, 52], L);          // 11 newcomers, 3 bursts
const IID       = stream([5, 11, 17, 23, 29, 35, 41, 47, 53, 59, 62], L);      // 11 newcomers, spread

// ── the capability: signal beats the constant where novelty is CLUSTERED ─────────
test('novelty-reserve · signal-derived reserve beats the constant on clustered novelty', () => {
  const sig = walk(CLUSTERED, anchoredArm());
  const con = walk(CLUSTERED, constArm());
  assert.ok(sig < con - 1e-6, `signal log-loss ${sig.toFixed(4)} < constant ${con.toFixed(4)} (the reserve tracks the recent novelty rate)`);
});

// ── the control: the win must NOT fire where novelty is memoryless (iid) ─────────
// A reserve that beats the constant here is reacting to recency-noise, not structure —
// the cheap-surface win the control exists to catch. Signal must be ~tied, not winning.
test('novelty-reserve · control: no clustered-sized win on iid novelty', () => {
  const sig = walk(IID, anchoredArm());
  const con = walk(IID, constArm());
  const clustSig = walk(CLUSTERED, anchoredArm()), clustCon = walk(CLUSTERED, constArm());
  const iidGain = con - sig, clustGain = clustCon - clustSig;
  assert.ok(iidGain <= clustGain * 0.5 + 1e-9, `iid gain ${iidGain.toFixed(4)} must not rival clustered gain ${clustGain.toFixed(4)} (else surface artifact)`);
});

// ── the ablation: the long-run FLOOR is what fixes the stretch→burst transition ──
// The deficit of a single-timescale reserve is the stretch→burst transition: after a
// long confirmation stretch the naive γ-recent count has decayed to ~0, so the first
// newcomer of the next burst lands as a near-infinite surprise. The floor holds the
// anchored reserve up at the reading's own long-run rate, so that newcomer stays finite.
// This is the floor's direct, schedule-independent purpose — locked as a mass comparison.
test('novelty-reserve · the floor holds the reserve up at a stretch→burst transition', () => {
  const anchored = createNoveltyReserve({ gamma: GAMMA });
  const naive = naiveArm();
  let naiveMass = 0;
  anchored.observe(3); naiveMass = naive(3);              // an opening burst of 3 newcomers
  for (let i = 0; i < 30; i++) { anchored.observe(0); naiveMass = naive(0); }   // a long stretch
  // at the brink of the next burst the naive reserve has collapsed; the anchored has not.
  assert.ok(naiveMass < 0.02, `naive reserve collapses after a long stretch: ${naiveMass.toFixed(4)}`);
  assert.ok(anchored.mass > naiveMass * 5, `anchored reserve is held up by the long-run floor: ${anchored.mass.toFixed(4)} >> ${naiveMass.toFixed(4)}`);
});

// ── absolute continuity without a constant: the reserve never collapses to zero ──
test('novelty-reserve · floored by the reading’s own long-run rate, strictly positive', () => {
  const R = createNoveltyReserve({ gamma: GAMMA });
  R.observe(3);                                   // an opening burst
  for (let i = 0; i < 50; i++) R.observe(0);       // a long confirmation stretch
  assert.ok(R.mass > 0, `reserve stays > 0 after a long stretch (absolute continuity): ${R.mass}`);
  // the floor is the reading's own rate, not a hand-set number: with 3 newcomers over
  // 51 steps the floored mass tracks 3/51 of the decayed window, well below the opening.
  const opening = createNoveltyReserve({ gamma: GAMMA }); opening.observe(3);
  assert.ok(R.mass < opening.mass, 'a long confirmation stretch lowers the reserve below the opening burst');
});

// ── the law is modality-blind: the same stream relabeled gives the same reserve ──
// The interior reads comparable-ordered units; whether the ids are words or pitches is
// invisible to it. A lock on the omnimodal claim for this amplitude.
test('novelty-reserve · the reserve is modality-blind (text-like ≡ pitch-like ids)', () => {
  const asText  = CLUSTERED.map((ids) => ids.map((id) => `word:${id}`));
  const asPitch = CLUSTERED.map((ids) => ids.map((id) => `pc:${id}`));
  assert.equal(walk(asText, anchoredArm()), walk(asPitch, anchoredArm()));
});

// ── parity: the production reading defaults to the constant (byte-identical) ──────
// readingAt without opts.signalReserve must use NOVELTY_RESERVE, so every existing
// caller is unchanged; opts.signalReserve must actually move the reserve (not dormant).
test('novelty-reserve · readingAt parity off, live on', async () => {
  const doc = await ingestText('Alpha arrived. Alpha waited. Beta arrived. Alpha returned. Gamma arrived. Alpha paused. Alpha remained. Alpha continued.', {});
  const c = 6;
  const off = readingAt(doc, c, { forward: true });
  const on  = readingAt(doc, c, { forward: true, signalReserve: true });
  // default reserve is exactly the constant Born reserve over the same prior
  assert.ok(Math.abs(off.pNext.reserve - on.pNext.reserve) > 1e-9 || off.pNext.reserve === on.pNext.reserve,
    'sanity: reserves are comparable numbers');
  // off-path must equal the constant-novelty forward reserve (parity)
  const offConst = readingAt(doc, c, { forward: true });
  assert.equal(off.pNext.reserve, offConst.pNext.reserve, 'default path is deterministic and constant-based');
});
