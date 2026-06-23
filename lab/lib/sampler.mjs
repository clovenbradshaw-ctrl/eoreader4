// The sampler — a pressure is a SAMPLED OBJECT. Draw one value on each orthogonal
// axis; the draw composes into the smallest stimulus that stresses that combination.
// The axes supply the FORM; the random seed (seed.mjs) supplies the CONTENT. The
// product is varied by construction, not by noise.
//
// Bias the target draw toward the thin cells (EVA, REC, the empty SYN·Ground) and
// the impoverished operators — that is where the engine is least adapted and a
// pressure has the most gradient to climb.

// The 27 cells: nine operators (docs/operators.md) × three grains. The operators an
// EO address derives default to a grain (INS·NUL→Ground; REC·SYN·CON→Pattern; rest
// →Figure), so the "natural" cell of an operator is named; the off-grain cells are
// the thin ones a pressure can force a phenomenon into.
export const OPERATORS = ['NUL', 'SEG', 'DEF', 'SIG', 'CON', 'EVA', 'INS', 'SYN', 'REC'];
export const GRAINS = ['Ground', 'Figure', 'Pattern'];

// Thin cells the corpus shows impoverished (docs/spec-one-surprise.md: Atmosphere is
// near-empty; EVA/REC are the significance row that stays shallow). Weight the draw
// toward these.
const THIN = new Set(['EVA·Ground', 'EVA·Figure', 'REC·Ground', 'REC·Figure', 'SYN·Ground', 'DEF·Ground', 'NUL·Pattern']);

export const MODALITIES = ['text', 'image', 'frequency', 'tonal', 'text+frequency', 'text+image', 'rhythm'];
export const KINDS = ['discrimination', 'invariance', 'prediction', 'robustness', 'transfer', 'composition', 'adversarial'];
export const LEVELS = ['set-overlap', 'structure', 'significance'];
export const HORIZONS = ['within-unit', 'across-window', 'across-reading'];

// Deterministic PRNG (mulberry32) so a draw is replayable from its seed-of-record.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const weightedCell = (r) => {
  // 60% of draws land on a thin cell; the rest are uniform over the 27.
  if (r() < 0.6) { const c = [...THIN][Math.floor(r() * THIN.size)]; const [op, g] = c.split('·'); return { op, grain: g }; }
  return { op: pick(r, OPERATORS), grain: pick(r, GRAINS) };
};

// Draw the five axes from a numeric draw-seed.
export function drawAxes(drawSeed) {
  const r = rng(drawSeed);
  const cell = weightedCell(r);
  return {
    target: `${cell.op}·${cell.grain}`,
    op: cell.op,
    grain: cell.grain,
    modality: pick(r, MODALITIES),
    kind: pick(r, KINDS),
    level: pick(r, LEVELS),
    horizon: pick(r, HORIZONS),
    thin: THIN.has(`${cell.op}·${cell.grain}`),
  };
}

// The five ways a seed becomes a pressure (campaign §"Five ways"). The sampler picks
// one given how many seeds are in hand: orthogonal-collision is the richest, so most
// EXPLORE cycles draw two seeds and collide them.
export const RECIPES = ['domain-injection', 'orthogonal-collision', 'structured-draw', 'mutation', 'empty-cell'];

export function pickRecipe(r, nSeeds) {
  if (nSeeds >= 2) return r() < 0.7 ? 'orthogonal-collision' : 'structured-draw';
  return pick(r, ['domain-injection', 'structured-draw', 'empty-cell']);
}

// A crude content fingerprint for the novelty score (token set of title+description).
export const fingerprint = (seed) =>
  new Set(`${seed.title} ${seed.description} ${seed.extract}`.toLowerCase().match(/[a-z][a-z']{2,}/g) || []);

export const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};

// Novelty of a pressure against the archive: 1 − max content overlap with any prior
// pressure's seed fingerprint. High novelty = far from everything tried.
export function noveltyAgainst(fp, archiveFps) {
  let maxOverlap = 0;
  for (const prior of archiveFps) maxOverlap = Math.max(maxOverlap, jaccard(fp, prior));
  return 1 - maxOverlap;
}
