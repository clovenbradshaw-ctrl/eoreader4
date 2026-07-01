// exp-0003 · the scorer — joins the key-blind measure with the held key.
//
// For every stream: greedy tolerance-matched boundary F1 for the three readers, the
// abstention check (the flat-geography streams must detect ZERO boundaries), and the
// aggregate dissociation (geo beats both fixed-count rules on the mean). Prints the
// verdict table and asserts the key's predictions so the experiment is falsifiable.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));
const key = JSON.parse(readFileSync(join(HERE, 'key.json')));

function boundaryF1(detected, truth, tol) {
  const used = new Array(truth.length).fill(false); let m = 0;
  for (const d of detected) {
    let bi = -1, best = tol + 1;
    for (let i = 0; i < truth.length; i++) if (!used[i] && Math.abs(d - truth[i]) <= best) { best = Math.abs(d - truth[i]); bi = i; }
    if (bi >= 0) { used[bi] = true; m++; }
  }
  const P = detected.length ? m / detected.length : 1;   // no detection on no-truth = perfect precision
  const R = truth.length ? m / truth.length : 1;
  return (P + R) ? 2 * P * R / (P + R) : 0;
}

const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
const P = (s, n) => String(s).padEnd(n);
console.log('\n' + '='.repeat(104));
console.log(P('STREAM', 26) + P('true#', 6) + P('read#', 6) + P('kGeo', 6) +
            P('F1 mass', 9) + P('F1 null', 9) + P('F1 GEO', 9) + P('abstain?', 10) + 'geo≥both');
console.log('='.repeat(104));

let sM = 0, sN = 0, sG = 0, wins = 0;
const abstainSet = new Set(key.abstain_streams);
let abstainOK = true;
for (const m of measure) {
  const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));   // the HELD key for this stream
  const truth = D.boundaries, tol = D.tol, reads = new Set(D.labels).size;
  const fM = boundaryF1(m.mass.bounds, truth, tol);
  const fN = boundaryF1(m.null.bounds, truth, tol);
  const fG = boundaryF1(m.geo.bounds, truth, tol);
  sM += fM; sN += fN; sG += fG;
  const geoWins = fG >= fM - 1e-9 && fG >= fN - 1e-9; if (geoWins) wins++;
  // abstention: streams the key marks flat must detect zero boundaries
  const shouldAbstain = abstainSet.has(m.name);
  const didAbstain = m.geo.bounds.length === 0;
  if (shouldAbstain && !didAbstain) abstainOK = false;
  console.log(P(m.name, 26) + P(truth.length, 6) + P(reads, 6) + P(m.geo.k, 6) +
              P(pct(fM), 9) + P(pct(fN), 9) + P(pct(fG), 9) +
              P(shouldAbstain ? (didAbstain ? 'yes ✓' : 'yes ✗') : (didAbstain ? '(abst)' : '-'), 10) +
              (geoWins ? '✓' : ' '));
}
console.log('='.repeat(104));
const n = measure.length;
const meanM = sM / n, meanN = sN / n, meanG = sG / n;
console.log(`mean F1:  mass ${pct(meanM)}   null ${pct(meanN)}   GEO ${pct(meanG)}    (GEO wins/ties ${wins}/${n})`);

// ---- falsifiable assertions against the key --------------------------------
const checks = [
  ['GEO mean beats the 90%-mass rule',   meanG > meanM + key.min_margin],
  ['GEO mean beats the void-eigenvalue rule', meanG > meanN + key.min_margin],
  ['every flat-geography stream abstains (0 boundaries)', abstainOK],
];
console.log('\nkey checks:');
let allPass = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); allPass &&= ok; }
console.log(`\nVERDICT: ${allPass ? 'CONFIRMED — ' + key.verdict_tag : 'REFUTED'}`);
process.exit(allPass ? 0 : 1);
