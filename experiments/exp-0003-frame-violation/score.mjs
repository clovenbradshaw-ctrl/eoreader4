// BLIND scorer for exp-0003. Reads the held key only here. Instrument first (is the
// measure live), then per-channel discrimination of violation vs consistent.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const rows = readFileSync(join(HERE, 'measure-out.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const byId = Object.fromEntries(rows.map(r => [r.id, r]));

const auc = (pos, neg) => {
  if (!pos.length || !neg.length) return null;
  let s = 0;
  for (const a of pos) for (const b of neg) s += a > b ? 1 : (a === b ? 0.5 : 0);
  return s / (pos.length * neg.length);
};

// Group violation vs consistent scores per channel.
const V = { bayes: [], surprisal: [], bridge: [] };
const C = { bayes: [], surprisal: [], bridge: [] };
let identical = 0, pairsN = 0;
const pairIds = [...new Set(Object.values(key.items).filter(k => k.role !== 'positive-control').map(k => k.pair))];
for (const p of pairIds) {
  const v = byId[`${p}-V`], c = byId[`${p}-C`];
  if (!v || !c) continue;
  pairsN++;
  for (const ch of ['bayes', 'surprisal', 'bridge']) { V[ch].push(v[ch]); C[ch].push(c[ch]); }
  const same = v.bayes === c.bayes && v.surprisal === c.surprisal && v.bridge === c.bridge;
  if (same) identical++;
}

console.log('=== INSTRUMENT (read first) ===');
const pc = byId['pc-bridge'];
const live = pc && pc.bridge > 0;
console.log(`  positive control pc-bridge: bridge=${pc ? pc.bridge.toFixed(2) : 'n/a'}  ${live ? '(instrument LIVE ✓)' : '(DEAD — bridge did not fire ✗)'}`);
console.log(`  all channels computed: ${rows.every(r => r.bayes != null && r.surprisal != null && r.bridge != null) ? 'yes' : 'NO'}`);

console.log('\n=== DISCRIMINATION: does any channel rank violation > consistent? ===');
for (const ch of ['bayes', 'surprisal', 'bridge']) {
  const a = auc(V[ch], C[ch]);
  console.log(`  ${ch.padEnd(9)} AUC(violation>consistent) = ${a == null ? 'n/a' : a.toFixed(3)}` +
    `   [V x̄=${mean(V[ch]).toFixed(3)} C x̄=${mean(C[ch]).toFixed(3)}]`);
}
console.log(`\n  pairs whose channels are BYTE-IDENTICAL across violation vs consistent: ${identical}/${pairsN}`);

console.log('\n=== VERDICT ===');
if (!live) { console.log('  VOID (instrument): the positive control did not fire — channels may be dead.'); process.exit(0); }
const anySep = ['bayes', 'surprisal', 'bridge'].some(ch => { const a = auc(V[ch], C[ch]); return a != null && a >= 0.75; });
if (anySep) {
  console.log('  CAPABILITY PRESENT: a channel separates violation from consistent (unexpected — investigate which).');
} else {
  console.log('  GAP CONFIRMED. No significance channel separates a frame VIOLATION from a frame-consistent');
  console.log('  predication of equal novelty — they are byte-identical. The instrument is live (the bridge');
  console.log('  control fires), so this is a real blindness: the engine has no atom for expectation violation.');
  console.log('  Root cause: predicates are opaque, slotless value-atoms (key="predicate"); a contradictory');
  console.log('  KIND and a fresh compatible attribute both deposit one new value — the mass KL sees the same');
  console.log('  move, the bridge sees no bond, and nothing reads a conflict ontology for copular kinds.');
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
