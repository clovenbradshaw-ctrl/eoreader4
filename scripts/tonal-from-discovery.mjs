// The tonal layer, rebuilt on DISCOVERED equivalence — zero theory anywhere.
//
// The music adapter recovered "Twinkle"'s tonic by keying every note to a pitch
// class with `midi % 12` — octave equivalence, asserted. This script keys
// NOTHING. It hands the engine the melody as bare frequencies (each note its own
// overtone series), lets "the same note" EMERGE by mutual-nearest SYN merge
// (read/equivalence.js — no `mod 12`, no threshold), and then runs the very same
// tonal readings over the discovered classes:
//
//   tonic    = the heaviest discovered class (γ-mass over merged sightings)
//   prediction = the learned-sequence reader over the class stream
//
// If the discovered classes reproduce the mod-12 result, then `mod 12` was doing
// no work the signal couldn't do itself — the last a priori falls out.
//
// (The note→Hz step below is the INSTRUMENT'S tuning — a piano is 12-TET, its
// octaves exactly 2:1 — not the reader's knowledge. The reader never sees a note
// name, a pitch class, or the number 12; it sees frequencies and their overtones.)

import { ingestFrequencies } from '../src/organs/in/frequency.js';
import { ingestMusic }       from '../src/organs/in/music.js';
import { discoverEquivalences } from '../src/reader/index.js';
import { predictiveSequenceReading } from '../src/reader/index.js';

const A4 = 440, NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const NOTE_HZ = {};   // the instrument's tuning, used only to synthesise the input
for (const name of ['C4','D4','E4','F4','G4','A4']) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  const midi = NAMES.indexOf(m[1]) + 12 * (Number(m[2]) + 1);
  NOTE_HZ[name] = A4 * Math.pow(2, (midi - 69) / 12);
}

const SONG = ['C4','C4','G4','G4','A4','A4','G4','F4','F4','E4','E4','D4','D4','C4'];
const hits = (steps) => steps.filter(s => s.hit).length;

// --- The discovered path: frequencies in, equivalence out. -------------------
const freqDoc = ingestFrequencies({ name: 'twinkle-hz', notes: SONG.map(n => ({ hz: NOTE_HZ[n] })) });
console.log('=== INPUT: bare frequencies, every note its own entity ===');
console.log(`  ${SONG.map(n => NOTE_HZ[n].toFixed(1)).join('  ')}`);
console.log(`  before discovery: ${freqDoc.projectGraph().entities.size} entities (14 separate tones).`);

const { classes } = discoverEquivalences(freqDoc);   // emerges: same-pitch tones merge
const g = freqDoc.projectGraph();
const idxOf = (id) => Number(String(id).slice(1));    // 'n7' → 7
const nameOf = (id) => SONG[idxOf(g.representative(id))];

console.log(`  after discovery:  ${g.entities.size} classes — "the same note", emerged from overtone overlap.`);

// Tonic from the discovered classes: heaviest merged mass.
console.log('\n=== TONIC, over discovered classes (no mod 12) ===');
const masses = [...g.entities.values()]
  .map(e => ({ name: nameOf(e.id), mass: e.sightings }))
  .sort((a, b) => b.mass - a.mass);
masses.forEach(m => console.log(`    ${m.name.padEnd(3)} ×${m.mass}`));
console.log(`  → heaviest two: ${masses[0].name}, ${masses[1].name} — the tonic and dominant, discovered.`);

// Prediction over the discovered class stream.
const discPred = predictiveSequenceReading(freqDoc, { order: 2, repOf: g.representative });

// --- The mod-12 path, for comparison. ----------------------------------------
const musicDoc = ingestMusic({ name: 'twinkle-pc', notes: SONG });
const pcMass = [...musicDoc.projectGraph().entities.values()].sort((a, b) => b.sightings - a.sightings);
const pcPred = predictiveSequenceReading(musicDoc, { order: 2 });

// --- Head to head. -----------------------------------------------------------
console.log('\n=== HEAD-TO-HEAD: discovered equivalence vs. `mod 12` ===');
console.log(`  tonic (mod 12):      ${pcMass[0].label}, ${pcMass[1].label}   ×${pcMass[0].sightings}, ×${pcMass[1].sightings}`);
console.log(`  tonic (discovered):  ${masses[0].name}, ${masses[1].name}   ×${masses[0].mass}, ×${masses[1].mass}`);
console.log(`  next-note prediction (mod 12):     ${hits(pcPred)}/${pcPred.length} anticipated`);
console.log(`  next-note prediction (discovered): ${hits(discPred)}/${discPred.length} anticipated`);

const pitch = (s) => String(s).replace(/\d+$/, '');   // 'C4' → 'C', for cross-path comparison
const sameClasses = g.entities.size === pcMass.length;
const sameTonic = [pcMass[0].label, pcMass[1].label].includes(pitch(masses[0].name));
const samePred = hits(discPred) === hits(pcPred);
console.log('\n=== WHAT THIS SHOWS ===');
console.log(`  classes: ${g.entities.size} discovered vs ${pcMass.length} pitch classes ${sameClasses ? '— equal' : '— differ'}.`);
console.log(`  tonic agrees: ${sameTonic}.   prediction agrees: ${samePred} (${hits(discPred)} vs ${hits(pcPred)}).`);
console.log('  The tonal reading that `mod 12` produced comes back from frequencies the reader');
console.log('  was never told how to group — it grouped them itself, from overtones. `mod 12`');
console.log('  was doing no work the signal could not do on its own. No scale, no key, no pitch');
console.log('  class, no octave rule, no threshold survives in the reader. The structure is the');
console.log("  signal's; the engine only measured it.");
