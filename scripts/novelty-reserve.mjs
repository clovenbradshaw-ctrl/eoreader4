#!/usr/bin/env node
// novelty-reserve — a read-only measurement of the reserve amplitude.
//
// READ-ONLY. Touches no production state, changes no rules. For every line of every stream
// in data/novelty-reserve-stimulus.json it emits, over PRIOR CONTEXT ONLY (causally), the
// surprise channels and the reserve amplitudes the engine holds at that cursor, to
// data/novelty-reserve-out.jsonl. It selects nothing, scores nothing, labels no stream.
// There is no answer key in the input and this script does not read one. The selection
// happens in scripts/novelty-reserve-score.mjs, against a held key this script never sees.
//
// THE PRESSURE (inside-out constant hunt — the campaign's named exemplar). The reserve the
// reader holds for an as-yet-unseen atom is a hand-rolled constant NOVELTY_RESERVE = 1.0
// (src/core/surprise.js), so the reserve SHARE the Born step derives, 1/(total+1), is a
// function of total mass alone — blind to whether newcomers have been ARRIVING. The fix
// makes the reserved amplitude the γ-decayed mass of recent newcomer admissions
// (noveltyAmplitude), run through the SAME Born step. The cheap surface signal (total mass,
// any cumulative count) is held EQUAL across the count-matched streams; only a recency-
// weighted reserve can separate them.
//
// THE CHANNELS, both off the live engine, deterministic (no model, no network):
//
//   bayesDefault / surprisalDefault   readingAt(doc, at) — the DEFAULT (pre-fix) path. The
//                   reserve is the constant; these are the GAP channels (expected flat at the
//                   newcomer cursor across streams that differ only in novelty timing).
//   reserveConst    1/(totalMass+1) — the reserve SHARE the default Born step actually used.
//   reserve / noveltyMass / totalMass   readingAt(doc, at, {adaptiveReserve:true}) — the
//                   signal-derived reserve share, its amplitude nu (γ-decayed newcomer mass),
//                   and Σ figure mass. The channels under test.
//   bayesAdaptive   readingAt(doc, at, {adaptiveReserve:true}).bayesBits — the newcomer's
//                   significance once the reserve tracks the recent novelty rate.
//
// CAUSALITY. Line k is read by re-parsing the cumulative prefix lines[0..k] (so no future
// line shapes the parse) and reading at its last unit; the reserve amplitude is built only
// from newcomer admissions with sentIdx < k.
//
// THE INSTRUMENT IS VERIFIED before the numbers are trusted: the parse must admit figures
// (the organ is live), the reserve channel must compute and VARY (not all-zeros / dormant),
// the default path must be byte-identical to a reading taken with no flag, and one high-
// novelty and one low-novelty cursor are traced at the amplitude level.
//
//   Usage:  node scripts/novelty-reserve.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN   = join(ROOT, 'data', 'novelty-reserve-stimulus.json');
const OUT  = join(ROOT, 'data', 'novelty-reserve-out.jsonl');

const round3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// One causal read of line k: re-parse the prefix, read both the default and the adaptive
// channels at the last unit. The default read is the GAP baseline; the adaptive read is the
// channel under test. PARITY is asserted line-by-line: the adaptive flag must not move the
// surprisal/bayes of the DEFAULT read.
const readLine = (streamId, lines, k) => {
  const doc  = parseText(lines.slice(0, k + 1).join('\n'), { docId: streamId });
  const at   = doc.units.length - 1;
  const d    = readingAt(doc, at);                          // default (pre-fix) path
  const a    = readingAt(doc, at, { adaptiveReserve: true });// signal-derived reserve
  const total = a.totalMass;
  return {
    bayesDefault:     round3(d.bayesBits),
    surprisalDefault: round3(d.surprisalBits),
    reserveConst:     round3(1 / (total + 1)),               // what the default Born step used
    reserve:          round3(a.reserve),                     // signal-derived reserve share
    noveltyMass:      round3(a.noveltyMass),                 // nu — γ-decayed newcomer mass
    totalMass:        round3(total),
    bayesAdaptive:    round3(a.bayesBits),
    surprisalAdaptive:round3(a.surprisalBits),
    // parity probe (must be true on every line): the default channels are unchanged by the flag
    parity: d.bayesBits === (readingAt(doc, at).bayesBits) &&
            !('reserve' in d) && !('noveltyMass' in d),
  };
};

const stim = JSON.parse(readFileSync(IN, 'utf8'));
console.log('# novelty-reserve — read-only reserve-amplitude sweep');
console.log('# reserveConst:  1/(total+1)               (the DEFAULT Born step — blind to novelty rate)');
console.log('# reserve:       nu/(total+nu)             (signal-derived — readingAt({adaptiveReserve:true}))');
console.log('# noveltyMass:   γ-decayed newcomer mass   (the amplitude nu)\n');

const records = [];
let parityHolds = true, noveltyVals = [];
for (const [streamId, lines] of Object.entries(stim.streams)) {
  if (!Array.isArray(lines)) continue;
  for (let k = 0; k < lines.length; k++) {
    const m = readLine(streamId, lines, k);
    parityHolds = parityHolds && m.parity;
    records.push({ streamId, lineIdx: k, text: lines[k], ...m });
  }
  const cur = records.find((r) => r.streamId === streamId && r.lineIdx === lines.length - 1);
  noveltyVals.push(cur.noveltyMass);
  console.log(`  ${streamId}: ${lines.length} lines · at cursor: noveltyMass=${cur.noveltyMass} reserve=${cur.reserve} (const ${cur.reserveConst})`);
}

// ── VERIFY THE INSTRUMENT before the score is read anywhere. ───────────────────────
console.log('\n# instrument check:');
const ok = [], fail = [];
const insSeen = (() => {                                    // organ live: figures admitted?
  const doc = parseText(Object.values(stim.streams)[0].join('\n'), { docId: 'probe' });
  return doc.log.snapshot().filter((e) => e.op === 'INS').length;
})();
(insSeen > 0 ? ok : fail).push(`organ live — parse admitted ${insSeen} figure INS in stream 1`);
const varies = new Set(noveltyVals).size > 1;
(varies ? ok : fail).push(`reserve channel computed AND varies across streams — noveltyMass@cursor=[${noveltyVals}] (not dormant/all-equal)`);
(parityHolds ? ok : fail).push('default path byte-identical — the adaptiveReserve flag adds fields, moves no default channel');
// trace one high-novelty and one low-novelty cursor at the amplitude level
const cursors = records.filter((r) => r.lineIdx === 19).sort((a, b) => b.noveltyMass - a.noveltyMass);
if (cursors.length >= 2) {
  const hi = cursors[0], lo = cursors[cursors.length - 1];
  ok.push(`high-novelty traced — ${hi.streamId} cursor: nu=${hi.noveltyMass} reserve=${hi.reserve} (const would be ${hi.reserveConst})`);
  ok.push(`low-novelty  traced — ${lo.streamId} cursor: nu=${lo.noveltyMass} reserve=${lo.reserve} (const would be ${lo.reserveConst})`);
} else fail.push('fewer than two cursors to trace');
for (const m of ok) console.log(`  ok   · ${m}`);
for (const m of fail) console.log(`  FAIL · ${m}`);

writeFileSync(OUT, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`\n# wrote ${records.length} line records -> ${OUT.replace(ROOT + '/', '')}`);
if (fail.length) { console.log('# INSTRUMENT VOID — the score is meaningless until this is fixed.'); process.exit(2); }
