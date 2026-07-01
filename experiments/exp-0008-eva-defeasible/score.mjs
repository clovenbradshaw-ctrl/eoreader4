// exp-0008 · the scorer — joins the key-blind measure with the held `defeats` key.
//
// A reading is correctly defeasible iff: it SURVIVES where it should hold (stationary, a
// transient dip) and is DEFEATED where the world moved past it (sustained drift, a
// replacement). Both directions are the test — a reading that defeats on a blip is as
// wrong as one that never defeats on a drift.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));

console.log('\n' + '='.repeat(78));
console.log('STREAM'.padEnd(14) + 'should defeat'.padEnd(14) + 'defeated?'.padEnd(14) + 'at'.padEnd(6) + 'note');
console.log('='.repeat(78));
let correct = 0;
for (const m of measure) {
  const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));
  const should = D.defeats, did = m.defeatAt >= 0;
  const ok = should === did; if (ok) correct++;
  console.log(m.name.padEnd(14) + String(should).padEnd(14) + `${did} ${ok ? '✓' : '✗'}`.padEnd(14) + String(m.defeatAt >= 0 ? m.defeatAt : '-').padEnd(6) + m.note);
}
console.log('='.repeat(78));
const all = correct === measure.length;
console.log(`\n${correct}/${measure.length} streams correctly {survive | defeat}`);
console.log(`VERDICT: ${all ? 'CONFIRMED — EVA is two-directional: reinforce holds, sustained strain defeats, transients are forgiven' : 'REFUTED'}`);
process.exit(all ? 0 : 1);
