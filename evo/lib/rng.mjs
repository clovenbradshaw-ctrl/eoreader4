// The sampler — randomness in the PRESSURE, never in the test.
//
// A pressure is a sampled object: draw one value on each orthogonal axis and the
// product is varied by construction rather than noisy. The draw is seeded so a
// pressure that located a gap is replayable exactly (the seed of record lives in
// the archive). Nothing here decides what counts as passing — the held key, the
// control, and the parity gate do.

// mulberry32 — a tiny deterministic PRNG. Seed it from the seed of record so the
// same article (or code site) draws the same axes on replay.
export const makeRng = (seed) => {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Hash a string seed (an article title, a code-site path) to a 32-bit integer.
export const hashSeed = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// The 27 cells = operator × grain-as-domain, addressed operator(Site,Resolution).
// Bias the draw toward the THIN cells: EVA, REC, the empty SYN by Ground, and the
// significance row (DEF/EVA/REC) which the corpus shows impoverished.
export const OPERATORS = ['NUL', 'SEG', 'DEF', 'SIG', 'CON', 'EVA', 'INS', 'SYN', 'REC'];
const THIN = ['EVA', 'REC', 'SYN', 'DEF'];        // where the engine is least adapted
export const MODALITIES = ['text', 'image', 'music', 'frequency', 'video', 'pair'];
export const KINDS = ['discrimination', 'invariance', 'prediction', 'robustness',
                      'transfer', 'composition', 'adversarial'];
export const LEVELS = ['set-overlap', 'structure', 'significance'];
export const HORIZONS = ['unit', 'window', 'reading'];

// Draw one pressure. `thinBias` raises the odds of a thin target cell — that is
// where a pressure has the most gradient to climb.
export const drawPressure = (rng, { thinBias = 0.6 } = {}) => {
  const target = rng() < thinBias ? pick(rng, THIN) : pick(rng, OPERATORS);
  return {
    target,
    modality: pick(rng, MODALITIES),
    kind: pick(rng, KINDS),
    level: pick(rng, LEVELS),
    horizon: pick(rng, HORIZONS),
  };
};

export { pick };
