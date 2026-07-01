// exp-0009 · the NUL measure — KEY-BLIND on the units.
//
// Two readers, identical but for the third response to a NOVEL unit (one REC returns −1 on):
//   force — lift it anyway, into the NEAREST standing reading (SIG). No hold. A false
//           opinion that drags that reading's lens off true.
//   nul   — HOLD it (NUL): append to a lossless reserve, no opinion, leaving the standing
//           readings untouched. When the reserve coheres (DEF finds a reading in it), lift
//           it (INS) as a fresh reading.
// Both share INS/SYN otherwise. The scorer joins the held true directions and measures how
// clean each reader's readings stayed, and whether the novel group was recovered.
import { buildDensity, eigenLenses, DEF, SIG, REC, NUL } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const unit = (v) => { const n = norm(v) || 1; return v.map((x) => x / n); };
const centroid = (arr) => { const c = new Array(arr[0].length).fill(0); for (const u of arr) { const s = dot(u, arr[0]) >= 0 ? 1 : -1; for (let i = 0; i < c.length; i++) c[i] += s * u[i]; } return unit(c); };

function read(dirs, { mode }) {
  const D = dirs[0].length, floor = (N) => { const mu = 1 / D, sd = Math.sqrt(2) / D; return mu + 2.5 * sd; };
  const readings = []; let reserve = []; let held = 0, born = 0;
  const merge = (r, u) => { const sgn = dot(u, r.lens) >= 0 ? 1 : -1, bl = 1 / (r.w + 1); for (let i = 0; i < D; i++) r.lens[i] = (1 - bl) * r.lens[i] + bl * sgn * u[i]; r.lens = unit(r.lens); r.w++; };
  for (const u of dirs) {
    const idx = readings.length ? REC(u, readings, { floor: floor() }) : -1;
    if (idx >= 0) { merge(readings[idx], u); continue; }
    if (mode === 'force' && readings.length) {          // FORCE into the nearest standing reading
      merge(readings[SIG(u, readings)], u); continue;
    }
    // NUL: hold in the reserve (no opinion); INS-lift once it coheres
    reserve = NUL(reserve, u); held++;
    if (reserve.length >= 5) {
      const rho = buildDensity(reserve.map(unit)).rho;
      const rc = DEF(eigenLenses(rho).map((l) => l.weight));
      if (!rc.abstain || reserve.length >= 8) { readings.push({ lens: centroid(reserve.map(unit)), w: reserve.length }); born++; reserve = []; }
    }
  }
  if (reserve.length) { readings.push({ lens: centroid(reserve.map(unit)), w: reserve.length }); born++; }
  return { readings, held, born };
}
// how cleanly did the reader keep a reading for each true direction? (max cos² over readings)
const fidelity = (readings, trueDir) => Math.max(0, ...readings.map((r) => dot(unit(trueDir), r.lens) ** 2));

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));   // ← reads units ONLY
  const dirs = D.units.map(unit);
  const force = read(dirs, { mode: 'force' });
  const nul = read(dirs, { mode: 'nul' });
  out.push({ name: f.replace('.json', ''),
    force: { readings: force.readings.length, held: force.held }, nul: { readings: nul.readings.length, held: nul.held },
    // fidelities filled by scorer from the key; keep the reader lenses for it
    forceLenses: force.readings.map((r) => r.lens), nulLenses: nul.readings.map((r) => r.lens) });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out));
console.log(`measured ${out.length} NUL streams (key-blind) → measure_out.json`);
