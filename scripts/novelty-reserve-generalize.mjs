#!/usr/bin/env node
// novelty-reserve-generalize — the GENERALIZATION gate for the signal-derived reserve.
//
// A fix's fitness is how many INDEPENDENT pressures it lifts, not whether it passes the one
// that prompted it (the no-pleiotropy rule). This sweep re-runs the drought-vs-flurry
// dissociation across independent casts (names harvested from a fresh random Wikipedia title
// draw — page ids recorded below as the seed), across drought lengths, and across γ horizons.
// If the signal reserve only worked on the planted cast/length/γ it would be a brittle
// special-case; if it splits drought from flurry everywhere the constant cannot, it is a
// general sharpening of the one signal the engine runs on.
//
// READ-ONLY. Run: node scripts/novelty-reserve-generalize.mjs
//
// Seed of record (random list draw, rnnamespace=0): page ids 51483211, 24822868, 46972695,
// 13830115, 7818455, 29359194, 16777905, 65747920, 59196715, 56161586, 6013691, 69656852,
// 25491978, 65608769, 51416509, 8006402, 79624111, 56301766, 44361543, 233078.

import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// Names harvested from the random titles above (the concrete content; the FORM is the sweep).
const POOL = ['Gilbert', 'Piet', 'Stanley', 'Ernst', 'Juraj', 'Damir', 'George', 'Montebello',
              'Siege', 'Jump', 'Senator', 'Double'];
const r3 = (x) => Math.round(x * 1000) / 1000;

// Build a drought (incumbent recurs L times, then a newcomer) and a flurry (L distinct
// figures, then the SAME newcomer) from a cast slice. Standing mass is matched by construction.
const mk = (cast, L, newcomer) => ({
  drought: Array.from({ length: L }, () => `${cast[0]} entered.`).concat(`${newcomer} entered.`).join(' '),
  flurry:  cast.slice(0, L).map(n => `${n} entered.`).concat(`${newcomer} entered.`).join(' '),
});

const cases = [];
let castStart = 0;
for (const L of [4, 6, 8]) {
  for (const gamma of [0.5, 0.7, 0.9]) {
    const cast = [];
    for (let i = 0; i < L; i++) cast.push(POOL[(castStart + i) % POOL.length]);
    const newcomer = POOL[(castStart + L) % POOL.length];
    castStart += 1;                                  // shift the cast each case → independent content
    const { drought, flurry } = mk(cast, L, newcomer);
    const at = L;                                    // the test (newcomer) line
    const dOff = readingAt(parseText(drought, { docId: 'd' }), at, { gamma }).bayesBits;
    const fOff = readingAt(parseText(flurry,  { docId: 'f' }), at, { gamma }).bayesBits;
    const dOn  = readingAt(parseText(drought, { docId: 'd' }), at, { gamma, signalReserve: true }).bayesBits;
    const fOn  = readingAt(parseText(flurry,  { docId: 'f' }), at, { gamma, signalReserve: true }).bayesBits;
    cases.push({ L, gamma, cast: cast[0] + '…', newcomer, splitOff: r3(dOff - fOff), splitOn: r3(dOn - fOn) });
  }
}

console.log('  L  γ     incumbent  newcomer     OFF split   ON split   verdict');
let onWins = 0, offBlind = 0;
for (const c of cases) {
  const onSplits = c.splitOn > 0.1;
  const offFlat  = Math.abs(c.splitOff) < 0.02;
  if (onSplits) onWins++;
  if (offFlat)  offBlind++;
  console.log(`  ${c.L}  ${c.gamma}   ${c.cast.padEnd(10)} ${c.newcomer.padEnd(11)} ${String(c.splitOff).padStart(9)}  ${String(c.splitOn).padStart(9)}   ${onSplits && offFlat ? 'PASS' : 'fail'}`);
}
console.log(`\n  Generalization: ON splits drought≫flurry in ${onWins}/${cases.length} independent cases;`);
console.log(`                  OFF (constant) is blind in ${offBlind}/${cases.length}.`);
console.log(`  ${onWins === cases.length && offBlind === cases.length ? 'GENERAL — content/length/γ-independent. Not a brittle patch.' : 'PARTIAL — inspect the failing cases.'}`);
