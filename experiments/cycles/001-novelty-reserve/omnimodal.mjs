#!/usr/bin/env node
// THE OMNIMODAL TEST (the strongest pressure). The calibrated reserve lives in the interior
// (core/surprise.js, bornNoveltyReserve) and is driven by readingAt, which knows nothing of
// modality. If the fix is truly interior, the SAME readingAt path must separate a high-novelty
// MELODY from a low-novelty one exactly as it separated the text streams — no text in sight.
// A capability confirmed in one modality is a hypothesis; confirmed in two, it is the interior.
import { ingestMusic } from '../../../src/organs/in/music.js';
import { readingAt } from '../../../src/perceiver/index.js';

const ALPHA = 0.05;
// high: a chromatic climb — a new pitch class almost every beat (steady novelty).
const high = ['C4','C#4','D4','D#4','E4','F4','F#4','G4','G#4','A4','A#4','B4'];
// low: a three-note motif repeated — after beat 2, pure recurrence.
const low  = ['C4','E4','G4','C4','E4','G4','C4','E4','G4','C4','E4','G4'];
// regime shift (CONTROL): six fresh pitches, then the motif settles in (novelty stops).
const shift= ['C4','C#4','D4','D#4','E4','F4','C4','C#4','D4','D#4','E4','F4'];

const reserves = (notes, calibrate) => {
  const doc = ingestMusic({ name: 'mel', notes });
  const r = [];
  for (let k = 0; k < doc.units.length; k++) {
    const pn = readingAt(doc, k, { forward: true, calibrateReserve: calibrate, alpha: ALPHA }).pNext;
    r.push(pn ? pn.reserve : null);
  }
  return r;
};
const f = (xs) => xs.map(x => x == null ? ' null' : x.toFixed(3)).join(' ');
const lastOf = (xs) => xs[xs.length - 1];

console.log('# omnimodal cross-check — MUSIC modality, the SAME readingAt interior.\n');
for (const [name, notes] of [['high', high], ['low', low], ['shift(CONTROL)', shift]]) {
  console.log(`${name.padEnd(15)} fixed: ${f(reserves(notes, false))}`);
  console.log(`${''.padEnd(15)} born : ${f(reserves(notes, true))}`);
}

const hB = reserves(high, true), lB = reserves(low, true), sB = reserves(shift, true);
const hF = reserves(high, false), lF = reserves(low, false);
const sep = lastOf(hB) - lastOf(lB);
const fixedSep = Math.abs(lastOf(hF) - lastOf(lF));
const ctrlFalls = lastOf(sB) < 0.5 * sB[5];
console.log(`\nSPLIT (music): born high ${lastOf(hB).toFixed(3)} vs low ${lastOf(lB).toFixed(3)}  Δ=${sep.toFixed(3)}  | fixed Δ=${fixedSep.toFixed(3)}`);
console.log(`CONTROL (music): born shift ${sB[5].toFixed(3)} -> ${lastOf(sB).toFixed(3)}  falls=${ctrlFalls}`);
const ok = sep > 0.2 && fixedSep < 0.05 && ctrlFalls;
console.log(`\nOMNIMODAL VERDICT: ${ok ? 'CONFIRMED — the SAME interior reserve calibration separates melodies as it separates text. It is the interior.' : 'NOT CONFIRMED (text-only → a leak).'}`);
process.exit(ok ? 0 : 1);
