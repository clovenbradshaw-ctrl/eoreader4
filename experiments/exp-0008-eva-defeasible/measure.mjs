// exp-0008 · the EVA measure — KEY-BLIND on the units.
//
// For each stream: seed a reading from the opening `window` (a firm convention), set the
// membership `expect` from how well the opening fits itself (self-calibrated), then fold
// every unit's fit into the reading's ledger with `EVA`. Emit whether/when the
// reading was defeated. The scorer joins the held `defeats` flag.
import { EVA } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));   // ← reads units + window ONLY
  const units = D.units, W = D.window;
  // seed the reading = normalized centroid of the opening window
  const seed = new Array(units[0].length).fill(0);
  for (let t = 0; t < W; t++) for (let i = 0; i < seed.length; i++) seed[i] += units[t][i] / W;
  const sn = norm(seed) || 1; for (let i = 0; i < seed.length; i++) seed[i] /= sn;
  // expect = a fraction of the opening's self-fit (self-calibrated membership)
  let selfFit = 0; for (let t = 0; t < W; t++) { const c = dot(units[t], seed); selfFit += c * c / W; }
  const expect = 0.45 * selfFit;
  // fold each unit's fit; record the first defeat
  let ledger = { support: 0, strain: 0 }, defeatAt = -1;
  const fits = [];
  for (let t = 0; t < units.length; t++) {
    const c = dot(units[t], seed), fit = c * c; fits.push(+fit.toFixed(3));
    ledger = EVA(ledger, fit, { gamma: 0.9, expect, minEvidence: 0.8 });
    if (ledger.defeated && defeatAt < 0) defeatAt = t;
  }
  out.push({ name: f.replace('.json', ''), note: D.note, expect: +expect.toFixed(3), defeatAt, fits });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log(`measured ${out.length} EVA streams (key-blind) → measure_out.json`);
