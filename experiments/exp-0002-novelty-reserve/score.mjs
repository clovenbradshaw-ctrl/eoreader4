// p001 · SCORE — blind. Reads the per-item channels (by re-running the read-only
// measure in both modes) and the held key, and checks the dissociation. Control
// first (did the trivial mass explanation get caught), then the per-item split,
// then stability across the control. Channel-agnostic: it reads `reserveFig`.
//
// Run:  node experiments/exp-0002-novelty-reserve/score.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));

const run = (mode) => {
  const env = { ...process.env, EMIT: 'json', RESERVE: mode };
  const stdout = execFileSync(process.execPath, [join(HERE, 'measure.mjs')], { env, encoding: 'utf8' });
  const j = JSON.parse(stdout.trim().split('\n').pop());
  const by = {};
  for (const r of j.rows) by[r.id] = r;
  return by;
};

const fixed  = run('fixed');
const signal = run('signal');
const R = (b, id) => b[id]?.reserveFig;          // the channel
const approxEq = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —  ' + detail : ''}`); ok ? pass++ : fail++; };

console.log('\n# p001 · novelty reserve — blind score\n');

// ── instrument check: the channel computed, not all-zeros / dormant ──────────
const anyZero = Object.values(fixed).some(r => r.reserveFig == null || r.reserveFig === 0);
check('instrument live: reserveFig computed for every item (not null/zero)', !anyZero,
  `reserveFig range [${Math.min(...Object.values(fixed).map(r=>r.reserveFig)).toFixed(3)}, ${Math.max(...Object.values(fixed).map(r=>r.reserveFig)).toFixed(3)}]`);

// ── 1 · CONTROL FIRST — the loud surface (mass) is real and detected ─────────
// barren-short (small mass) must hold MORE reserve than barren-long (large mass)
// under the FIXED engine: the instrument is alive and mass-sensitive.
check('control (fixed): mass is loud — barren-short reserve > barren-long',
  R(fixed, 'neutral-barren-short') > R(fixed, 'neutral-barren-long'),
  `short=${R(fixed,'neutral-barren-short').toFixed(4)} > long=${R(fixed,'neutral-barren-long').toFixed(4)}`);

// ── 2 · THE GAP under the fixed engine — matched mass, no novelty-rate read ──
const fM = ['neutral-dense', 'neutral-mid', 'neutral-barren'].map(id => R(fixed, id));
check('GAP (fixed): at matched mass reserveFig is identical across dense/mid/barren',
  approxEq(fM[0], fM[1]) && approxEq(fM[1], fM[2]),
  `dense=${fM[0].toFixed(4)} mid=${fM[1].toFixed(4)} barren=${fM[2].toFixed(4)}  (Δ≈0 → blind to novelty rate)`);

// ── 3 · THE FIX under the signal engine — matched mass, monotonic in rate ────
const sM = ['neutral-dense', 'neutral-mid', 'neutral-barren'].map(id => R(signal, id));
check('FIX (signal): reserveFig MONOTONIC dense > mid > barren at matched mass',
  sM[0] > sM[1] && sM[1] > sM[2],
  `dense=${sM[0].toFixed(4)} > mid=${sM[1].toFixed(4)} > barren=${sM[2].toFixed(4)}`);
check('FIX (signal): the matched split is now OPEN (dense reserve ≫ barren)',
  (sM[0] - sM[2]) > 0.1,
  `Δ(dense-barren)=${(sM[0]-sM[2]).toFixed(4)}`);

// ── 4 · the fix did NOT destroy the surface relation (control still sane) ─────
check('control (signal): still ordered by mass/drought, not reversed or collapsed',
  R(signal, 'neutral-barren-short') > R(signal, 'neutral-barren-long'),
  `short=${R(signal,'neutral-barren-short').toFixed(4)} > long=${R(signal,'neutral-barren-long').toFixed(4)}`);

// ── 5 · THE OMNIMODAL GATE — the SAME change helps ≥2 senses ─────────────────
for (const sense of ['music', 'text']) {
  const d = R(signal, `${sense}-dense`), b = R(signal, `${sense}-barren`);
  const df = R(fixed, `${sense}-dense`), bf = R(fixed, `${sense}-barren`);
  check(`omnimodal (${sense}): fixed ≈ blind (dense≈barren), signal SEPARATES (dense > barren)`,
    Math.abs(df - bf) < 0.02 && d > b + 0.05,
    `fixed Δ=${(df-bf).toFixed(4)}; signal dense=${d.toFixed(4)} > barren=${b.toFixed(4)}`);
}

console.log(`\n${fail === 0 ? 'CONFIRMED' : 'NOT CONFIRMED'} — ${pass} pass / ${fail} fail`);
console.log(`mechanism: ${key.mechanism}\n`);
process.exit(fail === 0 ? 0 : 1);
