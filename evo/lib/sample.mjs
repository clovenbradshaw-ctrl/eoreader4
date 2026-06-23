// The sampler — a pressure is a SAMPLED OBJECT. Draw one value on each orthogonal
// axis; the draw composes into the smallest stimulus that stresses that combination.
// The axes are orthogonal so the product is varied by construction, not noisy.
//
// Randomness lives HERE, in the pressure. Never in the test: a drawn pressure still
// becomes a blind experiment with a held key and a loud-surface control. The draw
// decides what gets stressed; the control and the parity gate decide what counts.

import { OPERATORS, GRAINS } from '../../src/core/operators.js';

// A small, seeded PRNG (mulberry32) so every draw is REPLAYABLE from its seed of
// record — the archive's replay requirement.
export const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
// Weighted pick — bias the draw toward the thin cells, where the engine is least
// adapted and a pressure has the most gradient to climb.
const weightedPick = (r, xs, w) => {
  const tot = xs.reduce((s, x) => s + (w[x] ?? 1), 0);
  let t = r() * tot;
  for (const x of xs) { t -= (w[x] ?? 1); if (t <= 0) return x; }
  return xs[xs.length - 1];
};

const OPS = Object.keys(OPERATORS);
// The 27 cells: each operator (ACT face) read at each grain (Ground · Figure · Pattern).
export const CELLS = OPS.flatMap((op) => GRAINS.map((g) => `${op}@${g}`));

// The corpus shows these cells impoverished — bias toward them (task: EVA, REC, the
// empty SYN by Ground, and the operators the corpus shows thin).
const THIN_OP = { EVA: 4, REC: 4, SYN: 3, NUL: 2, SEG: 2, INS: 1, SIG: 1, CON: 1, DEF: 1 };
const THIN_GRAIN = { Ground: 2, Pattern: 2, Figure: 1 };
const cellWeight = Object.fromEntries(CELLS.map((c) => {
  const [op, g] = c.split('@');
  return [c, (THIN_OP[op] ?? 1) * (THIN_GRAIN[g] ?? 1)];
}));

const MODALITIES = ['text', 'image', 'tonal', 'frequency', 'text+tonal', 'text+frequency', 'image+text'];
const KINDS = ['discrimination', 'invariance', 'prediction', 'robustness', 'transfer', 'composition', 'adversarial'];
const LEVELS = ['set-overlap', 'structure', 'significance'];     // L1 · L2 · L3
const HORIZONS = ['within-unit', 'across-window', 'across-reading'];

// drawPressure(seed) → the sampled axes. Deterministic in `seed`, so the archive's
// `seed` field replays the exact draw.
export const drawPressure = (seed) => {
  const r = rng(seed);
  return {
    seed,
    target: weightedPick(r, CELLS, cellWeight),
    modality: pick(r, MODALITIES),
    kind: pick(r, KINDS),
    level: pick(r, LEVELS),
    horizon: pick(r, HORIZONS),
  };
};

// CLI: `node evo/lib/sample.mjs [seed]` prints one draw (random seed if omitted).
if (import.meta.url === `file://${process.argv[1]}`) {
  const s = Number(process.argv[2]);
  const seed = Number.isFinite(s) ? s : (Math.random() * 2 ** 32) >>> 0;
  console.log(JSON.stringify(drawPressure(seed), null, 2));
}
