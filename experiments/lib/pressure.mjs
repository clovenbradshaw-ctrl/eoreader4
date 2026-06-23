// The pressure sampler — a pressure is a sampled object across orthogonal axes.
//
// Draw one value on each axis; the draw composes into the smallest stimulus that
// stresses that combination. The axes are orthogonal, so the product is varied by
// construction rather than noisy. Randomness lives HERE, in the draw — never in the
// test that scores the resulting experiment.

// The 27 cells = nine operators × three grains. Bias the draw toward the THIN cells:
// the impoverished operators and the empty SYN-by-Ground, where the engine is least
// adapted and a pressure has the most gradient to climb. (docs/cube.md, docs/operators.md)
export const OPERATORS = ['NUL', 'SEG', 'DEF', 'SIG', 'CON', 'EVA', 'INS', 'SYN', 'REC'];
export const GRAINS = ['Ground', 'Figure', 'Pattern'];

// Thin cells get extra weight in the draw (the corpus shows these impoverished; the
// Significance row — EVA/REC — and the empty SYN-by-Ground are where new structure must
// be grown or a true limit found and named).
const THIN = new Set(['EVA', 'REC', 'SYN', 'NUL']);

export const AXES = {
  modality: ['text', 'image-regions', 'tone', 'raw-frequency', 'sequence', 'text+tone', 'text+image'],
  kind: ['discrimination', 'invariance', 'prediction', 'robustness', 'transfer', 'composition', 'adversarial'],
  level: ['set-overlap', 'middle', 'significance'],
  horizon: ['within-unit', 'across-window', 'whole-reading'],
  source: ['domain-injection', 'orthogonal-collision', 'structured-draw', 'mutation-of-known-good', 'empty-cell'],
};

const pick = (xs, rng) => xs[Math.floor(rng() * xs.length)];

// A weighted operator draw biased toward the thin cells.
const drawOperator = (rng) => {
  const pool = [...OPERATORS, ...[...THIN]];   // thin operators appear twice → ~2× weight
  return pick(pool, rng);
};

// mulberry32 — a small seeded PRNG so a pressure draw is itself replayable from a seed.
export const rngFrom = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Draw a pressure. `seed` makes the draw replayable; omit for a wild draw.
export const samplePressure = (seed = (Math.random() * 2 ** 31) | 0) => {
  const rng = rngFrom(seed);
  const op = drawOperator(rng);
  const grain = pick(GRAINS, rng);
  return {
    seed,
    target: { operator: op, grain, cell: `${op}_${grain}`, thin: THIN.has(op) },
    modality: pick(AXES.modality, rng),
    kind: pick(AXES.kind, rng),
    level: pick(AXES.level, rng),
    horizon: pick(AXES.horizon, rng),
    source: pick(AXES.source, rng),
  };
};

// Difficulty + novelty scoring — keep the pressures at the EDGE of competence (the ones
// the engine half-passes), discard the flat. `difficulty` in [0,1]: 0 = everything
// passes, 1 = nothing could pass; keep the middle. `novelty` against the archive: the
// fraction of archived pressures whose (cell, modality, kind) signature differs.
export const noveltyAgainst = (pressure, archive) => {
  if (!archive.length) return 1;
  const sig = (p) => `${p.target?.cell || p.cell}|${p.modality}|${p.kind}`;
  const mine = sig(pressure);
  const collisions = archive.filter(a => sig(a.pressure || a) === mine).length;
  return 1 - collisions / archive.length;
};
export const keepEdge = ({ difficulty, novelty }) =>
  difficulty > 0.2 && difficulty < 0.85 && novelty > 0.5;

if (import.meta.url === `file://${process.argv[1]}`) {
  const seed = process.argv[2] ? Number(process.argv[2]) : undefined;
  const p = samplePressure(seed);
  console.log(JSON.stringify(p, null, 2));
  console.log(`\nstimulus shape: ${p.source} · ${p.kind} on ${p.target.cell}` +
    `${p.target.thin ? ' (THIN cell — high gradient)' : ''} · ${p.modality} · ${p.level} · ${p.horizon}`);
}
