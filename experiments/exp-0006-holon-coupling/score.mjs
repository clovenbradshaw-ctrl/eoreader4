// exp-0006 · the scorer — joins the key-blind measure with the held key.
//
// Checks the two coupling arrows and the discovered skeleton:
//   1. the whole DOMINATES — mean dynamic pull over the limbs is substantial;
//   2. the SKELETON is recovered — each real node's most-invariant partner is a true
//      bone (undirected);
//   3. the two arrows DISSOCIATE on the waver — it is dynamically autonomous (low pull)
//      yet structurally constitutive (high constit): an arm doing its own thing;
//   4. the GHOST is rejected — its structural constitution is below every real limb's.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');
const measure = JSON.parse(readFileSync(join(HERE, 'measure_out.json')));
const key = JSON.parse(readFileSync(join(HERE, 'key.json')));
const pct = (x) => (100 * x).toFixed(0).padStart(3) + '%';
const P = (s, n) => String(s).padEnd(n);

let sRecall = 0, sWaverGap = 0, nWaverOK = 0, nGhostOK = 0, sMeanPull = 0;
console.log('\n' + '='.repeat(92));
console.log(P('STREAM', 10) + P('mean-pull', 11) + P('skeleton', 11) + P('waver pull→constit', 22) + 'ghost constit vs min-limb');
console.log('='.repeat(92));
for (const m of measure) {
  const D = JSON.parse(readFileSync(join(BATTERY, `${m.name}.json`)));
  const { tree, waver, ghost } = D.key;
  const real = m.nodes.filter((n) => n !== ghost);
  const limbs = real.filter((n) => tree[n]);   // non-root real nodes
  // 1. mean dynamic pull over limbs
  const meanPull = limbs.reduce((s, n) => s + m.pull[n], 0) / limbs.length;
  // 2. undirected skeleton recovery over real nodes
  let hit = 0, tot = 0;
  for (const n of real) { if (!tree[n]) continue; tot++; if (m.skeleton[n] === tree[n] || tree[m.skeleton[n]] === n) hit++; }
  const recall = hit / tot;
  // 3. waver dissociation
  const waverGap = m.constit[waver] - m.pull[waver];
  const waverOK = m.constit[waver] > 0.8 && m.pull[waver] < m.constit[waver] - 0.2;
  // 4. ghost rejected
  const minLimbConstit = Math.min(...real.map((n) => m.constit[n]));
  const ghostOK = m.constit[ghost] < minLimbConstit;
  sRecall += recall; sWaverGap += waverGap; nWaverOK += waverOK ? 1 : 0; nGhostOK += ghostOK ? 1 : 0; sMeanPull += meanPull;
  console.log(P(m.name, 10) + P(pct(meanPull), 11) + P(`${hit}/${tot} ${pct(recall)}`, 11) +
              P(`${pct(m.pull[waver])} → ${pct(m.constit[waver])} ${waverOK ? '✓' : '✗'}`, 22) +
              `${pct(m.constit[ghost])} < ${pct(minLimbConstit)} ${ghostOK ? '✓' : '✗'}`);
}
console.log('='.repeat(92));
const n = measure.length;
console.log(`mean over ${n} streams:  limb pull ${pct(sMeanPull / n)}   skeleton recall ${pct(sRecall / n)}   ` +
            `waver gap ${pct(sWaverGap / n)}   waver-diss ${nWaverOK}/${n}   ghost-reject ${nGhostOK}/${n}`);

const checks = [
  [`the whole sets a substantial share of each limb's motion (mean pull > ${key.min_mean_pull})`, sMeanPull / n > key.min_mean_pull],
  [`the skeleton is recovered from invariance (recall > ${key.min_skeleton_recall})`, sRecall / n > key.min_skeleton_recall],
  ['the two arrows dissociate on every waver (autonomous motion, rigid bond)', nWaverOK === n],
  ['the ghost is rejected as a non-part on every stream (constit below all limbs)', nGhostOK === n],
];
console.log('\nkey checks:');
let all = true;
for (const [name, ok] of checks) { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}`); all &&= ok; }
console.log(`\nVERDICT: ${all ? 'CONFIRMED — ' + key.verdict_tag : 'REFUTED'}`);
process.exit(all ? 0 : 1);
