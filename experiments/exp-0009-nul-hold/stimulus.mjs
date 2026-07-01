// exp-0009 · NUL — the hold that keeps a reading clean.
//
// The reader has three responses to a unit: LIFT it into a reading (SIG/SYN/INS), assert
// it VOID (DEF to VOID), or HOLD it (NUL) — untouched, no opinion. The last is what an
// honest reader owes an ambiguous or emerging unit: neither force it into the nearest
// standing reading (a false opinion that corrupts that reading) nor drop it (lossy).
//
// Stimulus: two established readings A, B, then a block of a NOVEL third group C
// (orthogonal to both), then A and B RETURN. A forcing reader must assign C to the nearest
// of A/B, dragging that reading's lens off true; when A/B return they no longer fit. A NUL
// reader HOLDS the C units (no opinion), keeps A/B clean, and later lifts the cohered
// reserve into a fresh reading. Deterministic (seeded PRNG, no deps).
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
const D = 40;
function orthonormal(k, seed) {
  const r = rng(seed), A = [];
  for (let c = 0; c < k; c++) { let v = Array.from({ length: D }, () => gauss(r)); for (const u of A) { const p = dot(v, u); v = v.map((x, i) => x - p * u[i]); } const n = norm(v); A.push(v.map((x) => x / n)); }
  return A;
}
const [A, B, C] = orthonormal(3, 1);
const noisy = (dir, r) => { const v = dir.map((x) => x + 0.15 * gauss(r)); const n = norm(v); return v.map((x) => x / n); };

const g = rng(9);
const plan = [[A, 20], [B, 20], [C, 15], [A, 20], [B, 20]];   // A B C A B — C novel, A/B return
const units = [], bounds = []; let t = 0;
for (const [dir, n] of plan) { if (t) bounds.push(t); for (let k = 0; k < n; k++) { units.push(noisy(dir, g)); t++; } }
// held key: the true reading directions and the region that must be HELD (the C block)
writeFileSync(join(OUT, 'return.json'), JSON.stringify({
  units: units.map((u) => u.map((x) => +x.toFixed(5))),
  key: { trueA: A.map((x) => +x.toFixed(5)), trueB: B.map((x) => +x.toFixed(5)), trueC: C.map((x) => +x.toFixed(5)),
    novelRange: [40, 55], returnRanges: { A: [55, 75], B: [75, 95] } },
  tol: 3,
}));
console.log(`return.json  T=${units.length}  A B C A B (C novel at 40..55, A/B return)`);
console.log('NUL battery generated.');
