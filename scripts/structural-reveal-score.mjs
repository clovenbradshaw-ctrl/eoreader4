#!/usr/bin/env node
// structural-reveal-score — the blind scorer. Reads the measure's output
// (data/structural-reveal-out.jsonl) and the HELD KEY (data/structural-reveal-key.json)
// and reports whether the dissociation the key predicts holds. The measure never saw
// the key; this is where selection happens.
//
// The discipline: read the CONTROL first (did the trivial explanation get caught), then
// the per-item split (the result is usually a split, not an aggregate), then stability.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = join(ROOT, 'data', 'structural-reveal-out.jsonl');
const KEY  = join(ROOT, 'data', 'structural-reveal-key.json');

const records = readFileSync(OUT, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const key = JSON.parse(readFileSync(KEY, 'utf8'));

const at = (docId, condition, lineIdx) =>
  records.find((r) => r.docId === docId && r.condition === condition && r.lineIdx === lineIdx);
const col = (docId, condition, field) =>
  records.filter((r) => r.docId === docId && r.condition === condition).sort((a, b) => a.lineIdx - b.lineIdx).map((r) => r[field]);

let allPass = true;
const check = (label, cond, detail) => {
  allPass = allPass && cond;
  console.log(`  ${cond ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
};
const argmaxIdx = (xs) => xs.reduce((bi, v, i, a) => (v > a[bi] ? i : bi), 0);

for (const [docId, k] of Object.entries(key.documents)) {
  const reveal = k.reveal;
  const adj = k.controls.adjacent_rebond;
  const fresh = k.controls.fresh_entity;
  console.log(`\n=== ${docId} — reveal@${reveal}, controls: adjacent@${adj}, fresh@${fresh} ===`);

  // The condition the channels are scored on (the plainly-stated reveal).
  const bridge = col(docId, 'unmarked', 'bridgeSurprise');
  const bayes  = col(docId, 'unmarked', 'bayesSurprise');

  // 1 ── CONTROL FIRST. Did the trivial explanations get caught?
  console.log('  -- control --');
  check('adjacent re-bond does NOT bridge (not "bridge fires on any relational line")',
    bridge[adj] <= 0.2, `bridge@${adj}=${bridge[adj]}`);
  check('fresh-entity line does NOT bridge (not "bridge fires on novelty")',
    bridge[fresh] <= 0.2, `bridge@${fresh}=${bridge[fresh]}`);

  // 2 ── THE PER-ITEM SPLIT. bridge isolates the reveal; bayes does not.
  console.log('  -- per-item split --');
  const bridgeArgmax = argmaxIdx(bridge);
  const uniqueTop = bridge.filter((v) => v >= bridge[reveal]).length === 1;
  check('bridge fires HIGH on the reveal', bridge[reveal] >= 0.5, `bridge@${reveal}=${bridge[reveal]}`);
  check('the reveal is the UNIQUE argmax of bridge', bridgeArgmax === reveal && uniqueTop,
    `argmax=${bridgeArgmax}, reveal=${reveal}`);
  // The GAP: the mass channel must NOT isolate the reveal — at least one fresh-mass line
  // outranks it. (If bayes already found the reveal, there would be no gap and no need
  // for a connectivity channel — so this failing would falsify the whole pressure.)
  const bayesArgmax = argmaxIdx(bayes);
  const outrankers = bayes.map((v, i) => [i, v]).filter(([i, v]) => i !== reveal && v > bayes[reveal]).map(([i]) => i);
  check('bayes does NOT isolate the reveal — the gap is real', bayesArgmax !== reveal && outrankers.length >= 1,
    `bayes argmax=${bayesArgmax} (not ${reveal}); lines outranking the reveal on bayes: [${outrankers}]`);

  // 3 ── STABILITY. bridge reads structure, not the surface cue: invariant marked↔unmarked.
  console.log('  -- stability (surface invariance) --');
  const bu = at(docId, 'unmarked', reveal)?.bridgeSurprise;
  const bm = at(docId, 'marked', reveal)?.bridgeSurprise;
  check('bridge at the reveal is invariant to the surface emphasis cue',
    bu != null && bm != null && Math.abs(bu - bm) < 1e-9, `unmarked=${bu}, marked=${bm}`);

  // The mechanism, named (the trace).
  const axis = at(docId, 'unmarked', reveal)?.bridgeAxis;
  console.log(`  -- mechanism -- the reveal bridges: ${JSON.stringify(axis)} (different components -> collapse 1.0)`);
  console.log(`     bridge column: [${bridge}]`);
  console.log(`     bayes  column: [${bayes}]`);
}

console.log(`\n=== ${allPass ? '✅ CONFIRMED — the dissociation holds' : '❌ NOT CONFIRMED'} ===`);
process.exit(allPass ? 0 : 1);
