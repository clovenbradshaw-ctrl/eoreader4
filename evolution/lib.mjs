// evolution/lib.mjs — the shared experiment harness.
//
// Randomness lives in the PRESSURE (the draw, the schedule, the seed vocabulary),
// never in the TEST. Schedules are built from a seeded PRNG so every draw is
// replayable; the held key and the controls decide what counts as adaptation.

import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ingestText, ingestMusic } from '../src/organs/in/index.js';
import { forwardDist } from '../src/core/index.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));

// ---- deterministic PRNG (replayable draws) ---------------------------------
export const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- newcomer schedules ----------------------------------------------------
// A schedule is a boolean[] `firstAt`: firstAt[t] === true marks a unit at which a
// brand-new atom is introduced (a newcomer). All three schedules place the SAME
// number K of newcomers over the SAME length L, so they differ only in STRUCTURE,
// never base rate. The clustered one is the planted contrast; iid and monotone are
// the controls (iid: recency is noise; monotone: the constant's home turf).
export const makeSchedule = (kind, { L = 64, K = 11, seed = 1 } = {}) => {
  const rng = mulberry32(seed);
  const firstAt = Array(L).fill(false);
  const place = (units) => { for (const u of units) firstAt[u] = true; };

  if (kind === 'clustered') {
    // K newcomers bunched into 3 bursts at arbitrary points across the reading —
    // including the MIDDLE and END, where mass has already accumulated and the
    // constant reserve has decayed its p(unseen) toward zero. Recency is the signal.
    const bursts = [[4, 9], [28, 33], [50, 55]];   // [start,end) windows
    const slots = [];
    for (const [a, b] of bursts) for (let u = a; u < b; u++) slots.push(u);
    // take K of the burst slots (deterministic shuffle, then first K)
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    place(slots.slice(0, K).sort((a, b) => a - b));
  } else if (kind === 'iid') {
    // K newcomers at uniformly-random units — memoryless; the recent rate carries no
    // information about the next unit beyond the base rate. A fix that "wins" here is
    // overfitting recency-noise, not reading structure.
    const idx = [...Array(L).keys()];
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    place(idx.slice(0, K).sort((a, b) => a - b));
  } else if (kind === 'monotone') {
    // K newcomers front-loaded then sparse — hazard high early, decreasing, the exact
    // shape the CONSTANT 1/(Σmass+1) already captures (Σmass small early). The
    // loud-surface control: the signal-derived reserve must MATCH here, not crush it.
    let placed = 0, u = 0;
    while (placed < K && u < L) {
      const hazard = 1 / (1 + u * 0.5);            // ∝ 1/(t+c): declines with the stream
      if (rng() < hazard) { firstAt[u] = true; placed++; }
      u++;
    }
    // top up deterministically at the front if the draw fell short
    for (let v = 0; placed < K && v < L; v++) if (!firstAt[v]) { firstAt[v] = true; placed++; }
  } else {
    throw new Error(`unknown schedule kind: ${kind}`);
  }
  return { kind, L, K, firstAt };
};

// ---- realize a schedule in two genuinely different ORGANS -------------------
// The newcomer schedule is abstract. Each organ realizes it on its own membrane:
// text on word-entities (a fresh proper noun is a newcomer), music on pitch-classes
// (a fresh pitch is a newcomer). Same schedule, two front-ends → the omnimodal gate.

// A name pool drawn from the Wikipedia seeds of record (so the material is far from
// any tuning set). Single intransitive subjects keep one INS per unit.
const NAME_POOL = ['Setiabudi', 'Ecast', 'Henry', 'Monongahela', 'Mingo', 'Rasuna',
  'Guntur', 'Sage', 'Behavior', 'Journal', 'Covered', 'Bridge', 'Jakarta', 'Pennsylvania'];
const VERBS = ['arrived', 'waited', 'returned', 'paused', 'continued', 'remained', 'departed', 'spoke'];
// DISTINCT pitch classes only — the music organ keys by pitch class (midi % 12), so
// C4 and C5 are the SAME entity. A pool spanning two octaves would silently halve the
// newcomer count; one octave of twelve classes keeps "a new pitch" a real newcomer.
const PITCH_POOL = ['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4'];

// Realize as TEXT. New unit → introduce the next fresh name; repeat unit → re-mention
// an already-introduced name. One subject + one verb ⇒ exactly one INS per unit.
export const realizeText = ({ firstAt }, { seed = 7 } = {}) => {
  const rng = mulberry32(seed);
  const introduced = [];
  let next = 0;
  const sentences = firstAt.map((isNew) => {
    let name;
    if (isNew || introduced.length === 0) { name = NAME_POOL[next % NAME_POOL.length] + (next >= NAME_POOL.length ? String(Math.floor(next / NAME_POOL.length)) : ''); introduced.push(name); next++; }
    else name = introduced[Math.floor(rng() * introduced.length)];
    return `${name} ${VERBS[Math.floor(rng() * VERBS.length)]}.`;
  });
  return sentences.join(' ');
};

// Realize as MUSIC. New unit → an unsounded pitch class; repeat → a sounded one.
export const realizeMusic = ({ firstAt }, { seed = 13 } = {}) => {
  const rng = mulberry32(seed);
  const sounded = [];
  let next = 0;
  const notes = firstAt.map((isNew) => {
    if ((isNew || sounded.length === 0) && next < PITCH_POOL.length) { const p = PITCH_POOL[next++]; sounded.push(p); return p; }
    return sounded[Math.floor(rng() * sounded.length)];   // a repeat (or new-but-pool-exhausted falls back to repeat)
  });
  return notes;
};

// ---- read the REALIZED newcomer stream out of an organ's log (instrument truth) --
// We never trust the intended schedule; we read what the organ actually emitted.
// Returns insByUnit (array of arrays of figure ids) over the units.
export const insByUnit = (doc, L) => {
  const out = Array.from({ length: L }, () => []);
  for (const e of doc.log.events) {
    if (e.op === 'INS' && e.sentIdx != null && e.sentIdx < L) out[e.sentIdx].push(e.id);
  }
  return out;
};

export const ingestTextDoc = (text) => ingestText(text, {});
export const ingestMusicDoc = (notes) => ingestMusic({ name: `nr-${Math.random().toString(36).slice(2)}`, notes });

// ---- the figure-field walk (causal), driving the REAL interior forwardDist -------
// At each unit the figure field advances m' = γ·m + deposit (the same law surpriseAt
// uses). p(unseen next) is read off forwardDist(.).reserve = novelty/(Σm+novelty).
// Two reserve amplitudes are compared on the IDENTICAL field: the live CONSTANT
// (1.0) and a SIGNAL-derived mass handed in per step (R_t). Returns per-unit channels
// and the causal target y_t = 1 iff unit t+1 introduces a newcomer.
export const figureFieldWalk = (insUnits, { gamma, reserveMass }) => {
  const seen = new Set();
  const prof = new Map();
  const rows = [];
  const newcomersAt = [];
  for (let t = 0; t < insUnits.length; t++) {
    const ids = insUnits[t];
    let newcomers = 0;
    for (const id of ids) if (!seen.has(id)) { newcomers++; seen.add(id); }
    newcomersAt.push(newcomers);
    // advance the figure field by the same decay+deposit law
    for (const k of prof.keys()) prof.set(k, gamma * prof.get(k));
    for (const id of ids) prof.set(`f:${id}`, (prof.get(`f:${id}`) || 0) + 1);
    rows.push({ t, ids: ids.slice(), newcomers });
  }
  // reserveMass(t, newcomersUpToT) → the amplitude for unit t's prediction. We need a
  // second causal pass because the constant and signal reserves both read the same
  // field but differ in amplitude; do it inline with a fresh field to keep it honest.
  const seen2 = new Set();
  const prof2 = new Map();
  for (let t = 0; t < insUnits.length; t++) {
    const ids = insUnits[t];
    let newcomers = 0;
    for (const id of ids) if (!seen2.has(id)) { newcomers++; seen2.add(id); }
    for (const k of prof2.keys()) prof2.set(k, gamma * prof2.get(k));
    for (const id of ids) prof2.set(`f:${id}`, (prof2.get(`f:${id}`) || 0) + 1);
    const novelty = reserveMass({ t, newcomers, newcomersAt });
    const { reserve } = forwardDist(prof2, { novelty });
    rows[t].novelty = novelty;
    rows[t].pNew = reserve;
    rows[t].yNext = t + 1 < insUnits.length ? (newcomerCount(insUnits[t + 1], seen2) > 0 ? 1 : 0) : null;
  }
  return rows;
};

const newcomerCount = (ids, seenSoFar) => { let n = 0; for (const id of ids) if (!seenSoFar.has(id)) n++; return n; };

// ---- scoring ----------------------------------------------------------------
const clip = (p) => Math.min(1 - 1e-9, Math.max(1e-9, p));
export const logLoss = (ps, ys) => {
  let s = 0, n = 0;
  for (let i = 0; i < ps.length; i++) { if (ys[i] == null) continue; const p = clip(ps[i]); s += -(ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p)); n++; }
  return n ? s / n : NaN;
};
export const brier = (ps, ys) => {
  let s = 0, n = 0;
  for (let i = 0; i < ps.length; i++) { if (ys[i] == null) continue; s += (ps[i] - ys[i]) ** 2; n++; }
  return n ? s / n : NaN;
};
export const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

// ---- substrate append helpers ----------------------------------------------
export const appendJsonl = (relpath, obj) => appendFileSync(HERE + relpath, JSON.stringify(obj) + '\n');
export const readJsonl = (relpath) => {
  try { return readFileSync(HERE + relpath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); }
  catch { return []; }
};
