#!/usr/bin/env node
// surf-bench — run the surfing-success battery and print the report
// (docs/surfing-success.md). The talker is out of the loop: this scores the
// surfaced structured note directly, per target, across many angles.
//
//   node scripts/surf-bench.mjs                 # baseline battery
//   node scripts/surf-bench.mjs --sweep leak 0.5,0.9,0.99
//   node scripts/surf-bench.mjs --sweep confinement 2,20,400
//   node scripts/surf-bench.mjs --regression    # charge/valence on-off + surprise depth
//   node scripts/surf-bench.mjs --no-embed      # pure-mechanical (lexical retrieval + token grounding)
//
// The embedder is the in-stack HASH organ by default — a bag-of-words firewall,
// not MiniLM. So a zero-overlap paraphrase cannot pivot to the right region, and
// that shows up exactly where the design wants it: a LOW-CONSISTENCY target. Warm
// a real meaning embedder to lift the paraphrase angles (and the consistency).

import {
  runBattery, sweepForce, chargeValenceRegression, surpriseDepthCheck,
} from '../src/bench/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const embedder = has('--no-embed') ? null : createHashEmbedder();

const bar = (x, w = 20) => '█'.repeat(Math.round(x * w)).padEnd(w, '·');

const printReport = (report) => {
  console.log(`\nbattery score: ${report.batteryScore}  (mean target ${report.meanTarget} over ${report.nTargets} targets)` +
              `   hard gate tripped: ${report.anyGate ? 'YES ✗' : 'no ✓'}`);
  for (const [tid, t] of Object.entries(report.perTarget)) {
    console.log(`\n  ${tid.padEnd(12)} target ${t.targetScore.toFixed(3)}  ${bar(t.targetScore)}` +
                `  mean ${t.mean.toFixed(2)}  consistency ${t.consistency.toFixed(2)}${t.gated ? '  GATED ✗' : ''}`);
    for (const a of t.angles) {
      const tag = a.gated ? `GATE[${a.gates.join(',')}]` : '';
      const dec = a.decoy ? `→${a.decoy}` : '';
      console.log(`      ${a.score.toFixed(3)}  r=${a.recall.toFixed(2)} p=${a.precision.toFixed(2)} g=${a.groundedness.toFixed(2)} ${tag}${dec}  "${a.angle}"`);
    }
  }
};

if (has('--sweep')) {
  const name = val('--sweep');
  const raw = args[args.indexOf('--sweep') + 2] || '';
  const values = raw.split(',').map(v => /^[-\d.]+$/.test(v) ? Number(v) : v);
  console.log(`# sweep: ${name} over [${values.join(', ')}]`);
  const out = await sweepForce(name, values, { embedder });
  for (const r of out.rows) {
    console.log(`\n${name}=${r.value}  battery=${r.batteryScore}  mean=${r.meanTarget}  gate=${r.anyGate ? 'YES' : 'no'}`);
  }
  console.log(`\nbest (highest consistent battery, no gate tripped): ${name}=${out.best.value}  battery=${out.best.batteryScore}`);
} else if (has('--regression')) {
  console.log('# charge / valence — the role-exclusivity sentinel (declared, not swept)');
  const cv = await chargeValenceRegression();
  console.log(`  sentinel ON : forbidden sister-on-mother present? ${cv.on.forbiddenRelationPresent}`);
  console.log(`  sentinel OFF: forbidden sister-on-mother present? ${cv.off.forbiddenRelationPresent}`);
  console.log(`  regression ${cv.pass ? 'PASS ✓ (clean on, broken off)' : 'FAIL ✗'}`);
  console.log('\n# surprise depth — which targets fill at all (cheap γ-mass vs meaning reader)');
  const sd = await surpriseDepthCheck({ embedder });
  console.log(`  embedder measures meaning: ${sd.measuresMeaning} ${sd.measuresMeaning ? '' : '(hash organ → meaning reader falls back to cheap)'}`);
  console.log(`  cheap   frame recall ${sd.cheap.frameRecall}   target ${sd.cheap.targetScore}`);
  console.log(`  meaning frame recall ${sd.meaning.frameRecall}   target ${sd.meaning.targetScore}`);
} else {
  console.log(`# surfing-success battery — Metamorphosis, no talker` +
              `${embedder ? ` (embedder: ${embedder.id})` : ' (no embedder — lexical + token grounding)'}`);
  printReport(await runBattery({ embedder }));
}
