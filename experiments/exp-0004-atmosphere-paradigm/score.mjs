// exp-0004 · the scorer — joins the key-blind measure with the held key.
//
// Per stream: boundary F1 for lens / atmo / para / gated-union. Then the key checks:
//   1. the abstention-gated union beats lens-switching on the mean (the passes help);
//   2. atmosphere cracks the near-degenerate multiplicity lens cannot (two_balls);
//   3. paradigm cracks the adjacent-recurrence A|A boundary lens cannot;
//   4. the gate keeps every flat-geography stream clean (zero boundaries).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, '..', 'exp-0003-omnimodal-sense', 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));
const key = JSON.parse(readFileSync(join(HERE, 'key.json')));

function boundaryF1(detected, truth, tol) {
  const used = new Array(truth.length).fill(false); let m = 0;
  for (const d of detected) {
    let bi = -1, best = tol + 1;
    for (let i = 0; i < truth.length; i++) if (!used[i] && Math.abs(d - truth[i]) <= best) { best = Math.abs(d - truth[i]); bi = i; }
    if (bi >= 0) { used[bi] = true; m++; }
  }
  const P = detected.length ? m / detected.length : 1;
  const R = truth.length ? m / truth.length : 1;
  return (P + R) ? 2 * P * R / (P + R) : 0;
}
const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
const P = (s, n) => String(s).padEnd(n);

console.log('\n' + '='.repeat(96));
console.log(P('STREAM', 26) + P('true#', 6) + P('F1 lens', 9) + P('F1 atmo', 9) + P('F1 para', 9) + P('F1 GATED', 10) + 'gated≥lens');
console.log('='.repeat(96));
let sL = 0, sA = 0, sP = 0, sG = 0;
const F = {};
for (const m of measure) {
  const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));
  const truth = D.boundaries, tol = D.tol;
  const fL = boundaryF1(m.lens, truth, tol), fA = boundaryF1(m.atmo, truth, tol),
        fP = boundaryF1(m.para, truth, tol), fG = boundaryF1(m.gated, truth, tol);
  F[m.name] = { fL, fA, fP, fG, gatedBounds: m.gated.length, abstain: m.abstain };
  sL += fL; sA += fA; sP += fP; sG += fG;
  console.log(P(m.name, 26) + P(truth.length, 6) + P(pct(fL), 9) + P(pct(fA), 9) + P(pct(fP), 9) + P(pct(fG), 10) +
              (fG >= fL - 1e-9 ? '✓' : ''));
}
console.log('='.repeat(96));
const n = measure.length;
const meanL = sL / n, meanG = sG / n;
console.log(`mean F1:  lens ${pct(meanL)}   atmo ${pct(sA / n)}   para ${pct(sP / n)}   GATED-UNION ${pct(meanG)}`);

// ---- falsifiable checks against the key ------------------------------------
const abstainClean = key.abstain_streams.every((s) => F[s] && F[s].gatedBounds === 0);
const atmoCracks = F[key.atmosphere_cracks].fA > 0 && F[key.atmosphere_cracks].fL === 0;
const paraCracks = F[key.paradigm_cracks].fP > 0 && F[key.paradigm_cracks].fL === 0;
const checks = [
  [`gated-union mean beats lens-switching (+${key.min_margin})`, meanG > meanL + key.min_margin],
  [`atmosphere cracks ${key.atmosphere_cracks} (lens=0)`, atmoCracks],
  [`paradigm cracks ${key.paradigm_cracks} (lens=0)`, paraCracks],
  ['the gate keeps every flat-geography stream clean', abstainClean],
];
console.log('\nkey checks:');
let all = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); all &&= ok; }
console.log(`\nVERDICT: ${all ? 'CONFIRMED — ' + key.verdict_tag : 'REFUTED'}`);
process.exit(all ? 0 : 1);
