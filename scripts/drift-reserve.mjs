#!/usr/bin/env node
// drift-reserve — the READ-ONLY measure for the drifting-signal / novelty-reserve
// pressure (exp-0002). Emits per-item channels over PRIOR CONTEXT ONLY (causal); it
// never reads data/drift-reserve-key.json, and it touches no production code.
//
// THE INSTRUMENT. For each sense and each cursor line `at`, it rebuilds exactly what
// reading.js feeds the one surprise:
//   • priorProp — the γ-decayed atom profile BEFORE the cursor (weight γ^(at-1-k),
//     k < at), the same kernel reading.js uses for the figure field.
//   • deposit   — this line's atoms (mass 1 each), the arrival.
// then calls the REAL core `surpriseAt(prior, deposit, { gamma, novelty })` TWICE,
// changing ONLY the reserve AMPLITUDE — the Born law inside surpriseAt is identical
// both times (context enters at the amplitude, never the law):
//   • fixed  novelty = 1.0                         — today's NOVELTY_RESERVE
//   • ctx    novelty = γ-decayed newcomer RATE     — the candidate fix
//
// The contextual reserve (closed form, same γ as the figure field; seed 1.0 so the
// OPENING is byte-identical to fixed and decays away — no permanent constant):
//   reserve(at) = γ^at · 1 + Σ_{k<at} newcomers(k) · γ^(at-1-k)
// high after a run of newcomers, low after a drought, never exactly zero (absolute
// continuity preserved).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { surpriseAt } from '../src/core/index.js';   // THE REAL CORE — the Born step under test

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');
const GAMMA = 0.7;                                    // reading.js GAMMA — the figure-field horizon

const stim = JSON.parse(fs.readFileSync(path.join(dataDir, 'drift-reserve-stimulus.json'), 'utf8'));

// Walk one stream causally; emit a per-item record for each cursor line.
const readStream = (units, sense) => {
  const firstSeen = new Map();                        // atom → first line it appeared
  units.forEach((u, i) => { for (const a of u) if (!firstSeen.has(a)) firstSeen.set(a, i); });
  const newcomersAt = units.map((u, i) => u.filter(a => firstSeen.get(a) === i).length);

  const out = [];
  for (let at = 0; at < units.length; at++) {
    // priorProp: γ-decayed atom presence over lines k < at (reading.js kernel).
    const prior = new Map();
    for (let k = 0; k < at; k++) {
      const w = Math.pow(GAMMA, at - 1 - k);
      for (const a of units[k]) prior.set(a, (prior.get(a) || 0) + w);
    }
    // deposit: this line's atoms (mass 1 each) — the arrival.
    const deposit = new Map();
    for (const a of units[at]) deposit.set(a, (deposit.get(a) || 0) + 1);

    // contextual reserve = γ-decayed newcomer rate (seed 1.0, decaying).
    let reserveCtx = Math.pow(GAMMA, at) * 1.0;
    for (let k = 0; k < at; k++) reserveCtx += newcomersAt[k] * Math.pow(GAMMA, at - 1 - k);

    // THE SAME BORN STEP, twice — only the reserve amplitude differs.
    const fixed = surpriseAt(prior, deposit, { gamma: GAMMA, novelty: 1.0 });
    const ctx   = surpriseAt(prior, deposit, { gamma: GAMMA, novelty: reserveCtx });

    out.push({
      sense, i: at,
      atoms: units[at],
      newcomers: newcomersAt[at],
      reserveCtx: round(reserveCtx),
      fixedBits: round(fixed.bayesBits),
      ctxBits: round(ctx.bayesBits),
    });
  }
  return out;
};

const records = [];
for (const [sense, units] of Object.entries(stim.senses)) {
  for (const r of readStream(units, sense)) records.push(r);
}

const outPath = path.join(dataDir, 'drift-reserve-out.jsonl');
fs.writeFileSync(outPath, records.map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`wrote ${path.relative(path.resolve(here, '..'), outPath)}  (${records.length} items over ${Object.keys(stim.senses).length} senses)`);

// A compact human view per sense (the trace; the scorer reads the jsonl, not this).
for (const sense of Object.keys(stim.senses)) {
  const rows = records.filter(r => r.sense === sense);
  console.log(`\n# ${sense}`);
  console.log(`  i  new  reserveCtx   fixedBits   ctxBits`);
  for (const r of rows) {
    console.log(
      `  ${String(r.i).padStart(2)}  ${String(r.newcomers).padStart(3)}  ` +
      `${r.reserveCtx.toFixed(3).padStart(9)}   ${r.fixedBits.toFixed(3).padStart(8)}   ${r.ctxBits.toFixed(3).padStart(7)}`);
  }
}

function round(x) { return Math.round(x * 1000) / 1000; }
