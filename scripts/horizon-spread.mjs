#!/usr/bin/env node
// horizon-spread — move 1 of the multi-horizon investigation: the falsifiable one.
//
// The Bayesian-surprise prior in readingAt is γ-decayed in READING-TIME distance, so
// γ IS the horizon. At γ=0.7 the prior feels ~5–6 lines back (0.7^8 ≈ 0.06) — a tight
// recency window. At γ=0.95 it keeps context ~12–20 lines back alive (0.95^12 ≈ 0.54).
//
// If meaning is horizon-dependent, the lines whose reading CHANGES with the horizon —
// the ones that strain against DISTANT context — should light up when we diff the two
// readings, and filler should not:
//
//   spread(c) = | bayes(c | γ=wide) − bayes(c | γ=recency) |
//
// Prediction (the design dialogue): on data/metamorphosis.txt the spread peaks on the
// context-dependent beats (the disowning, the apple-wound), near zero on filler. If it
// is FLAT, the whole multi-horizon idea is dead — stop here. This is the measurement
// that can come back negative. It changes no default path: it only reads `bayes` at two
// gammas over the same fixed log.
//
//   node scripts/horizon-spread.mjs [path] [--recency 0.7] [--wide 0.95] [--top 12]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestText } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let file = null, recency = 0.7, wide = 0.95, topN = 12;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--recency') recency = Number(args[++i]);
  else if (a === '--wide') wide = Number(args[++i]);
  else if (a === '--top') topN = Number(args[++i]);
  else if (!a.startsWith('--')) file = a;
}
file = file || path.resolve(here, '../data/metamorphosis.txt');

const text = fs.readFileSync(file, 'utf8');
const doc = await ingestText(text);
const units = doc.units || doc.sentences || [];
const S = units.length;

const rows = [];
for (let c = 0; c < S; c++) {
  const r0 = readingAt(doc, c, { gamma: recency }).bayes;
  const r1 = readingAt(doc, c, { gamma: wide }).bayes;
  rows.push({ c, recency: r0, wide: r1, spread: Math.abs(r1 - r0) });
}

const maxSpread = rows.reduce((m, r) => Math.max(m, r.spread), 1e-9);
const argmax = (key) => rows.reduce((a, b) => (b[key] > a[key] ? b : a));
const clip = (s, n = 64) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const bar = (x, w = 24) => '█'.repeat(Math.round((x / maxSpread) * w)).padEnd(w, '·');

console.log(`# horizon-spread — ${path.basename(file)}  (${S} units)  recency γ=${recency}  wide γ=${wide}\n`);
console.log(`  idx  recency   wide   spread  ${''.padEnd(24)}  line`);
for (const r of rows) {
  console.log(
    `  ${String(r.c).padStart(3)}  ` +
    `${r.recency.toFixed(3)}  ${r.wide.toFixed(3)}  ${r.spread.toFixed(3)}  ` +
    `${bar(r.spread)}  ${clip(units[r.c])}`,
  );
}

const top = [...rows].sort((a, b) => b.spread - a.spread).slice(0, topN);
console.log(`\n## top ${topN} by horizon-spread (the lines whose reading most depends on the horizon)`);
for (const r of top) {
  console.log(`  s${String(r.c).padStart(3)}  spread ${r.spread.toFixed(3)}  (recency ${r.recency.toFixed(3)} → wide ${r.wide.toFixed(3)})  ${clip(units[r.c], 72)}`);
}

const rPeak = argmax('recency'), wPeak = argmax('wide'), sPeak = argmax('spread');
console.log(`\n## where each criterion would arrest`);
console.log(`  recency-bayes peak  s${rPeak.c}  (${rPeak.recency.toFixed(3)})  ${clip(units[rPeak.c], 72)}`);
console.log(`  wide-bayes    peak  s${wPeak.c}  (${wPeak.wide.toFixed(3)})  ${clip(units[wPeak.c], 72)}`);
console.log(`  spread        peak  s${sPeak.c}  (${sPeak.spread.toFixed(3)})  ${clip(units[sPeak.c], 72)}`);

const meanSpread = rows.reduce((s, r) => s + r.spread, 0) / (S || 1);
const sorted = [...rows].map(r => r.spread).sort((a, b) => a - b);
const median = sorted.length % 2 ? sorted[sorted.length >> 1] : (sorted[(sorted.length >> 1) - 1] + sorted[sorted.length >> 1]) / 2;
console.log(`\n## shape: mean spread ${meanSpread.toFixed(3)}  median ${median.toFixed(3)}  max ${maxSpread.toFixed(3)}  (peak/median ratio ${(maxSpread / (median || 1e-9)).toFixed(1)}×)`);
console.log(`   FLAT (peak ≈ median) ⇒ horizon does not move the reading ⇒ multi-horizon idea is dead.`);
console.log(`   PEAKED (peak ≫ median, on the event beats) ⇒ the spread is a real signal ⇒ moves 2–6 are worth it.`);
