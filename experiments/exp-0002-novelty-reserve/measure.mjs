// exp-0002 · MEASURE (read-only, key-blind) — the per-stream effect of the signal-derived
// reserve on predictive surprise. For each stream it reads every cursor twice — the default
// constant reserve (opts.signalReserve off) and the signal-derived reserve (on) — and emits
// the mean change in predictive surprisal (the −log₂ p channel the reserve directly shapes
// through pNovel / Z) and in significance (the KL channel). Negative = the signal-derived
// reserve predicted BETTER; positive = it predicted WORSE. The measure never reads the key.
//
//   node experiments/exp-0002-novelty-reserve/measure.mjs

import { parseText } from '../../src/perceiver/parse/index.js';
import { readingAt } from '../../src/perceiver/index.js';
import { streams, textOf } from './stimulus.mjs';

const round = (x) => Math.round(x * 1e4) / 1e4;

export const measure = () => streams.map(({ id, idx }) => {
  const doc = parseText(textOf(idx), { docId: id });
  let dSurp = 0, dBayes = 0, n = 0;
  for (let c = 1; c < idx.length; c++) {
    const off = readingAt(doc, c);
    const on  = readingAt(doc, c, { signalReserve: true });
    dSurp  += on.surprisalBits - off.surprisalBits;
    dBayes += on.bayesBits - off.bayesBits;
    n++;
  }
  return { id, deltaSurprisal: round(dSurp / n), deltaBayes: round(dBayes / n), steps: n };
});

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const r of measure()) console.log(JSON.stringify(r));
}
