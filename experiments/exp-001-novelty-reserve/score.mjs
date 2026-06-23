// BLIND scorer for EXP-001. Reads the held key only here, at scoring time. Order of
// reading, per the discipline: the control FIRST (did the trivial explanation get
// caught), then the per-item split per sense, then stability.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const rows = readFileSync(join(HERE, 'measure-out.jsonl'), 'utf8')
  .trim().split('\n').map(l => JSON.parse(l));

// AUC that `burst` scores rank above `plateau` scores (0.5 = no separation, 1 = perfect,
// <0.5 = anti-correlated). Ties count as 0.5.
const auc = (burst, plateau) => {
  if (!burst.length || !plateau.length) return null;
  let s = 0;
  for (const a of burst) for (const b of plateau) s += a > b ? 1 : (a === b ? 0.5 : 0);
  return s / (burst.length * plateau.length);
};

const SENSES = ['membrane', 'music', 'text'];
const groups = {};
for (const sense of SENSES) groups[sense] = { burst: { c: [], x: [] }, plateau: { c: [], x: [] } };

// Instrument check: channels present, distinct figures arrived as the key expects.
const instr = [];
for (const r of rows) {
  const k = key.items[r.id];
  const expectDistinct = Object.keys(k.distinctOrder).length;
  const ok = r.reserveConstant != null && r.reserveContext != null && r.distinct === expectDistinct;
  if (!ok) instr.push(`${r.id}: channel/struct mismatch (distinct ${r.distinct} vs ${expectDistinct})`);
  const g = groups[r.modality][k.mechanism];
  g.c.push(r.reserveConstant);
  g.x.push(r.reserveContext);
}

console.log('=== INSTRUMENT ===');
if (instr.length) { console.log('  VOID — instrument failures:'); instr.forEach(s => console.log('   ', s)); }
else console.log(`  ok — ${rows.length} items, both channels computed, distinct-figure structure matches key.`);

console.log('\n=== CONTROL (read first): does total mass — the constant reserve — separate the labels? ===');
let controlClean = true;
for (const sense of SENSES) {
  const g = groups[sense];
  const a = auc(g.burst.c, g.plateau.c);
  const sep = a == null ? 'n/a' : a.toFixed(3);
  // The control is clean when the constant reserve does NOT separate burst from plateau
  // (AUC near 0.5, or below — anti-correlated). A constant AUC well above 0.5 would mean
  // the surface signal is doing the work → the win would be hollow → VOID.
  const clean = a == null || a <= 0.6;
  if (!clean) controlClean = false;
  console.log(`  ${sense.padEnd(9)} constant-reserve AUC(burst>plateau) = ${sep}  ${clean ? '(surface useless ✓)' : '(SURFACE LEAK ✗)'}`);
}

console.log('\n=== SPLIT: does the context reserve separate them, per sense? ===');
const ctx = {};
for (const sense of SENSES) {
  const g = groups[sense];
  const a = auc(g.burst.x, g.plateau.x);
  ctx[sense] = a;
  const sep = a == null ? 'n/a' : a.toFixed(3);
  console.log(`  ${sense.padEnd(9)} context-reserve  AUC(burst>plateau) = ${sep}` +
    `   [burst x̄=${mean(g.burst.x)?.toFixed(4)} plateau x̄=${mean(g.plateau.x)?.toFixed(4)}]`);
}

// The omnimodal gate: the capability must hold in the two NAMED senses (music AND text),
// each a different organ. The membrane is the mechanism proof, not a sense.
const gate = key.senses.every(s => (ctx[s] ?? 0) >= 0.99);
const mechanism = (ctx.membrane ?? 0) >= 0.99;

console.log('\n=== VERDICT ===');
if (instr.length) { console.log('  VOID (instrument).'); process.exit(0); }
if (!controlClean) { console.log('  VOID (surface leak — control failed).'); process.exit(0); }
if (gate && mechanism) {
  console.log(`  CONFIRMED. Context reserve separates burst from plateau in the membrane (mechanism)`);
  console.log(`  AND in both named senses (omnimodal gate): ${key.senses.join(', ')}.`);
  console.log(`  The constant reserve cannot (matched mass). Capability tracks novelty RATE, not mass.`);
} else {
  console.log(`  GAP. Context reserve does not yet separate the labels` +
    ` (membrane=${fmt(ctx.membrane)}, music=${fmt(ctx.music)}, text=${fmt(ctx.text)}).`);
  console.log(`  Under the live engine the 'context' channel coincides with the constant — the reserve`);
  console.log(`  is blind to newcomer recency. This is the located gap EXP-001 targets.`);
}

function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function fmt(a) { return a == null ? 'n/a' : a.toFixed(3); }
