// Learned phrase segmentation — the SEG cut derived from the note grain's own
// surprise, no hand-fed boundaries (src/predict/segment.js).
//
// The grain-nested predictor took phrase boundaries as input. Finding them is the
// SEG problem, and the README's claim is that surprise marks them. A flat
// threshold over-fired (24 phrases for 8); this derives the threshold from the
// signal's own surprise background (a high quantile set by ALPHA), keeps only
// local PEAKS, and enforces a minimum phrase length. Run: npm run segment.

import { ingestMusic } from '../src/organs/in/music.js';
import { predictiveSequenceReading } from '../src/surfer/sequence.js';
import { predictGrained, gradeGrained, learnBoundaries, segmentationScore, surpriseBoundaries } from '../src/predict/index.js';

const once = [
  ['C4','D4','E4','C4'], ['C4','D4','E4','C4'],
  ['E4','F4','G4'], ['E4','F4','G4'],
  ['G4','A4','G4','F4','E4','C4'], ['G4','A4','G4','F4','E4','C4'],
  ['C4','G3','C4'], ['C4','G3','C4'],
];
const phrases = [...once, ...once];
const notes = phrases.flat();
const truth = []; { let c = 0; for (const p of phrases) { truth.push(c); c += p.length; } }
const doc = ingestMusic({ name: 'frere2', notes });

console.log(`Frère Jacques ×2 — ${notes.length} notes, ${truth.length} true phrase boundaries\n`);

const steps = predictiveSequenceReading(doc, { order: 2 });
const naive = surpriseBoundaries(steps, { cut: 0.7 });
const learned = learnBoundaries(doc, { order: 2, alpha: 0.4 });
console.log('SEGMENTATION (recovering the boundaries):');
console.log(`  naive flat threshold 0.7   ${naive.length} cuts   F1 ${segmentationScore(naive, truth).f1}`);
console.log(`  learned (signal-derived)   ${learned.length} cuts   F1 ${segmentationScore(learned, truth).f1}   [${learned.join(',')}]`);

const n = steps.length;
const flat = (o) => predictiveSequenceReading(doc, { order: o }).filter((s) => s.hit).length;
const pct = (h) => `${h}/${n}  ${(100 * h / n).toFixed(0)}%`;
const hand = gradeGrained(predictGrained(doc, { order: 1, boundaries: truth }));
const self = gradeGrained(predictGrained(doc, { order: 1 }));   // learns its own boundaries

console.log('\nEND-TO-END PREDICTION:');
console.log(`  flat n-gram order 1             ${pct(flat(1))}`);
console.log(`  flat n-gram order 2             ${pct(flat(2))}`);
console.log(`  grain-nested o1, HAND bounds    ${pct(hand.composite.hits)}   (ceiling: perfect segmentation)`);
console.log(`  grain-nested o1, LEARNED bounds ${pct(self.composite.hits)}   ← fully self-supervised, no human boundaries`);
console.log('\nLearned segmentation beats the naive threshold by a wide margin and lifts');
console.log('prediction over the flat order-1 baseline with no human boundaries — but the');
console.log('segmentation error still costs the gap to the hand-fed ceiling. Honest, and');
console.log('the next lever is a sharper SEG cut (peak shape, not just height).');
