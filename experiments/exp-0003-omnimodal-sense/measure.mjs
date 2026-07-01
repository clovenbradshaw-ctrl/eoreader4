// exp-0003 · the OMNIMODAL SENSE measure — KEY-BLIND.
//
// Reads only each stream's `units` (never its boundaries/labels/tol). For every
// stream it runs the REAL engine three ways and emits the detected boundaries of each:
//   geo  — reading count from DEF (the void over the eigengap spectrum).
//   mass — the incumbent harness rule: top lenses to 90% Born mass, cap 12.
//   null — eigenvalues above the void floor (deriveNull on the eigenvalues).
// Everything else is held identical: centered directions (common-mode removed),
// salience-blind Born assignment to the top-k lenses, median smoothing width 5,
// boundary = assignment switch. The ONLY variable across the three is the count.
// The Born assignment is the universal invariant; only the count policy differs.
//
// The scorer (score.mjs) joins these detections with the held key and computes F1.
import { buildDensity, eigenLenses, DEF, deriveNull } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');

const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const det = (arr) => arr.map((x, i) => (i && x !== arr[i - 1]) ? i : -1).filter((i) => i > 0);
const medianFilter = (a, w) => a.map((_, i) => {
  const lo = Math.max(0, i - (w >> 1)), hi = Math.min(a.length, i + (w >> 1) + 1);
  const seg = a.slice(lo, hi); const cnt = {}; let best = seg[0], bc = 0;
  for (const x of seg) { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > bc) { bc = cnt[x]; best = x; } }
  return best;
});

// centered unit directions — remove the per-dim common mode, then normalise.
function centeredDirs(units) {
  const D = units[0].length, T = units.length;
  const mean = new Array(D).fill(0);
  for (const u of units) for (let i = 0; i < D; i++) mean[i] += u[i] / T;
  return units.map((u) => { const c = u.map((x, i) => x - mean[i]); const n = norm(c); return n > 1e-9 ? c.map((x) => x / n) : c.map(() => 0); });
}
// Born assignment to the top-k eigenlenses, then boundaries = smoothed switches.
function boundariesFor(dirs, lenses, k) {
  if (k <= 1) return [];                       // one reading → no internal boundary (abstain)
  const top = lenses.slice(0, k);
  const assign = dirs.map((u) => { let bi = 0, best = -1; for (let i = 0; i < top.length; i++) { const c = dot(u, top[i].lens); if (c * c > best) { best = c * c; bi = i; } } return bi; });
  return det(medianFilter(assign, 5));
}
function kMass(ev) { let cum = 0, tot = ev.filter((x) => x > 0).reduce((a, b) => a + b, 0) || 1, K = 0; while (K < ev.length && cum < 0.9 * tot && K < 12) { cum += Math.max(0, ev[K]); K++; } return Math.max(1, K); }
function kNull(ev) { const pos = ev.filter((x) => x > 0); const f = deriveNull(pos, { scale: 'linear', alpha: 0.05, N: pos.length }); return !Number.isFinite(f) ? 1 : Math.max(1, ev.filter((x) => x > f).length); }

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));
  const dirs = centeredDirs(D.units);            // ← uses D.units ONLY
  const lenses = eigenLenses(buildDensity(dirs).rho);
  const ev = lenses.map((l) => l.weight);
  const rc = DEF(ev);
  out.push({
    name: f.replace('.json', ''), modality: D.modality, note: D.note, T: D.units.length, dim: D.dim,
    geo: { k: rc.k, abstain: rc.abstain, bounds: boundariesFor(dirs, lenses, rc.k) },
    mass: { k: kMass(ev), bounds: boundariesFor(dirs, lenses, kMass(ev)) },
    null: { k: kNull(ev), bounds: boundariesFor(dirs, lenses, kNull(ev)) },
  });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log(`measured ${out.length} streams (key-blind) → measure_out.json`);
