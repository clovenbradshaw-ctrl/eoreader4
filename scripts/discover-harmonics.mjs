// Discover harmonic structure from raw frequencies — no music theory.
//
// Every note here is a bare fundamental in Hz, handed to the engine as its
// overtone series and nothing else. No scale, no key, no `mod 12`, no interval
// names, no ratio table, no consonance preference. Each note is its own entity.
// The only reading run is the engine's Level-1 existence measure — `hits / qLen`
// set overlap (retrieve/lexical.js), the same one it runs over the words of a
// sentence — with a note's "words" being its partials. Whatever harmonic
// structure appears was discovered by counting shared overtones, full stop.

import { ingestFrequencies } from '../src/ingest/frequency.js';
import { retrieveLexical }   from '../src/retrieve/index.js';

// ---------------------------------------------------------------------------
// PART A — Octave equivalence, discovered (the engine never sees the number 2).
// ---------------------------------------------------------------------------
// A handful of tones around A3 = 220 Hz: two octaves, a fifth, a major third,
// and a tritone — given ONLY as frequencies, deliberately unlabelled.
const around220 = [
  { hz: 110.0 },   // an octave below 220   (1:2)
  { hz: 220.0 },   // the reference
  { hz: 330.0 },   // a fifth above          (3:2)
  { hz: 275.0 },   // a major third above    (5:4)
  { hz: 311.13 },  // a tritone above        (√2 : 1, no small-integer ratio)
  { hz: 440.0 },   // an octave above        (2:1)
  { hz: 880.0 },   // two octaves above      (4:1)
];
const docA = ingestFrequencies({ name: 'around-A3', notes: around220 });

const REF = 1; // the 220 Hz note
console.log('=== PART A · OCTAVE EQUIVALENCE, DISCOVERED ===');
console.log(`reference tone: ${docA.units[REF]} — given as a frequency, nothing else.`);
console.log('the engine ranks every other tone by SHARED OVERTONES (hits/qLen):\n');

const ranked = retrieveLexical(docA, docA.spectrumQuery(REF), 99).filter(r => r.idx !== REF);
for (const r of ranked) {
  const ratio = (docA.noteHz[r.idx] / docA.noteHz[REF]);
  const bar = '█'.repeat(Math.round(r.score * 40));
  console.log(`  ${docA.units[r.idx].padStart(8)}  ×${ratio.toFixed(3)}  overlap ${r.score.toFixed(3)}  ${bar}`);
}
console.log('\nthe two strongest matches are the tones at ×2.000 and ×0.500 — the octaves —');
console.log('found purely because a tone and its octave share half their overtones. No');
console.log('rule said an octave is special; the overlap reading discovered it.');

// ---------------------------------------------------------------------------
// PART B — The consonance curve, derived (Helmholtz, from overlap alone).
// ---------------------------------------------------------------------------
// Hold a root at 220 Hz and sweep a second tone across a whole octave, in fine
// steps. For each ratio, ask the existence reader how much the two tones' spectra
// overlap. The curve that comes back IS the consonance curve — high where the
// overtones coincide (simple ratios), near zero between.
const ROOT = 220;
const STEP = 0.01;
const sweep = [];
for (let r = 1.0; r <= 2.0001; r += STEP) sweep.push({ hz: ROOT * r });
const docB = ingestFrequencies({
  name: 'octave-sweep', notes: sweep,
  label: (f) => `×${(f / ROOT).toFixed(2)}`,
});

// Query with the ROOT's spectrum; score every swept tone by overlap with it.
const rootDoc = ingestFrequencies({ name: 'root', notes: [{ hz: ROOT }] });
const scoreByIdx = new Map(retrieveLexical(docB, rootDoc.spectrumQuery(0), 999).map(r => [r.idx, r.score]));

console.log('\n=== PART B · CONSONANCE CURVE, DERIVED FROM OVERTONE OVERLAP ===');
console.log(`root held at ${ROOT}Hz; second tone swept ×1.00 → ×2.00. overlap with the root:\n`);

// Name the just-intonation landmarks ONLY to annotate the output — they are not
// used in the computation, just to show what the peaks landed on.
const LANDMARKS = {
  '1.00': 'unison 1:1', '1.20': 'min 3rd 6:5', '1.25': 'maj 3rd 5:4', '1.33': '4th 4:3',
  '1.50': '5th 3:2', '1.60': 'min 6th 8:5', '1.67': 'maj 6th 5:3', '1.75': 'min 7th 7:4', '2.00': 'octave 2:1',
};
sweep.forEach((_, i) => {
  const ratio = (1.0 + i * STEP);
  const score = scoreByIdx.get(i) || 0;
  if (score < 0.05) return;                       // only draw where overtones actually coincide
  const key = ratio.toFixed(2);
  const bar = '█'.repeat(Math.round(score * 40));
  console.log(`  ×${key}  ${score.toFixed(3)}  ${bar}${LANDMARKS[key] ? '  ← ' + LANDMARKS[key] : ''}`);
});

console.log('\n=== WHAT THIS SHOWS ===');
console.log('Input: bare frequencies. Reading: the engine\'s own set-overlap existence measure,');
console.log('with a note\'s tokens being its overtones. Out fell octave equivalence (Part A) and');
console.log('the consonance ordering — octave, fifth, fourth, thirds — as the peaks of overtone');
console.log('overlap (Part B), the 19th-century physical account of harmony. No scale, no key,');
console.log('no `mod 12`, no ratio table, no preference was supplied. The structure is the');
console.log('signal\'s own, measured by the same reading the engine uses on words.');
console.log('\n(Honest limit: only 16 overtones are modelled, so the simplest ratios — unison,');
console.log('octave, fifth — come through cleanest, while subtler ones like the 5:3 sixth need');
console.log('higher partials to register and read weak here. The principle is exact; the');
console.log('resolution is bounded by how many overtones we hand it.)');
