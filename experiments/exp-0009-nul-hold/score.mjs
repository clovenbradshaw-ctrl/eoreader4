// exp-0009 · the scorer — joins the key-blind measure with the held true directions.
//
// NUL keeps the standing readings CLEAN: an ambiguous/novel unit is held (no opinion), so
// A and B stay true and the novel C is recovered as its own reading. The forcing reader,
// with no NUL, drags a reading off true to absorb C — A and B degrade and C is lost.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));

const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const unit = (v) => { const n = norm(v) || 1; return v.map((x) => x / n); };
const fidelity = (lenses, trueDir) => Math.max(0, ...lenses.map((l) => dot(unit(trueDir), l) ** 2));
const pct = (x) => (100 * x).toFixed(0) + '%';

const m = measure[0];                                    // one stream: return.json
const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));
const { trueA, trueB, trueC } = D.key;

const fA = { force: fidelity(m.forceLenses, trueA), nul: fidelity(m.nulLenses, trueA) };
const fB = { force: fidelity(m.forceLenses, trueB), nul: fidelity(m.nulLenses, trueB) };
const fC = { force: fidelity(m.forceLenses, trueC), nul: fidelity(m.nulLenses, trueC) };

console.log('\n            reading fidelity (max cos² of a reading to the true direction)');
console.log('             A        B        C(novel)   held   readings');
console.log(`  force    ${pct(fA.force).padStart(4)}    ${pct(fB.force).padStart(4)}    ${pct(fC.force).padStart(4)}       ${String(m.force.held).padStart(3)}     ${m.force.readings}`);
console.log(`  NUL      ${pct(fA.nul).padStart(4)}    ${pct(fB.nul).padStart(4)}    ${pct(fC.nul).padStart(4)}       ${String(m.nul.held).padStart(3)}     ${m.nul.readings}`);

const checks = [
  ['NUL keeps A and B cleaner than forcing (both fidelities higher)', fA.nul > fA.force + 0.05 && fB.nul > fB.force + 0.05],
  ['NUL recovers the novel C as its own reading; forcing loses it', fC.nul > 0.5 && fC.nul > fC.force + 0.2],
  ['NUL holds the uncohered (a larger reserve) and keeps A/B/C as distinct readings; forcing collapses them', m.nul.held > m.force.held && m.nul.readings >= 3 && m.force.readings < m.nul.readings],
];
console.log('\nkey checks:');
let all = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); all &&= ok; }
console.log(`\nVERDICT: ${all ? 'CONFIRMED — NUL holds the uncohered without corrupting the reading; the hold is lossless and recoverable' : 'REFUTED'}`);
process.exit(all ? 0 : 1);
