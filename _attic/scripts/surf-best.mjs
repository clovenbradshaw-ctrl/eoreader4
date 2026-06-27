#!/usr/bin/env node
// surf-best — find the surfing configuration that surfaces the best note.
//
// "How to surf the best": the surfer's behaviour is governed by where it is set
// down (k, the retrieval breadth) and how far it reaches (ahead / behind). This
// runs the surfing-success battery (src/bench, no talker) across a JOINT grid of
// those three axes and ranks the configurations by the same consistency-discounted,
// gate-clean battery score the single-axis --sweep uses — but jointly, because the
// note window is the UNION of the retrieval hits and the surf stops, so the axes
// interact and a one-at-a-time sweep can miss the best corner.
//
//   node scripts/surf-best.mjs                       # default grid
//   node scripts/surf-best.mjs --k 8,16,48 --ahead 12,16,20 --behind 0,2,4
//   node scripts/surf-best.mjs --top 15              # show more of the ranking
//
// The embedder is the in-stack HASH organ (bag-of-words firewall, not MiniLM), the
// same default the rest of the bench runs on, so the numbers are comparable to
// `npm run bench`. Warm a meaning embedder to lift the paraphrase angles.

import { runBattery } from '../src/bench/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';

const args = process.argv.slice(2);
const list = (flag, dflt) => {
  const i = args.indexOf(flag);
  if (i < 0) return dflt;
  return args[i + 1].split(',').map(Number);
};
const num = (flag, dflt) => {
  const i = args.indexOf(flag);
  return i < 0 ? dflt : Number(args[i + 1]);
};

const K      = list('--k',      [8, 16, 20, 32, 48, 64]);
const AHEAD  = list('--ahead',  [12, 16, 20, 24]);
const BEHIND = list('--behind', [0, 2, 4]);
const TOP    = num('--top', 10);

const embedder = createHashEmbedder();

// Baseline: the live defaults (k=8, ahead=16, behind=4).
const baseline = await runBattery({ embedder });
const base = baseline.batteryScore;

const rows = [];
for (const k of K) for (const ahead of AHEAD) for (const behind of BEHIND) {
  const r = await runBattery({ embedder, forces: { k, ahead, behind } });
  rows.push({
    k, ahead, behind,
    battery: r.batteryScore,
    mean: r.meanTarget,
    gate: r.anyGate,
    perTarget: r.perTarget,
  });
}

// Best = highest battery among the gate-clean configs (admissible §7); fall back to
// the whole set only if every config trips a gate (it won't here, but be honest).
const clean = rows.filter(r => !r.gate);
const ranked = (clean.length ? clean : rows).sort((a, b) => b.battery - a.battery);
const best = ranked[0];

const cell = (r) => `k=${String(r.k).padStart(2)} ahead=${String(r.ahead).padStart(2)} behind=${r.behind}`;

console.log(`# surf-best — joint grid over k × ahead × behind  (${rows.length} configs, hash organ)`);
console.log(`# baseline (k=8 ahead=16 behind=4): battery ${base.toFixed(3)}\n`);
console.log(`rank  battery  mean   Δvs base   config`);
ranked.slice(0, TOP).forEach((r, i) => {
  const d = r.battery - base;
  console.log(`${String(i + 1).padStart(2)}    ${r.battery.toFixed(3)}   ${r.mean.toFixed(3)}  ${(d >= 0 ? '+' : '') + d.toFixed(3)}   ${cell(r)}${r.gate ? '  GATED' : ''}`);
});

console.log(`\nbest: ${cell(best)}   battery ${best.battery.toFixed(3)}  (+${(best.battery - base).toFixed(3)} vs baseline)`);
console.log(`per-target at best vs baseline:`);
for (const tid of Object.keys(best.perTarget)) {
  const b = best.perTarget[tid], z = baseline.perTarget[tid];
  const d = b.targetScore - z.targetScore;
  console.log(`  ${tid.padEnd(11)} ${z.targetScore.toFixed(3)} → ${b.targetScore.toFixed(3)}  (${(d >= 0 ? '+' : '') + d.toFixed(3)})` +
              `   mean ${b.mean.toFixed(2)}  consistency ${b.consistency.toFixed(2)}`);
}
