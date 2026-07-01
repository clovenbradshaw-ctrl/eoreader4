// exp-0007 · the GENERATE-column measure — KEY-BLIND on the units.
//
// Three readers, all sharing the Born rule; only the GENERATE behaviour differs:
//   batch  — readingCount + bornAssign over global lenses (exp-0003/0005, no online birth).
//   cold   — online INS+SYN: one forward pass, `recognize` each unit against the standing
//            readings; −1 (novel) buffers toward an INS birth (a debounced centroid);
//            a match is a SYN merge into that reading's identity. Starts empty.
//   rec    — the SAME online reader, but SEEDED with a prior reading set (REC) learned
//            (batch) from a paired stream. Known readings are recognised, not re-born.
// The scorer joins boundaries with the held key and reads born counts.
import { buildDensity, eigenLenses, readingCount, bornAssign, recognize, extremeValueZ } from '../../src/core/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const det = (arr) => arr.map((x, i) => (i && x !== arr[i - 1]) ? i : -1).filter((i) => i > 0);
const mf = (a, w) => a.map((_, i) => { const lo = Math.max(0, i - (w >> 1)), hi = Math.min(a.length, i + (w >> 1) + 1); const seg = a.slice(lo, hi); const c = {}; let b = seg[0], bc = 0; for (const x of seg) { c[x] = (c[x] || 0) + 1; if (c[x] > bc) { bc = c[x]; b = x; } } return b; });
function cdirs(U) { const D = U[0].length, T = U.length, m = new Array(D).fill(0); for (const u of U) for (let i = 0; i < D; i++) m[i] += u[i] / T; return U.map((u) => { const c = u.map((x, i) => x - m[i]); const n = norm(c); return n > 1e-9 ? c.map((x) => x / n) : c.map(() => 0); }); }
const load = (name) => { const D = JSON.parse(readFileSync(join(BATTERY, name))); return { D, dirs: cdirs(D.units) }; };

// BATCH: global lenses + signed Born; also returns the lenses (the REC prior to carry)
function batch(dirs) {
  const L = eigenLenses(buildDensity(dirs).rho); const rc = readingCount(L.map((l) => l.weight));
  if (rc.k <= 1) return { bounds: [], ids: 1, prior: [] };
  const top = L.slice(0, rc.k);
  const sm = mf(dirs.map((u) => bornAssign(u, top, { signed: true })), 5);
  return { bounds: det(sm), ids: new Set(sm).size, prior: top };
}
// ONLINE INS+SYN, optionally REC-seeded with a prior reading set
function online(dirs, { alpha = 0.02, run = 4, prior = null } = {}) {
  const D = dirs[0].length;
  const floor = (N) => { const mu = 1 / D, sd = Math.sqrt(2) / D; return mu + extremeValueZ(N, alpha) * sd; }; // chance ceiling on the SQUARED overlap (E[cos²]=1/D)
  const readings = prior ? prior.map((l, i) => ({ lens: (l.lens || l).slice(), w: 8, id: i })) : [];
  let nextId = readings.length; const assign = []; let buf = []; let born = 0;
  for (const u of dirs) {
    if (norm(u) < 1e-9) { assign.push(assign.length ? assign[assign.length - 1] : -1); continue; }
    const idx = recognize(u, readings, { floor: floor(readings.length + 1) });   // ← the GENERATE branch point
    if (idx >= 0) {                                   // SYN: merge into the returning identity
      const r = readings[idx], sgn = dot(u, r.lens) >= 0 ? 1 : -1, bl = 1 / (r.w + 1);
      for (let i = 0; i < D; i++) r.lens[i] = (1 - bl) * r.lens[i] + bl * sgn * u[i];
      const nn = norm(r.lens) || 1; for (let i = 0; i < D; i++) r.lens[i] /= nn; r.w++;
      assign.push(r.id); buf = [];
    } else {                                          // INS: novel — buffer, birth a centroid after a run
      buf.push(u);
      if (buf.length >= run) { const c = new Array(D).fill(0); for (const b of buf) { const s = dot(b, buf[0]) >= 0 ? 1 : -1; for (let i = 0; i < D; i++) c[i] += s * b[i]; } const nn = norm(c) || 1; readings.push({ lens: c.map((x) => x / nn), w: buf.length, id: nextId++ }); born++; assign.push(readings[readings.length - 1].id); buf = []; }
      else assign.push(assign.length ? assign[assign.length - 1] : -1);
    }
  }
  const sm = mf(assign, 5);
  return { bounds: det(sm), ids: new Set(sm.filter((x) => x >= 0)).size, born };
}

const out = {};
// INS regime: separable sequential readings — online should match/beat batch
{
  const { D, dirs } = load('seq_separable.json');
  out.seq_separable = { boundaries: D.boundaries, tol: D.tol, reads: new Set(D.labels).size, batch: batch(dirs), cold: online(dirs) };
}
// REC regime: learn prior from A, read B cold vs seeded
for (const size of ['short', 'long']) {
  const A = load(`transfer_${size}_A.json`), B = load(`transfer_${size}_B.json`);
  const prior = batch(A.dirs).prior;
  out[`transfer_${size}`] = {
    boundaries: B.D.boundaries, tol: B.D.tol, reads: new Set(B.D.labels).size,
    batch: batch(B.dirs), cold: online(B.dirs), rec: online(B.dirs, { prior }),
  };
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log('measured the generate column (key-blind) → measure_out.json');
