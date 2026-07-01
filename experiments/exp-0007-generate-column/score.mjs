// exp-0007 · the scorer — joins the key-blind measure with the held key.
//
// Checks the three Generate operators:
//   INS — on separable sequential readings, the online reader (birth+merge) matches or
//         beats the batch reader (INS births correctly when the geography is separable);
//   REC — on the short-block transfer, the prior-seeded reader births ZERO readings and
//         its F1 is ≥ the batch reader's (the learned convention recognises, not re-reads);
//   the honest limit — cold online (no prior) does NOT beat REC on the short blocks (INS
//         alone cannot birth in time), which is exactly why REC is the keystone.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const m = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));
const key = JSON.parse(readFileSync(join(HERE, 'key.json')));

function f1(dts, truth, tol) {
  const used = new Array(truth.length).fill(false); let hit = 0;
  for (const d of dts) { let bi = -1, best = tol + 1; for (let i = 0; i < truth.length; i++) if (!used[i] && Math.abs(d - truth[i]) <= best) { best = Math.abs(d - truth[i]); bi = i; } if (bi >= 0) { used[bi] = true; hit++; } }
  const P = dts.length ? hit / dts.length : 1, R = truth.length ? hit / truth.length : 1;
  return (P + R) ? 2 * P * R / (P + R) : 0;
}
const pct = (x) => (100 * x).toFixed(0) + '%';
const F = (row, r) => f1(row[r].bounds, row.boundaries, row.tol);

const seq = m.seq_separable, ts = m.transfer_short, tl = m.transfer_long;
console.log('\nINS (separable sequential readings):');
console.log(`  batch  F1 ${pct(F(seq, 'batch'))} ids=${seq.batch.ids}`);
console.log(`  online F1 ${pct(F(seq, 'cold'))} ids=${seq.cold.ids} born=${seq.cold.born}   (true reads ${seq.reads})`);
console.log('\nREC (transfer — prior learned from A, applied to B):');
for (const [nm, row] of [['short', ts], ['long', tl]]) {
  console.log(`  [${nm} blocks] batch ${pct(F(row, 'batch'))} | cold ${pct(F(row, 'cold'))} born=${row.cold.born} | REC ${pct(F(row, 'rec'))} born=${row.rec.born}`);
}

const insOK = F(seq, 'cold') >= F(seq, 'batch') - 1e-9;
const recBorn0 = ts.rec.born === 0;
const recBeatsBatch = F(ts, 'rec') >= F(ts, 'batch') - 1e-9;
const recBeatsCold = F(ts, 'rec') >= F(ts, 'cold') + key.min_margin;
const checks = [
  ['INS births correctly on separable readings (online ≥ batch)', insOK],
  ['REC recognises the known readings with ZERO births on the short transfer', recBorn0],
  ['REC ≥ batch on the short transfer (the prior is at least as good as re-reading)', recBeatsBatch],
  [`REC beats cold online on the short transfer by >${key.min_margin} (the keystone: INS alone under-births)`, recBeatsCold],
];
console.log('\nkey checks:');
let all = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); all &&= ok; }
console.log(`\nVERDICT: ${all ? 'CONFIRMED — ' + key.verdict_tag : 'REFUTED'}`);
process.exit(all ? 0 : 1);
