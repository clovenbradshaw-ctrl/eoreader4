// cycle-0001 — MEASURE (read-only). Emits every relevant channel per item, over prior
// context only (the probe at cursor k sees the k context units before it). Touches no
// production code; the suite stays byte-identical. The run can come back negative.
//
// Channels per item, in TWO senses and BOTH flag states:
//   text.surprisalBits  — the figure reserve channel (reading.js): −log₂ of the reserve a
//                         newcomer falls back to.
//   text.bayesBits      — the significance channel (the D_KL the surfer rides).
//   seq.pNovel          — the n-gram continuation reserve (sequence.js): the same reserve,
//                         a second sense reading the same abstract stream.
//
// The measure is BLIND: it reads the stimulus, not the key. It does not know which item is
// churn, which is settled, which is the control — it just emits the numbers.

import { readingAt } from '../../src/perceiver/index.js';
import { predictiveSequenceReading } from '../../src/surfer/index.js';
import { unitStream, ITEMS } from './stimulus.mjs';

const measureItem = (it, adaptiveNovelty) => {
  const doc = unitStream([...it.context, it.probe]);
  const r = readingAt(doc, it.context.length, { adaptiveNovelty });
  const steps = predictiveSequenceReading(doc, { order: 2, adaptiveNovelty });
  const probeStep = steps[steps.length - 1];
  return {
    item: it.id,
    text: { surprisalBits: r.surprisalBits, bayesBits: r.bayesBits },
    seq: { pNovel: probeStep.pNovel, surprise: probeStep.surprise },
  };
};

export const measure = () => ({
  off: ITEMS.map(it => measureItem(it, false)),
  on:  ITEMS.map(it => measureItem(it, true)),
});

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = measure();
  // INSTRUMENT CHECK first (methodology step 5): the channels computed, not all-zeros/NaN.
  const live = [...out.off, ...out.on].every(m =>
    Number.isFinite(m.text.surprisalBits) && Number.isFinite(m.text.bayesBits) && Number.isFinite(m.seq.pNovel));
  console.log(`instrument: channels computed = ${live}`);
  for (const flag of ['off', 'on']) {
    console.log(`\n--- flag ${flag} ---`);
    for (const m of out[flag]) {
      console.log(`  item ${m.item}: text.surprisal=${m.text.surprisalBits} text.bayes=${m.text.bayesBits} seq.pNovel=${m.seq.pNovel}`);
    }
  }
  // Emit JSON for the scorer.
  if (process.argv.includes('--json')) console.log('\n' + JSON.stringify(out));
}
