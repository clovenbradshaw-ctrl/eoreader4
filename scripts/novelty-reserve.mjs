#!/usr/bin/env node
// novelty-reserve — a read-only measurement of the reserve channel (the protention atom).
//
// READ-ONLY. Touches no production state, changes no rules. For every condition of every
// sense in data/novelty-reserve-stimulus.json it emits, at the PROBE cursor (the last unit,
// read over prior context only, causally), the reserve probability p(novel) the engine holds
// for an as-yet-unseen atom — under the live FIXED reserve and under the OPT-IN ADAPTIVE
// reserve — to data/novelty-reserve-out.jsonl. It selects nothing, scores nothing. There is
// no answer key in the input and this script does not read one; selection happens in
// scripts/novelty-reserve-score.mjs against a held key this script never sees.
//
// THE PRESSURE (a constant-hunt cycle). An inside-out draw landed on src/core/surprise.js:21
// NOVELTY_RESERVE = 1.0 (mirrored at src/perceiver/reading.js:23) — a hand-set constant in the
// predictive path. The claim it makes: the reader's certainty about the unseen is fixed,
// independent of whether newcomers have been arriving. The stimulus stresses exactly that:
// three readings that reach IDENTICAL accumulated figure mass (every unit deposits one INS) but
// differ in the recent RATE of newcomer arrivals. The cheap surface signal (recent-mention
// activity, distinct-entity count) is LOUD on the 'old_recur' control — matched to 'newcomers'
// — so a method that reads surface, not the rate of NEW arrivals, fails the control.
//
// THE CHANNELS, both off the live engine, both deterministic (no model, no network):
//
//   pNovel_fixed     readingAt(.., {forward:true}).pNovel — the reserve probability under the
//                    LIVE fixed NOVELTY=1.0. Depends only on accumulated mass (matched here),
//                    so it is the SAME across conditions: the gap this pressure targets.
//
//   pNovel_adaptive  readingAt(.., {forward:true, reserve:'adaptive'}).pNovel — the reserve
//                    under recentNoveltyReserve (γ-decayed newcomer rate), fed as the novelty
//                    amplitude through the UNCHANGED Born step. Tracks the rate of newcomers.
//
// CAUSALITY. Each condition is its own document (its own log). The probe is read at the last
// unit; readingAt builds its prior from events with sentIdx < cursor and the arrival from
// sentIdx === cursor — no lookahead.
//
// THE INSTRUMENT IS VERIFIED before the numbers are trusted: every organ must emit INS (the
// organ is live), the adaptive channel must actually move across conditions (not all-equal /
// NaN — the channel computed), and the γ-decayed newcomer rate nu is traced per condition so
// the mechanism's INPUT is visible, not just its output.
//
//   Usage:  node scripts/novelty-reserve.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText }              from '../src/perceiver/parse/index.js';
import { ingestMusic }            from '../src/organs/in/music.js';
import { readingAt }              from '../src/perceiver/index.js';
import { recentNoveltyReserve }   from '../src/core/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN   = join(ROOT, 'data', 'novelty-reserve-stimulus.json');
const OUT  = join(ROOT, 'data', 'novelty-reserve-out.jsonl');

const round3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const GAMMA  = 0.7;   // the default reading horizon (reading.js GAMMA); only used for the nu trace

// Build the document for a sense from its raw units (the organ is the only modality-specific code).
const build = (sense, units) => {
  if (sense === 'text')  return parseText(units.join('\n'), { docId: `nr-${units.length}` });
  if (sense === 'music') return ingestMusic({ name: 'nr-melody', notes: units });
  throw new Error(`unknown sense ${sense}`);
};

// One causal read at the probe cursor: the reserve probability under both reserves, plus the
// instrument trace (the mechanism's input nu, the accumulated mass, and the INS count delivered).
const readProbe = (sense, units) => {
  const doc = build(sense, units);
  const at  = doc.units.length - 1;
  const ev  = doc.log.snapshot();
  const fix = readingAt(doc, at, { forward: true });
  const adp = readingAt(doc, at, { forward: true, reserve: 'adaptive' });

  const insBefore = ev.filter((e) => e.op === 'INS' && e.sentIdx != null && e.sentIdx < at).length;
  const insAt     = ev.filter((e) => e.op === 'INS' && e.sentIdx === at).length;
  const nu        = recentNoveltyReserve(ev, at, { gamma: GAMMA });   // the γ-decayed newcomer rate

  return {
    pNovel_fixed:    round3(fix.pNovel),
    pNovel_adaptive: round3(adp.pNovel),
    surprise_fixed:    round3(fix.surprise),
    surprise_adaptive: round3(adp.surprise),
    nu: round3(nu),
    insBefore, insAt, units: doc.units.length,
  };
};

const stim = JSON.parse(readFileSync(IN, 'utf8'));
console.log('# novelty-reserve — read-only reserve sweep (the protention atom)');
console.log('# pNovel_fixed:    readingAt({forward:true}).pNovel           (fixed NOVELTY=1.0 — the live path)');
console.log('# pNovel_adaptive: readingAt({forward,reserve:adaptive}).pNovel (γ-decayed newcomer rate)');

const records = [];
let totalIns = 0;
for (const [sense, spec] of Object.entries(stim.senses)) {
  for (const [condition, units] of Object.entries(spec.conditions)) {
    const m = readProbe(sense, units);
    totalIns += m.insBefore + m.insAt;
    records.push({ sense, condition, ...m });
    console.log(`  ${sense}/${condition.padEnd(10)} nu=${String(m.nu).padEnd(6)} ` +
      `pNovel fixed=${m.pNovel_fixed} adaptive=${m.pNovel_adaptive}`);
  }
}

// ── VERIFY THE INSTRUMENT before the score is read anywhere. ───────────────────────
console.log('\n# instrument check:');
const ok = [];
const fail = [];
(totalIns > 0 ? ok : fail).push(`organs live — ${totalIns} INS event(s) emitted across all conditions`);
// the adaptive channel must actually MOVE across conditions (else it is dormant / wrong-wired)
for (const sense of Object.keys(stim.senses)) {
  const adp = records.filter((r) => r.sense === sense).map((r) => r.pNovel_adaptive);
  const moves = adp.some((v) => v != null && Number.isFinite(v)) && new Set(adp).size > 1;
  (moves ? ok : fail).push(`${sense}: adaptive reserve computed and MOVES across conditions — [${adp}]`);
  const fx = records.filter((r) => r.sense === sense).map((r) => r.pNovel_fixed);
  (fx.every((v) => v != null && Number.isFinite(v)) ? ok : fail).push(`${sense}: fixed reserve computed — [${fx}]`);
}
// trace a high and a low adaptive item at the mechanism-input level (nu)
const hi = [...records].sort((a, b) => b.pNovel_adaptive - a.pNovel_adaptive)[0];
const lo = [...records].sort((a, b) => a.pNovel_adaptive - b.pNovel_adaptive)[0];
if (hi) ok.push(`high traced — ${hi.sense}/${hi.condition}: nu=${hi.nu} → pNovel_adaptive=${hi.pNovel_adaptive} (fixed=${hi.pNovel_fixed})`);
if (lo) ok.push(`low  traced — ${lo.sense}/${lo.condition}: nu=${lo.nu} → pNovel_adaptive=${lo.pNovel_adaptive} (fixed=${lo.pNovel_fixed})`);
for (const m of ok) console.log(`  ok   · ${m}`);
for (const m of fail) console.log(`  FAIL · ${m}`);

writeFileSync(OUT, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`\n# wrote ${records.length} condition records -> ${OUT.replace(ROOT + '/', '')}`);
if (fail.length) { console.log('# INSTRUMENT VOID — the score is meaningless until this is fixed.'); process.exit(2); }
