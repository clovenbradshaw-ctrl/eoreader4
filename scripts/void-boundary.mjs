// The VOID boundary, derived — the engine sets its own noise null, live.
//
// `scripts/abstain.mjs` earned the refusal with a null, but a null it CALIBRATED
// by hand: run 40 noise clips, take the max, pass it in as `minOverlap` /
// `nullExtent`. That constant is still a number a human computed. This run removes
// it. The threshold is now a READOUT the signal computes for itself, each reading,
// from its own non-cohering background — leave-one-out, extreme-value, robust to a
// few real structures, causal/streaming (see `src/read/voidnull.js`).
//
// The only number a human states is ALPHA: the tolerated probability of mistaking
// noise for structure. The physics computes the overlap/extent boundary that
// delivers it. We sweep both directions — pure noise (must VOID, including the
// decisive 35% snow) and a real shape from clean to faint (must hold SYN) — and let
// the engine derive the boundary every time.

import { ingestFrames } from '../src/ingest/video.js';
import { ingestFrequencies } from '../src/ingest/frequency.js';
import { detectMotion, discoverEquivalences, coherentFigures, createNoiseFloor, extremeValueZ } from '../src/read/index.js';

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ALPHA = 0.01;   // fire SYN only when chance would make this structure < 1% of the time

// ---- fixtures --------------------------------------------------------------
const W = 34, H = 20, R = 3, FRAMES = 10;
const clip = (snow, seed, shape, move) => {
  const rand = rng(seed), clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const out = []; let cx = 5, cy = 10, vx = move ? 3 : 0, vy = 0;
  for (let t = 0; t < FRAMES; t++) {
    const f = Array.from({ length: H }, () => new Array(W).fill(0));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < snow) f[y][x] = 1;
    if (shape) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R * R) f[y][x] = 1;
    out.push(f);
    if (move && t === 4) { vx = 0; vy = 2; }
    cx = clamp(cx + vx, R, W - 1 - R); cy = clamp(cy + vy, R, H - 1 - R);
  }
  return out;
};
const noiseClip  = (snow, seed) => clip(snow, seed, false, false);
const circleClip = (snow, seed) => clip(snow, seed, true, true);

const inharm = (seed) => { const r = rng(seed); return Array.from({ length: 16 }, () => 1 + r() * 16); };
const noiseDoc = (seed) => ingestFrequencies({ name: 'n', notes: [{ hz: 220 }, { hz: 287 }, { hz: 413 }, { hz: 631 }], partialMultipliers: inharm(seed) });
const harmonic = () => ingestFrequencies({ name: 'r', notes: [{ hz: 220 }, { hz: 330 }, { hz: 440 }, { hz: 660 }] });

// Re-derive the boundary the reader uses, so we can print it next to the decision.
const extentBoundary = (frames, alpha) => {
  const figs = coherentFigures(ingestFrames({ name: 'c', frames }));
  const floor = createNoiseFloor({ scale: 'log', alpha, grain: 1, N: figs.length });
  for (const f of figs.slice(1)) floor.observe(f.meanSize);
  return { top: figs[0].meanSize, bound: floor.threshold() };
};

// ============================================================================
console.log('=== THE NUMBER IS NOW A READOUT ===');
console.log(`  alpha = ${ALPHA}  (the one human input: the hallucination budget)`);
console.log(`  extreme-value z it implies: N=10 → ${extremeValueZ(10, ALPHA).toFixed(2)}σ,  N=100 → ${extremeValueZ(100, ALPHA).toFixed(2)}σ`);
console.log('  (more chance structures to beat → a higher bar, the max-of-N correction)\n');

// ============================================================================
console.log('=== VOID DIRECTION · pure noise must abstain at EVERY density ===');
console.log('  the engine derives the per-frame-extent null from each clip, leave-one-out\n');
for (const snow of [0.02, 0.05, 0.10, 0.20, 0.35]) {
  let voids = 0; const tops = [], bounds = [];
  for (let s = 1000; s < 1010; s++) {
    const frames = noiseClip(snow, s);
    const { top, bound } = extentBoundary(frames, ALPHA);
    tops.push(top); bounds.push(bound);
    if (detectMotion(ingestFrames({ name: 'n', frames }), { alpha: ALPHA, emit: false }).voided) voids++;
  }
  const avgTop = (tops.reduce((a, b) => a + b) / tops.length).toFixed(1);
  const avgB = (bounds.reduce((a, b) => a + b) / bounds.length).toFixed(1);
  const tag = snow === 0.35 ? '  ← decisive: the longest chain sits AT its own null' : '';
  console.log(`  snow ${String(Math.round(snow * 100)).padStart(2)}%:  best chain ~${avgTop}px  vs derived null ~${avgB}px  →  VOID ${voids}/10${tag}`);
}

console.log('\n=== SYN DIRECTION · a real circle must hold from clean down to faint ===\n');
for (const snow of [0.02, 0.05, 0.10, 0.20]) {
  let syn = 0; const tops = [], bounds = [];
  for (const s of [7, 8, 9]) {
    const frames = circleClip(snow, s);
    const { top, bound } = extentBoundary(frames, ALPHA);
    tops.push(top); bounds.push(bound);
    if (!detectMotion(ingestFrames({ name: 'c', frames }), { alpha: ALPHA, emit: false }).voided) syn++;
  }
  const avgTop = (tops.reduce((a, b) => a + b) / tops.length).toFixed(1);
  const avgB = (bounds.reduce((a, b) => a + b) / bounds.length).toFixed(1);
  console.log(`  snow ${String(Math.round(snow * 100)).padStart(2)}%:  circle ~${avgTop}px  vs derived null ~${avgB}px  →  SYN ${syn}/3`);
}
console.log('  (past ~25% percolation absorbs the circle — the honest limit abstain.mjs records)');

// ============================================================================
console.log('\n=== AUDIO · the harmonic octave clears the derived null; noise does not ===');
const real = discoverEquivalences(harmonic(), { alpha: ALPHA, emit: false });
console.log(`  harmonic 220/330/440/660:  ${real.pairs.length} merge(s), voided=${real.voided}  →  SYN`);
let voidA = 0; for (let s = 11; s < 21; s++) if (discoverEquivalences(noiseDoc(s), { alpha: ALPHA, emit: false }).voided) voidA++;
console.log(`  inharmonic noise (10 runs):  voided ${voidA}/10  →  VOID  (the inharmonic control, as a special case)`);

console.log('\n=== WHAT THIS SHOWS ===');
console.log('No boundary was set. Each reading, the engine estimated from its own noise the');
console.log('distribution of the largest structure chance would produce, and fired SYN only when');
console.log('the proposal beat it. The 35% snow chain — the longest of many chance chains — sits at');
console.log('the max of its own background and so fires VOID; a real circle exceeds that max and');
console.log('fires SYN. The boundary is the Born rule for the engine: the noise gives the odds, the');
console.log('reading does the measuring. You set alpha — how wrong you are willing to be. The');
console.log('physics sets the rest.');
