// exp-0005 · the RECURSIVE HOLON reader — KEY-BLIND.
//
// Reads each nested stream (units only) three ways and emits the boundaries of each:
//   sq_single  — one global read, squared Born assignment (the sign-blind baseline).
//   sg_single  — one global read, SIGNED Born assignment (bornAssign signed).
//   holon      — the recursive reader: read at this scale, then descend into each
//                segment with LOCAL re-centering (so the segment's own family becomes
//                the common mode and the finer readings surface), re-deriving the void
//                (readingCount) at each level and HALTING where it abstains — "this
//                holon is whole." Boundaries are tagged by the level that found them.
// The scorer joins these with the held per-level key.
import { buildDensity, eigenLenses, readingCount, bornAssign } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');

const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const det = (arr) => arr.map((x, i) => (i && x !== arr[i - 1]) ? i : -1).filter((i) => i > 0);
const mf = (a, w) => a.map((_, i) => {
  const lo = Math.max(0, i - (w >> 1)), hi = Math.min(a.length, i + (w >> 1) + 1);
  const seg = a.slice(lo, hi); const cnt = {}; let best = seg[0], bc = 0;
  for (const x of seg) { cnt[x] = (cnt[x] || 0) + 1; if (cnt[x] > bc) { bc = cnt[x]; best = x; } }
  return best;
});
const nms = (bs, tol) => {
  const s = [...bs].sort((a, b) => a - b), out = []; let grp = [];
  for (const x of s) { if (grp.length && x - grp[grp.length - 1] > tol) { out.push(Math.round(grp.reduce((a, b) => a + b, 0) / grp.length)); grp = []; } grp.push(x); }
  if (grp.length) out.push(Math.round(grp.reduce((a, b) => a + b, 0) / grp.length));
  return out;
};
// LOCAL centering — remove THIS scale's common mode, so a descent exposes finer readings
function centeredDirs(U) {
  const D = U[0].length, T = U.length, m = new Array(D).fill(0);
  for (const u of U) for (let i = 0; i < D; i++) m[i] += u[i] / T;
  return U.map((u) => { const c = u.map((x, i) => x - m[i]); const n = norm(c); return n > 1e-9 ? c.map((x) => x / n) : c.map(() => 0); });
}
// one read at one scale → its boundaries (or abstain)
function segMap(U, tol, signed) {
  const dirs = centeredDirs(U);
  const lenses = eigenLenses(buildDensity(dirs).rho);
  const rc = readingCount(lenses.map((l) => l.weight));
  if (rc.k <= 1) return { bounds: [], abstain: true };
  const top = lenses.slice(0, rc.k);
  const assign = dirs.map((u) => bornAssign(u, top, { signed }));
  return { bounds: nms(det(mf(assign, 5)), tol), abstain: false };
}
// the recursive holon reader: descend with local re-centering, halt on abstention
function holons(U, tol, off = 0, depth = 0, maxDepth = 2, minSeg = 16) {
  const { bounds, abstain } = segMap(U, tol, true);
  let out = bounds.map((b) => ({ pos: b + off, level: depth }));
  if (depth < maxDepth && !abstain) {
    const cuts = [0, ...bounds, U.length];
    for (let i = 0; i < cuts.length - 1; i++) {
      const s = cuts[i], e = cuts[i + 1];
      if (e - s >= minSeg) out = out.concat(holons(U.slice(s, e), tol, off + s, depth + 1, maxDepth, minSeg));
    }
  }
  return out;
}

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));   // ← reads D.units ONLY
  const tol = D.tol;
  const sq = nms(segMap(D.units, tol, false).bounds, tol);
  const sg = nms(segMap(D.units, tol, true).bounds, tol);
  const h = holons(D.units, tol);
  const byLevel = {};
  for (const { pos, level } of h) (byLevel[level] ||= []).push(pos);
  for (const k of Object.keys(byLevel)) byLevel[k] = nms(byLevel[k], tol);
  out.push({ name: f.replace('.json', ''), note: D.note, T: D.units.length,
    sq_single: sq, sg_single: sg,
    holon_all: nms(h.map((x) => x.pos), tol), holon_byLevel: byLevel });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log(`measured ${out.length} nested streams (key-blind) → measure_out.json`);
