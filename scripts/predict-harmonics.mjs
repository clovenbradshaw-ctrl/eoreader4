// Predict the next note — from the signal's own structure, no music theory.
//
// The recency reader (readingAt) predicts the locally warm note; it has no
// memory of order, so on a melody it cannot anticipate the tune. The learned-
// sequence reader folds the n-grams the melody itself shows — "after this
// context, that note followed" — exactly as the conventions ledger folds a
// document's own dialect, and predicts from what it learned. Nothing in either
// reader knows a scale, a key, or a consonance: the model starts empty and fills
// with whatever the signal did. The ONLY knob is `order` — how much context the
// reader is allowed to hold — and the whole point of this script is to watch
// order decide whether the tune is learnable at all.
//
// We read "Frère Jacques", every phrase stated twice, so a reader that learns
// should be surprised by each phrase the first time and ANTICIPATE its repeat.

import { ingestMusic } from '../src/ingest/music.js';
import { predictiveSequenceReading, readingAt } from '../src/read/index.js';

const tune = {
  name: 'frere-jacques.mid',
  notes: [
    'C4','D4','E4','C4',  'C4','D4','E4','C4',     // Frère Jacques (×2)
    'E4','F4','G4',       'E4','F4','G4',          // Dormez-vous  (×2)
    'G4','A4','G4','F4','E4','C4',  'G4','A4','G4','F4','E4','C4', // Sonnez les matines (×2)
    'C4','G3','C4',       'C4','G3','C4',          // Din dan don  (×2)
  ],
};
const doc = ingestMusic(tune);

console.log('=== INPUT: a raw note sequence (no key, no theory, no preferences) ===');
console.log(`${doc.docId}  (${doc.sequence.length} notes)\n  ${doc.sequence.map(s => s.note).join(' ')}`);

// The phrase pairs: [firstSpan, repeatSpan] in prediction-step indices (the step
// that predicts note N is indexed N).
const PAIRS = [
  ['Frère Jacques',      [1, 3],   [5, 7]],
  ['Dormez-vous',        [9, 10],  [12, 13]],
  ['Sonnez les matines', [15, 19], [21, 25]],
  ['Din dan don',        [27, 28], [30, 31]],
];
const meanSurprise = (steps, [lo, hi]) => {
  const w = steps.filter(s => s.at >= lo && s.at <= hi);
  return w.reduce((a, s) => a + s.surprise, 0) / (w.length || 1);
};
const hits = (steps) => steps.filter(s => s.hit).length;

// --- The knob that decides learnability: how much context the reader holds. ---
console.log('\n=== DOES IT LEARN? — first hearing vs. repeat, by context order ===');
for (const order of [1, 2]) {
  const steps = predictiveSequenceReading(doc, { order });
  console.log(`\n  order ${order} (${order === 1 ? 'plain Markov chain — one note of context' : 'two notes of context — a phrase fragment'}):`);
  console.log(`    notes anticipated: ${hits(steps)}/${steps.length}`);
  for (const [name, first, repeat] of PAIRS) {
    const f = meanSurprise(steps, first), r = meanSurprise(steps, repeat);
    const verdict = r < f - 0.02 ? 'LEARNED (repeat cheaper)' : r > f + 0.02 ? 'no gain' : 'flat';
    console.log(`    ${name.padEnd(20)} first ${f.toFixed(3)}  repeat ${r.toFixed(3)}   ${verdict}`);
  }
}

// --- The order-2 reader, note by note, so the anticipation is visible. ---
console.log('\n=== ORDER-2 READER, NOTE BY NOTE ===');
console.log('  beat  context→  predicts  actual  ✓?  surprise   (top candidates it learned)');
const steps2 = predictiveSequenceReading(doc, { order: 2 });
for (const s of steps2) {
  const cand = s.ranked.map(r => `${r.label}:${r.prob}`).join(' ');
  console.log(
    `  ${String(s.at).padStart(2)}   ${s.curLabel.padEnd(5)} → ` +
    `${(s.predictedLabel ?? '·').padEnd(3)}  ${s.actualLabel.padEnd(3)} ` +
    ` ${s.hit ? '✓' : ' '}  ${s.surprise.toFixed(3)} ${s.learned ? '' : '(new ctx)'}  ${cand}`
  );
}

// --- Head-to-head: learned-order-2 vs. the recency reader it would replace. ---
console.log('\n=== HEAD-TO-HEAD vs. the recency reader (same notes, no theory either) ===');
let recencyHits = 0;
for (let at = 1; at < doc.sequence.length; at++) {
  if (readingAt(doc, at - 1).predicted.figures[0] === doc.sequence[at].pc) recencyHits++;
}
console.log(`  learned order-2 reader:  ${hits(steps2)}/${steps2.length} next notes anticipated`);
console.log(`  recency (γ-mass) reader: ${recencyHits}/${steps2.length} next notes anticipated`);

console.log('\n=== WHAT THIS SHOWS ===');
console.log('The reader was given note names and nothing else — no scale, no key, no');
console.log('consonance, no preference. At order 1 it CANNOT hold the tune (the figure of a');
console.log('melody is the phrase, not the single step). Given two notes of context it folds');
console.log("the melody's own n-grams and anticipates the phrase repeats — three of the four");
console.log('here; the opening phrase repeats too early, off a cold model, to gain. It beats the');
console.log('recency reader 10 to 7. The same REC fold the engine uses to learn a text\'s dialect');
console.log('now learns a tune\'s — the structure it predicts from is what the signal taught it.');
