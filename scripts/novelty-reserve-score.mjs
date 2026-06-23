#!/usr/bin/env node
// novelty-reserve-score — the blind scorer. Reads the measure's output
// (data/novelty-reserve-out.jsonl) and the HELD KEY (data/novelty-reserve-key.json) and
// reports whether the dissociation the key predicts holds. The measure never saw the key;
// this is where selection happens.
//
// The discipline: read the CONTROL first (did the trivial explanation get caught), then the
// per-item split (the result is a split across conditions, not an aggregate), then stability
// across senses (the omnimodal gate for an interior change).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = join(ROOT, 'data', 'novelty-reserve-out.jsonl');
const KEY  = join(ROOT, 'data', 'novelty-reserve-key.json');

const records = readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync(KEY, 'utf8'));
const k = key.predicted;

const get = (sense, condition, field) => {
  const r = records.find((x) => x.sense === sense && x.condition === condition);
  return r ? r[field] : null;
};
const senses = [...new Set(records.map((r) => r.sense))];

let allPass = true;
const check = (label, cond, detail) => {
  allPass = allPass && cond;
  console.log(`  ${cond ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const approxEq = (a, b, eps = 1e-6) => a != null && b != null && Math.abs(a - b) < eps;

for (const sense of senses) {
  const fixN = get(sense, 'newcomers',  'pNovel_fixed');
  const fix1 = get(sense, 'one_recurs', 'pNovel_fixed');
  const fixO = get(sense, 'old_recur',  'pNovel_fixed');
  const adpN = get(sense, 'newcomers',  'pNovel_adaptive');
  const adp1 = get(sense, 'one_recurs', 'pNovel_adaptive');
  const adpO = get(sense, 'old_recur',  'pNovel_adaptive');

  console.log(`\n=== ${sense} — reserve p(novel) at the probe ===`);
  console.log(`     fixed:    newcomers=${fixN}  one_recurs=${fix1}  old_recur=${fixO}`);
  console.log(`     adaptive: newcomers=${adpN}  one_recurs=${adp1}  old_recur=${adpO}`);

  // 1 ── CONTROL FIRST.
  console.log('  -- control --');
  // (a) the gap: the live FIXED reserve is BLIND — equal across all three (matched mass).
  check('fixed reserve is BLIND — equal across conditions (the gap the live engine has)',
    approxEq(fixN, fix1) && approxEq(fix1, fixO), `fixed = [${fixN}, ${fix1}, ${fixO}]`);
  // (b) the loud-surface control: old_recur (distinct-count & surface activity matched to
  //     newcomers) must group with one_recurs under adaptive, NOT with newcomers.
  const groupsWithConfirm = Math.abs(adpO - adp1) < Math.abs(adpO - adpN);
  check('loud-surface control caught — old_recur groups with one_recurs, NOT newcomers',
    groupsWithConfirm && adpO <= 0.3,
    `|old−one|=${round3(Math.abs(adpO - adp1))} < |old−new|=${round3(Math.abs(adpO - adpN))}, old_recur=${adpO}`);

  // 2 ── THE PER-ITEM SPLIT. adaptive separates a burst from a confirmation stretch.
  console.log('  -- per-item split --');
  check('adaptive reserve fires HIGH after a burst of newcomers', adpN >= 0.4, `newcomers=${adpN}`);
  check('adaptive reserve falls LOW after a confirmation stretch', adp1 <= 0.3, `one_recurs=${adp1}`);
  check('the burst is the UNIQUE argmax of the adaptive reserve',
    adpN > adp1 && adpN > adpO, `newcomers=${adpN} > one_recurs=${adp1}, old_recur=${adpO}`);
  // the dissociation is REAL: the adaptive reserve separated what the fixed reserve could not.
  const fixedGap = Math.max(fixN, fix1, fixO) - Math.min(fixN, fix1, fixO);
  const adpGap   = Math.max(adpN, adp1, adpO) - Math.min(adpN, adp1, adpO);
  check('adaptive opens a gap the fixed reserve does not', adpGap > fixedGap + 0.1,
    `adaptive spread=${round3(adpGap)} vs fixed spread=${round3(fixedGap)}`);
}

// 3 ── STABILITY across senses — the omnimodal gate (an interior change must help two senses).
console.log('\n=== omnimodal stability (the interior gate) ===');
const bothHigh = senses.every((s) => get(s, 'newcomers', 'pNovel_adaptive') >= 0.4);
const bothLow  = senses.every((s) => get(s, 'one_recurs', 'pNovel_adaptive') <= 0.3 && get(s, 'old_recur', 'pNovel_adaptive') <= 0.3);
check(`the SAME dissociation holds in every sense [${senses}] — interior, not a modality fact`,
  senses.length >= 2 && bothHigh && bothLow,
  `newcomers high & {one_recurs, old_recur} low in all of [${senses}]`);

console.log(`\n=== ${allPass ? '✅ CONFIRMED — the dissociation holds' : '❌ NOT CONFIRMED'} ===`);
function round3(x) { return x == null ? null : Math.round(x * 1000) / 1000; }
process.exit(allPass ? 0 : 1);
