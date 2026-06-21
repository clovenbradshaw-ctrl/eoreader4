// Let "the same note" emerge — no threshold, no a priori category.
//
// discover-harmonics.mjs MEASURED that a tone and its octave share the most
// overtones. This goes one step further and lets the engine ACT on it: form the
// category "these are one note". The only thing forbidden is a chosen number —
// no "merge above 0.4". The rule is purely relational: merge two tones iff each
// is the other's strongest overtone match (mutual nearest neighbour), and let
// the engine's union-find compose the merges. Octave equivalence is then not
// supplied and not even thresholded — it is whatever the overlap field, read by
// rank alone, turns out to group.

import { ingestFrequencies } from '../src/organs/in/frequency.js';
import { discoverEquivalences, mutualNearestPairs } from '../src/reader/index.js';

const hzOf = (doc, i) => doc.noteHz[i];
const showClasses = (doc, classes) => classes
  .map(c => c.length === 1
    ? `${hzOf(doc, c[0]).toFixed(1)}Hz (alone)`
    : `one note @ {${c.map(i => hzOf(doc, i).toFixed(1)).join(', ')}}Hz`)
  .forEach(s => console.log(`    • ${s}`));

// ---------------------------------------------------------------------------
// PART A — octaves collapse into one note; the fifth and third do not.
// ---------------------------------------------------------------------------
const tones = ingestFrequencies({
  name: 'around-A3',
  notes: [
    { hz: 110.0 }, { hz: 220.0 }, { hz: 440.0 }, { hz: 880.0 },  // four octaves of A
    { hz: 330.0 },   // a fifth   (3:2 of 220)
    { hz: 275.0 },   // a third   (5:4 of 220)
    { hz: 311.13 },  // a tritone (√2,  no small-integer ratio)
  ],
});

console.log('=== PART A · NOTES EMERGE (no threshold) ===');
console.log(`before: ${tones.projectGraph().entities.size} entities — every frequency its own thing.\n`);

console.log('mutual-nearest pairs (each tone\'s strongest match, where it\'s mutual):');
for (const { i, j, score } of mutualNearestPairs(tones)) {
  console.log(`    ${hzOf(tones, i).toFixed(1)}Hz ⟷ ${hzOf(tones, j).toFixed(1)}Hz   (overlap ${score.toFixed(3)})`);
}

const { classes } = discoverEquivalences(tones);   // appends SYN merges to the log
console.log(`\nafter the engine collapses them: ${tones.projectGraph().entities.size} entities.`);
console.log('the categories that emerged:');
showClasses(tones, classes);
console.log('\nThe four octaves of A became ONE note; the fifth, third, and tritone each');
console.log('stayed separate. No number decided this — only "is this tone\'s strongest');
console.log('match the one whose strongest match is this tone". Octave equivalence is the');
console.log('output of the grouping, never its input.');

// ---------------------------------------------------------------------------
// PART B — the honest twist: the category is RELATIVE, not absolute.
// ---------------------------------------------------------------------------
// With no octave present, the grouping has no a priori "octave" to find. It
// latches onto the strongest relation that IS there — which for a bare fifth is
// the fifth. That is not a bug; it is the whole claim. There is no stored idea
// of a note, so "sameness" is always relative to what the signal offers.
const noOctave = ingestFrequencies({ name: 'fifth-only', notes: [{ hz: 220 }, { hz: 330 }] });
const { classes: c2 } = discoverEquivalences(noOctave);
console.log('\n=== PART B · THE CATEGORY IS RELATIVE, NOT ABSOLUTE ===');
console.log('give it only 220Hz and 330Hz — a fifth, no octave anywhere:');
showClasses(noOctave, c2);
console.log('With no octave to be the strongest relation, the strongest relation present');
console.log('(the fifth) is what gets grouped. The reader has no a priori note to recognise —');
console.log('so what counts as "the same note" shifts with what the world hands it. That is');
console.log('exactly what you\'d predict if the category is emergent and not a stored concept.');
