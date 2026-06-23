#!/usr/bin/env node
// BLIND scorer for cycle 001. Reads the key and the measurement; reads the CONTROL first,
// then the per-stream split, then the fitness. Prints a verdict. No channel names hard-coded
// to a regime — the key supplies the mapping.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const { streams } = JSON.parse(readFileSync(join(HERE, 'out.json'), 'utf8'));
const PASS = (b) => (b ? 'PASS' : 'FAIL');
const last = (rows) => rows[rows.length - 1];

// Forward novelty log-loss: -[y log r + (1-y) log(1-r)] over all cursors of all streams.
const logloss = (channel) => {
  let s = 0, n = 0;
  for (const rows of Object.values(streams)) for (const r of rows) {
    const p = Math.min(1 - 1e-6, Math.max(1e-6, r[channel]));
    s += -(r.novel * Math.log(p) + (1 - r.novel) * Math.log(1 - p)); n++;
  }
  return s / n;
};

console.log('=== cycle 001 — novelty reserve, scored blind ===\n');

// (1) CONTROL FIRST — the regime-shift stream. Did the trivial explanation get caught?
const ctrl = key.control;
const cr = streams[ctrl];
const ctrlFixedFlat = Math.abs(last(cr).fixed - cr[5].fixed) < 0.02;
const ctrlCumStaysHigh = last(cr).cumRate > 0.4;                 // the CHEAP counter stays elevated
const ctrlBornFalls = last(cr).born < 0.5 * cr[5].born;          // only the recency-weighted reserve falls
console.log(`CONTROL (${ctrl}, regime shift): cheap cumulative counter stays high (${last(cr).cumRate}) [${PASS(ctrlCumStaysHigh)}]`);
console.log(`  fixed reserve flat across the shift (${cr[5].fixed} -> ${last(cr).fixed}) [${PASS(ctrlFixedFlat)}]  (the gap)`);
console.log(`  BORN reserve falls after the shift (${cr[5].born} -> ${last(cr).born}) [${PASS(ctrlBornFalls)}]  (tracks recency, not the cheap count)`);

// (2) PER-STREAM SPLIT — separate steady-novelty from cast-then-recurrence.
const T = Object.entries(key.regimes).find(([, v]) => v.regime.startsWith('steady'))[0];
const M = Object.entries(key.regimes).find(([, v]) => v.regime.includes('LOW'))[0];
const bornSep = last(streams[T]).born - last(streams[M]).born;
const fixedSep = Math.abs(last(streams[T]).fixed - last(streams[M]).fixed);
const splitOK = bornSep > 0.3 && fixedSep < 0.02;
console.log(`\nSPLIT (steady ${T} vs recurrence ${M}):`);
console.log(`  BORN  separates: ${last(streams[T]).born} vs ${last(streams[M]).born}  (Δ=${bornSep.toFixed(3)}) [${PASS(bornSep > 0.3)}]`);
console.log(`  fixed blind:     ${last(streams[T]).fixed} vs ${last(streams[M]).fixed}  (Δ=${fixedSep.toFixed(3)}) [${PASS(fixedSep < 0.02)}]  (the gap)`);

// (3) FITNESS — forward novelty log-loss, calibrated vs fixed (lower is better).
const llFixed = logloss('fixed'), llBorn = logloss('born');
const fitnessOK = llBorn < llFixed;
console.log(`\nFITNESS (forward novelty log-loss, lower better):`);
console.log(`  fixed=${llFixed.toFixed(3)}  born=${llBorn.toFixed(3)}  gain=${(llFixed - llBorn).toFixed(3)} [${PASS(fitnessOK)}]`);

const verdict = ctrlBornFalls && ctrlFixedFlat && splitOK && fitnessOK;
console.log(`\nVERDICT: ${verdict ? 'CONFIRMED — calibrated reserve adapts where the fixed reserve is blind; control holds; fitness improves.' : 'NOT CONFIRMED'}`);
process.exit(verdict ? 0 : 1);
