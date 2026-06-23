// BLIND scorer for cycle-001-novelty-reserve. Reads stimulus.json, out.json (the measurer's
// channels) and key.json (held). Scores the CONTROL first, then the per-item split, then the
// two-sense (interior) replication. Emits a verdict. Run AFTER measure.mjs.
//
// Run: node experiments/cycle-001-novelty-reserve/score.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = JSON.parse(readFileSync(join(here, 'out.json'), 'utf8'));
const key = JSON.parse(readFileSync(join(here, 'key.json'), 'utf8'));
const by = Object.fromEntries(out.items.map((i) => [i.id, i]));
const id = key.identities;
const pass = [], fail = [];
const check = (ok, label) => (ok ? pass : fail).push(label);

// 0. Instrument must be live, or the score is void.
const inst = out.instrument;
const instrumentOk = inst.reserves_in_open_interval && inst.not_all_zero && inst.tracked_varies;
if (!instrumentOk) { console.log('INSTRUMENT VOID — not scoring:', JSON.stringify(inst)); process.exit(1); }

// 1. CONTROL FIRST — the loud surface signal (mass) is flat, so a mass-keyed method is caught.
//    reserve_const must be identical across RECENT/EARLY/CONFIRM within each sense.
for (const sense of ['A', 'B']) {
  const rs = out.items.filter((i) => i.sense === sense).map((i) => i.reserve_const);
  check(Math.max(...rs) - Math.min(...rs) < 1e-9,
    `control[${sense}]: reserve_const FLAT across conditions (mass cannot discriminate) — ${rs.join(', ')}`);
}

// 2. The LIVE-ENGINE verdict: the constant reserve FAILS the predicted dissociation (it is the
//    same value where the key predicts RECENT > EARLY > CONFIRM). This is the located gap.
const constFlatWhereOrderPredicted = key.predicted_dissociation.pairs.every(
  ([a, , b]) => Math.abs(by[a].reserve_const - by[b].reserve_const) < 1e-9);
check(constFlatWhereOrderPredicted,
  'GAP: reserve_const is identical where RECENT>EARLY>CONFIRM is predicted — the live engine is blind to recent novelty');

// 3. The CANDIDATE verdict: the tracked reserve satisfies the predicted order STRICTLY.
for (const [a, op, b] of key.predicted_dissociation.pairs) {
  check(by[a].reserve_tracked > by[b].reserve_tracked,
    `split: reserve_tracked ${a}(${id[a].pattern}) ${op} ${b}(${id[b].pattern}) — ${by[a].reserve_tracked} vs ${by[b].reserve_tracked}`);
}

// 4. RECENCY, not cumulative count: RECENT and EARLY are matched on distinctCount per sense, so
//    the RECENT>EARLY gap under the tracked reserve is recency, not how many distinct atoms.
for (const sense of ['A', 'B']) {
  const recent = out.items.find((i) => id[i.id].pattern === 'RECENT' && i.sense === sense);
  const early  = out.items.find((i) => id[i.id].pattern === 'EARLY'  && i.sense === sense);
  check(recent.surface.distinctCount === early.surface.distinctCount,
    `control[${sense}]: RECENT and EARLY matched on distinctCount (${recent.surface.distinctCount}=${early.surface.distinctCount}) — RECENT>EARLY is recency, not count`);
  check(recent.reserve_tracked > early.reserve_tracked,
    `recency[${sense}]: with count held equal, tracked reserve still RECENT>EARLY (${recent.reserve_tracked} > ${early.reserve_tracked})`);
}

// 5. INTERIOR (omnimodal): the split holds in sense A AND sense B — one law, two front-ends.
const orderHolds = (sense) => {
  const r = out.items.find((i) => id[i.id].pattern === 'RECENT'  && i.sense === sense).reserve_tracked;
  const e = out.items.find((i) => id[i.id].pattern === 'EARLY'   && i.sense === sense).reserve_tracked;
  const c = out.items.find((i) => id[i.id].pattern === 'CONFIRM' && i.sense === sense).reserve_tracked;
  return r > e && e > c;
};
const twoSense = orderHolds('A') && orderHolds('B');
check(twoSense, 'INTERIOR: RECENT>EARLY>CONFIRM holds in BOTH sense A (proposition) and sense B (tonal)');

// 6. Liveness on the production organ.
const liveOk = Math.abs(out.liveness.off.RECENT - out.liveness.off.EARLY) < 1e-9
            && out.liveness.on.RECENT > out.liveness.on.EARLY;
check(liveOk, `LIVENESS: readingAt reserve flat OFF (${out.liveness.off.RECENT}=${out.liveness.off.EARLY}), recency-ordered ON (${out.liveness.on.RECENT}>${out.liveness.on.EARLY})`);

console.log('PASS:'); for (const p of pass) console.log('  ✓', p);
if (fail.length) { console.log('FAIL:'); for (const f of fail) console.log('  ✗', f); }
console.log('\nVERDICT:');
console.log('  gap_located        =', constFlatWhereOrderPredicted);
console.log('  capability_confirmed =', key.predicted_dissociation.pairs.every(([a, , b]) => by[a].reserve_tracked > by[b].reserve_tracked));
console.log('  interior_confirmed   =', twoSense, '(sense A & sense B)');
console.log('  liveness             =', liveOk);
console.log(fail.length === 0 ? '\nALL CHECKS PASS' : `\n${fail.length} CHECK(S) FAILED`);
process.exit(fail.length === 0 ? 0 : 2);
