#!/usr/bin/env node
// novelty-reserve-score — the blind scorer. Reads the measure's output
// (data/novelty-reserve-out.jsonl) and the HELD KEY (data/novelty-reserve-key.json) and
// reports whether the dissociation the key predicts holds. The measure never saw the key;
// this is where selection happens.
//
// The discipline: read the CONTROL first (did the trivial explanation get caught — here,
// the count-matched pair and the flat default path), then the per-stream split, then
// stability.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = join(ROOT, 'data', 'novelty-reserve-out.jsonl');
const KEY  = join(ROOT, 'data', 'novelty-reserve-key.json');

const records = readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync(KEY, 'utf8'));
const cursor = key.cursor;
const at = (streamId, field) => records.find((r) => r.streamId === streamId && r.lineIdx === cursor)?.[field];

let allPass = true;
const check = (label, cond, detail) => {
  allPass = allPass && cond;
  console.log(`  ${cond ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const spread = (xs) => Math.max(...xs) - Math.min(...xs);

const order = key.dissociation.ordering_at_cursor;   // [recent, stale, stable]  (high → low reserve)
const [hi, mid, lo] = order;
const [b, c] = key.control.count_matched_pair;       // [stream_b (stale), stream_c (recent)]

console.log(`=== novelty-reserve @ cursor ${cursor} ("${key.newcomer}" arrives in every stream) ===`);

// 1 ── CONTROL FIRST. Did the trivial explanations get caught?
console.log('\n  -- control --');
// (a) the count-matched pair is identical under every count-based surface feature
const totB = at(b, 'totalMass'), totC = at(c, 'totalMass');
check('count-matched pair has equal total mass (every count-based surface feature is held equal)',
  Math.abs(totB - totC) < 1e-6, `totalMass ${b}=${totB}, ${c}=${totC}`);
// (b) the DEFAULT (pre-fix) path is FLAT across all three streams — the gap: blind to novelty rate
const constReserves = order.map((s) => at(s, 'reserveConst'));
const bayesDefaults = order.map((s) => at(s, 'bayesDefault'));
check('the DEFAULT reserve 1/(total+1) is FLAT across the streams (the gap — blind to novelty rate)',
  spread(constReserves) < 0.02, `reserveConst=[${constReserves}]`);
check('the DEFAULT bayes is FLAT across the streams (the live engine reads the newcomer identically)',
  spread(bayesDefaults) < 0.02, `bayesDefault=[${bayesDefaults}]`);

// 2 ── THE PER-STREAM SPLIT. The signal-derived reserve tracks the recent novelty RATE.
console.log('\n  -- per-stream split (signal-derived reserve) --');
const rHi = at(hi, 'reserve'), rMid = at(mid, 'reserve'), rLo = at(lo, 'reserve');
check(`reserve tracks recent novelty: ${hi} > ${mid} > ${lo}`,
  rHi > rMid && rMid > rLo, `reserve ${hi}=${rHi}, ${mid}=${rMid}, ${lo}=${rLo}`);
// the count-matched gap is LARGE — recency, not count, drives it (b and c have identical counts)
const rB = at(b, 'reserve'), rC = at(c, 'reserve');
check('count-matched gap is large (reserve of fresh-churn ≥ 3× stale-burst) — recency, not count',
  rC >= 3 * rB, `reserve ${c}=${rC} vs ${b}=${rB} (counts identical)`);
// the amplitude itself orders the same way
const nHi = at(hi, 'noveltyMass'), nMid = at(mid, 'noveltyMass'), nLo = at(lo, 'noveltyMass');
check(`noveltyMass (the amplitude nu) orders ${hi} > ${mid} > ${lo}`,
  nHi > nMid && nMid > nLo, `nu ${hi}=${nHi}, ${mid}=${nMid}, ${lo}=${nLo}`);

// 3 ── THE CONSEQUENCE. A lower reserve makes the newcomer a larger violation.
console.log('\n  -- consequence (newcomer significance) --');
const klStable = at(order[2], 'bayesAdaptive'), klRecent = at(order[0], 'bayesAdaptive');
check('the sealed-cast newcomer moves belief MORE than the fresh-churn newcomer (bayes: stable > recent)',
  klStable > klRecent, `bayesAdaptive ${order[2]}=${klStable} > ${order[0]}=${klRecent}`);

// 4 ── STABILITY (surface invariance). The reserve reads novelty structure, not the verbs.
console.log('\n  -- stability --');
const parityAll = records.every((r) => r.parity === true);
check('default path byte-identical on every line (the flag adds fields, moves no default channel)', parityAll,
  parityAll ? 'parity true on all lines' : 'parity broke on some line');

console.log(`\n  -- mechanism -- ${key.mechanism_tag}`);
console.log(`     reserve column @cursor: ${order.map((s) => `${s}=${at(s, 'reserve')}`).join('  ')}`);
console.log(`     const  column @cursor:  ${order.map((s) => `${s}=${at(s, 'reserveConst')}`).join('  ')}`);

console.log(`\n=== ${allPass ? '✅ CONFIRMED — the dissociation holds' : '❌ NOT CONFIRMED'} ===`);
process.exit(allPass ? 0 : 1);
