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
  runBattery, sweepForce, chargeValenceRegression, surpriseDepthCheck, rereadRegression,
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
} else if (has('--reread')) {
  // Measure the active-inference re-read (surfing-next.md §3): run the battery with the
  // window-widening OFF (the baseline) and ON, and report the per-target delta. This is the
  // gate on flipping the re-read on by default — does reading-more-on-the-open-figure help
  // the note, leave it flat, or hurt it?
  console.log(`# re-read A/B — battery with forces.reread off vs on${embedder ? ` (embedder: ${embedder.id})` : ' (no embedder)'}`);
  const off = await runBattery({ embedder, forces: { reread: false } });
  const on  = await runBattery({ embedder, forces: { reread: true } });
  const d = (x) => (x >= 0 ? `+${x.toFixed(3)}` : x.toFixed(3));
  console.log(`\nbattery score: ${off.batteryScore.toFixed(3)} → ${on.batteryScore.toFixed(3)}  (Δ ${d(on.batteryScore - off.batteryScore)})` +
              `   hard gate: off ${off.anyGate ? 'YES' : 'no'} / on ${on.anyGate ? 'YES' : 'no'}`);
  for (const tid of Object.keys(off.perTarget)) {
    const a = off.perTarget[tid].targetScore, b = on.perTarget[tid].targetScore;
    const mark = b > a + 1e-9 ? '↑ better' : b < a - 1e-9 ? '↓ worse' : '· same';
    console.log(`  ${tid.padEnd(12)} ${a.toFixed(3)} → ${b.toFixed(3)}  (Δ ${d(b - a)})  ${mark}`);
  }
  // The battery is flat by construction (Metamorphosis readings SETTLE — the trigger never
  // fires). The diagnostic on a crafted ambiguous-reference fixture probes whether the re-read
  // widens where the reading could not settle who. FINDING (surfing-next.md §3): it does NOT
  // reliably widen — the trigger wants a diffuse coref (no dominant figure) while the widening
  // queries the focus figure's LABEL, which only finds fresh spans when that figure is named in
  // unread sentences — i.e. exactly when the reading would have settled on it. The two
  // conditions are anti-correlated. The widening needs a redesign (read more AROUND the
  // unsettled region, not on the figure label).
  const rr = await rereadRegression({ embedder });
  console.log(`\n# re-read diagnostic — crafted ambiguous-reference fixture (what the battery can't host)`);
  console.log(`  query "${rr.query}" → focus ${JSON.stringify(rr.focus)} (the figure the reading could not settle)`);
  console.log(`  window off ${JSON.stringify(rr.offSpans)} → on ${JSON.stringify(rr.onSpans)}  | read more: +${rr.added.length} span(s) ${JSON.stringify(rr.added)}`);
  console.log(`  → ${rr.widened ? 'WIDENED — the re-read added context' : 'NO WIDEN — focus-label retrieval found nothing fresh (the anti-correlated regime; see §3)'}`);
} else {
  console.log(`# surfing-success battery — Metamorphosis, no talker` +
              `${embedder ? ` (embedder: ${embedder.id})` : ' (no embedder — lexical + token grounding)'}`);
  printReport(await runBattery({ embedder }));
}
