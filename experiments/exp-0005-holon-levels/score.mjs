// exp-0005 · the scorer — joins the key-blind measure with the held per-level key.
//
// Per stream: boundary F1 of the squared-single, signed-single, and recursive-holon
// readers against (a) the coarse level, (b) the union of the FINER levels, and (c) all
// levels at once. Then the key checks:
//   1. signed single beats squared single on the mean (sign-aware assignment resolves
//      the balanced splits the squared rule collapses);
//   2. the recursive holon reader beats signed-single on ALL-levels F1 (descending
//      recovers the finer levels a single global read collapses);
//   3. the recursive reader recovers the finer level specifically (finer-F1 lifts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));
const key = JSON.parse(readFileSync(join(HERE, 'key.json')));

function f1(dts, truth, tol) {
  const used = new Array(truth.length).fill(false); let m = 0;
  for (const d of dts) { let bi = -1, best = tol + 1; for (let i = 0; i < truth.length; i++) if (!used[i] && Math.abs(d - truth[i]) <= best) { best = Math.abs(d - truth[i]); bi = i; } if (bi >= 0) { used[bi] = true; m++; } }
  const P = dts.length ? m / dts.length : 1, R = truth.length ? m / truth.length : 1;
  return (P + R) ? 2 * P * R / (P + R) : 0;
}
const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
const P = (s, n) => String(s).padEnd(n);

console.log('\n' + '='.repeat(100));
console.log(P('STREAM', 20) + P('levels', 22) +
            P('sq all', 8) + P('sg all', 8) + P('HOLON all', 11) + P('coarse→holon', 14) + 'finer→holon');
console.log('='.repeat(100));
let sSq = 0, sSg = 0, sHo = 0, sSgFine = 0, sHoFine = 0;
for (const m of measure) {
  const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));
  const tol = D.tol, L = D.levels;
  const coarse = L.coarse || [];
  const finer = [].concat(L.mid || [], L.fine || [], L.finer || []).sort((a, b) => a - b);
  const all = [].concat(...Object.values(L)).sort((a, b) => a - b);
  const fSq = f1(m.sq_single, all, tol), fSg = f1(m.sg_single, all, tol), fHo = f1(m.holon_all, all, tol);
  const holCoarse = f1(m.holon_byLevel['0'] || [], coarse, tol);
  const sgFine = f1(m.sg_single, finer, tol);
  const holFine = f1(m.holon_all, finer, tol);
  sSq += fSq; sSg += fSg; sHo += fHo; sSgFine += sgFine; sHoFine += holFine;
  console.log(P(m.name, 20) + P(Object.entries(L).map(([k, v]) => `${k}:${v.length}`).join(' '), 22) +
              P(pct(fSq), 8) + P(pct(fSg), 8) + P(pct(fHo), 11) + P(pct(holCoarse), 14) + `${pct(sgFine)}→${pct(holFine)}`);
}
console.log('='.repeat(100));
const n = measure.length;
console.log(`mean ALL-levels F1:  squared-single ${pct(sSq / n)}   signed-single ${pct(sSg / n)}   recursive-holon ${pct(sHo / n)}`);
console.log(`mean FINER-level F1:  signed-single ${pct(sSgFine / n)}   recursive-holon ${pct(sHoFine / n)}`);

const checks = [
  [`signed-single beats squared-single (+${key.min_margin})`, sSg / n > sSq / n + key.min_margin],
  [`recursive-holon beats signed-single on all-levels (+${key.min_margin})`, sHo / n > sSg / n + key.min_margin],
  ['recursive-holon recovers the finer level a single read collapses', sHoFine / n > sSgFine / n + key.min_margin],
];
console.log('\nkey checks:');
let allok = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); allok &&= ok; }
console.log(`\nVERDICT: ${allok ? 'CONFIRMED — ' + key.verdict_tag : 'REFUTED'}`);
process.exit(allok ? 0 : 1);
