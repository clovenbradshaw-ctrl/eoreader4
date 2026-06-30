// Grain-nested prediction on music — does composing a small note-grain model with
// a phrase-grain model beat just raising the n-gram order? (src/predict/grained.js)
//
// The flat sequence reader predicts the next note from ONE grain. A melody is
// grained (note → phrase → piece); a single flat n-gram must pick one grain and
// lose the others, and raising its order to reach the phrase saturates. This
// composes the note grain (Figure, INS) with a learned phrase grain (Pattern,
// SYN/REC over phrase identities, generalised by overlap equivalence), routing to
// the phrase grain only where the note grain is unsure — the cube guard as a gate.
//
// The result: order-1 Figure + Pattern beats flat order-2 AND order-3. Two small
// models compose to exceed a bigger one — the "small models as the engine" thesis,
// with a random control elsewhere showing no spurious lift. Run: npm run grained.

import { ingestMusic } from '../src/organs/in/music.js';
import { predictiveSequenceReading } from '../src/surfer/sequence.js';
import { predictGrained, gradeGrained } from '../src/predict/index.js';

// Frère Jacques played TWICE — so phrase transitions are seen more than once and
// the Pattern grain can warm up (a real piece repeats; a 32-note toy barely does).
const oncePhrases = [
  ['C4','D4','E4','C4'], ['C4','D4','E4','C4'],
  ['E4','F4','G4'], ['E4','F4','G4'],
  ['G4','A4','G4','F4','E4','C4'], ['G4','A4','G4','F4','E4','C4'],
  ['C4','G3','C4'], ['C4','G3','C4'],
];
const phrases = [...oncePhrases, ...oncePhrases];     // ×2
const notes = phrases.flat();
const boundaries = []; { let c=0; for (const p of phrases){ boundaries.push(c); c+=p.length; } }
const doc = ingestMusic({ name: 'frere2', notes });

const flatRate = (order) => {
  const steps = predictiveSequenceReading(doc, { order });
  const h = steps.filter(s => s.hit).length;
  return { h, n: steps.length, rate: h/steps.length };
};
const grainRate = (order) => gradeGrained(predictGrained(doc, { order, boundaries }));

console.log(`Frère Jacques ×2  (${notes.length} notes, ${phrases.length} phrases)\n`);
console.log('THE THESIS: does FIGURE(small) + PATTERN beat just raising the n-gram order?\n');
const f1 = flatRate(1), f2 = flatRate(2), f3 = flatRate(3);
const g1 = grainRate(1), g2 = grainRate(2);
const pct = x => (100*x).toFixed(0)+'%';
console.log(`flat n-gram order 1 (Markov)          ${f1.h}/${f1.n}  ${pct(f1.rate)}`);
console.log(`flat n-gram order 2                    ${f2.h}/${f2.n}  ${pct(f2.rate)}`);
console.log(`flat n-gram order 3                    ${f3.h}/${f3.n}  ${pct(f3.rate)}`);
console.log(`grain-nested: order-1 Figure + Pattern ${g1.composite.hits}/${g1.n}  ${pct(g1.composite.rate)}   (vs its own Figure ${pct(g1.figure.rate)}, lift ${g1.lift>=0?'+':''}${pct(g1.lift)})`);
console.log(`grain-nested: order-2 Figure + Pattern ${g2.composite.hits}/${g2.n}  ${pct(g2.composite.rate)}   (vs its own Figure ${pct(g2.figure.rate)}, lift ${g2.lift>=0?'+':''}${pct(g2.lift)})`);
console.log(`\nboundary notes (order-2): Figure ${g2.boundary.figureHits}/${g2.boundary.n} → composite ${g2.boundary.compositeHits}/${g2.boundary.n}`);
