// exp-0004 · ATMOSPHERE + PARADIGM change-point — KEY-BLIND.
//
// Reuses the exp-0003 battery (units only). For each stream it runs FOUR readers and
// emits the detected boundaries of each:
//   lens  — lens-switching with the geography count (exp-0003 baseline).
//   atmo  — atmosphere: peaks of S(ρ_L ‖ ρ_R), the local density DEPARTURE (relEntropy).
//   para  — paradigm: peaks of ‖[ρ_L, ρ_R]‖_F, the local INCOMMENSURABILITY (commutator).
//   gated — the abstention-gated UNION of the three; when readingCount abstains (flat
//           geography) no channel may fire, so the flat streams stay clean.
// Atmosphere/paradigm run in the top-M reading subspace over a window ~5% of the stream,
// and their peaks are picked by voidPeaks (the bounded-void change-point detector).
// The scorer joins these detections with the held key.
import { buildDensity, eigenLenses, relEntropy, commutator, readingCount, voidPeaks } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, '..', 'exp-0003-omnimodal-sense', 'battery');

const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const det = (arr) => arr.map((x, i) => (i && x !== arr[i - 1]) ? i : -1).filter((i) => i > 0);
const medianFilter = (a, w) => a.map((_, i) => {
  const lo = Math.max(0, i - (w >> 1)), hi = Math.min(a.length, i + (w >> 1) + 1);
  const seg = a.slice(lo, hi); const cnt = {}; let best = seg[0], bc = 0;
  for (const x of seg) { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > bc) { bc = cnt[x]; best = x; } }
  return best;
});
function centeredDirs(units) {
  const D = units[0].length, T = units.length;
  const mean = new Array(D).fill(0);
  for (const u of units) for (let i = 0; i < D; i++) mean[i] += u[i] / T;
  return units.map((u) => { const c = u.map((x, i) => x - mean[i]); const n = norm(c); return n > 1e-9 ? c.map((x) => x / n) : c.map(() => 0); });
}
function lensSwitch(dirs, lenses, k) {
  if (k <= 1) return [];
  const top = lenses.slice(0, k);
  const a = dirs.map((u) => { let bi = 0, best = -1; for (let i = 0; i < top.length; i++) { const c = dot(u, top[i].lens); if (c * c > best) { best = c * c; bi = i; } } return bi; });
  return det(medianFilter(a, 5));
}
// windowed change-point scores in the top-M reading subspace
function channelScores(dirs, lenses, M, W) {
  const T = dirs.length;
  const lens = lenses.slice(0, M).map((l) => l.lens);
  const coord = dirs.map((u) => lens.map((L) => dot(u, L)));
  const dens = (lo, hi) => buildDensity(coord.slice(lo, hi)).rho;
  const atmo = [], para = [], idx = [];
  for (let b = W; b <= T - W; b++) {
    const rL = dens(b - W, b), rR = dens(b, b + W);
    atmo.push(0.5 * (relEntropy(rL, rR) + relEntropy(rR, rL)));
    para.push(commutator(rL, rR));
    idx.push(b);
  }
  return { atmo, para, idx };
}
const mergeWithin = (arr, r) => { const s = arr.slice().sort((a, b) => a - b), out = []; for (const x of s) if (!out.length || x - out[out.length - 1] > r) out.push(x); return out; };

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));   // ← reads D.units ONLY
  const dirs = centeredDirs(D.units);
  const lenses = eigenLenses(buildDensity(dirs).rho);
  const rc = readingCount(lenses.map((l) => l.weight));
  const M = Math.max(4, Math.min(12, 2 * rc.k));
  const W = Math.max(4, Math.round(D.units.length / 20));
  const bLens = lensSwitch(dirs, lenses, rc.k);
  const { atmo, para, idx } = channelScores(dirs, lenses, M, W);
  const bAtmo = voidPeaks(atmo, { alpha: 0.05, tol: D.tol, indices: idx });
  const bPara = voidPeaks(para, { alpha: 0.05, tol: D.tol, indices: idx });
  const union = mergeWithin([...bLens, ...bAtmo, ...bPara], D.tol);
  const gated = rc.abstain ? [] : union;
  out.push({ name: f.replace('.json', ''), modality: D.modality, T: D.units.length,
    k: rc.k, abstain: rc.abstain, W, M,
    lens: bLens, atmo: bAtmo, para: bPara, gated });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log(`measured ${out.length} streams (key-blind) → measure_out.json`);
