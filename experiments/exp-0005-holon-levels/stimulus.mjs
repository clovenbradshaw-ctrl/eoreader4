// exp-0005 · NESTED stimulus — the observed operating at multiple holon levels.
//
// Each stream carries boundaries at TWO or THREE scales at once. A coarse level splits
// the stream into sections living in orthogonal FAMILY subspaces (a strong split); each
// section carries a finer level of sub-readings inside that family (a subordinate split);
// a three-level stream nests once more. A single global read sees only the dominant
// level; the finer boundaries are there in the signal but collapsed unless the reader
// descends. The held key records the boundaries at every level.
//
// Deterministic (seeded PRNG, no deps). Writes battery/*.json read by measure.mjs.
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'battery');
mkdirSync(OUT, { recursive: true });

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
// k orthonormal axes
function axes(dim, k, seed) {
  const r = rng(seed), A = [];
  for (let c = 0; c < k; c++) {
    let v = Array.from({ length: dim }, () => gauss(r));
    for (const u of A) { const p = dot(v, u); v = v.map((x, i) => x - p * u[i]); }
    const n = norm(v); A.push(v.map((x) => x / n));
  }
  return A;
}
const dump = (name, units, levels, tol, note) => {
  writeFileSync(join(OUT, name), JSON.stringify({
    units: units.map((u) => u.map((x) => +x.toFixed(6))),
    levels,                                   // {coarse:[...], fine:[...], (finer:[...])}
    tol, note,
  }));
  const counts = Object.entries(levels).map(([k, v]) => `${k}:${v.length}`).join(' ');
  console.log(`${name.padEnd(26)} T=${String(units.length).padStart(4)} levels{${counts}} -> ${name}`);
};

const DIM = 48, PER = 20, JIT = 0.2;

// two-level: 2 families × a fine plan each (recurrence within a section)
function nested2(name, seed, secPlan, note) {
  const g = rng(seed);
  const fam = axes(DIM, secPlan.length, seed + 1);
  const sub = secPlan.map((_, si) => axes(DIM, 2, seed + 10 + si));
  const units = [], coarse = [], fine = []; let t = 0;
  secPlan.forEach((plan, si) => {
    if (si) coarse.push(t);
    plan.forEach((fi, fj) => {
      if (fj) fine.push(t);
      const fA = fam[si], sA = sub[si][fi];
      for (let n = 0; n < PER; n++) { units.push(fA.map((x, i) => 1.0 * x + 0.5 * sA[i] + JIT * gauss(g))); t++; }
    });
  });
  dump(name, units, { coarse, fine }, 3, note);
}

// three-level: 2 families × 2 mid × 2 fine
function nested3(name, seed) {
  const g = rng(seed);
  const fam = axes(DIM, 2, seed + 1);
  const mid = [axes(DIM, 2, seed + 10), axes(DIM, 2, seed + 20)];
  const fin = [[axes(DIM, 2, seed + 30), axes(DIM, 2, seed + 31)], [axes(DIM, 2, seed + 40), axes(DIM, 2, seed + 41)]];
  const units = [], coarse = [], midB = [], fine = []; let t = 0;
  for (let a = 0; a < 2; a++) {
    if (a) coarse.push(t);
    for (let b = 0; b < 2; b++) {
      if (b) midB.push(t);
      for (let c = 0; c < 2; c++) {
        if (c) fine.push(t);
        const fA = fam[a], mA = mid[a][b], sA = fin[a][b][c];
        for (let n = 0; n < 12; n++) { units.push(fA.map((x, i) => 1.0 * x + 0.55 * mA[i] + 0.3 * sA[i] + JIT * gauss(g))); t++; }
      }
    }
  }
  dump(name, units, { coarse, mid: midB, fine }, 3, 'three holon levels: family ⊃ mid ⊃ fine');
}

nested2('nested_2level_a.json', 100, [[0, 1, 0], [1, 0, 1]], 'two levels: 2 families ⊃ 3 fine sub-blocks (recurrence)');
nested2('nested_2level_b.json', 200, [[1, 0, 1], [0, 1, 0]], 'two levels, different draw');
nested2('nested_3sec.json', 300, [[0, 1], [1, 0], [0, 1]], 'three families ⊃ 2 fine sub-blocks each');
nested3('nested_3level.json', 400);
console.log('nested battery generated.');
