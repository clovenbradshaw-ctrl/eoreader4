// E002 measure — READ-ONLY. Walks the cursor over a real article's content-token
// arrival stream and reads, at each step, the held-out predictive surprisal
// (−log2 p of what actually arrived) the reading assigned under prior context
// only — a PROPER SCORING RULE, scored causally. Compares the fixed (constant)
// reserve against the signal-derived reserve, on the ordered stream and on a
// seeded shuffle of the same tokens. Touches no production code.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLog } from '../../../src/core/index.js';
import { readingAt } from '../../../src/perceiver/reading.js';
import { makeRng, hashSeed } from '../../lib/rng.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const stim = JSON.parse(readFileSync(join(HERE, 'stimulus.json'), 'utf8'));

const streamDoc = (seq) => {
  const log = createLog({ docId: 'e2' });
  seq.forEach((tok, i) => log.append({ op: 'INS', id: tok, label: tok, sentIdx: i }));
  return { units: seq.slice(), sentences: seq.slice(), log };
};

// Mean held-out predictive surprisal over the stream, under one reserve mode.
// Scored from step 1 (step 0 is the opening, surprisal 0 by definition).
const meanSurprisal = (seq, signalReserve) => {
  const doc = streamDoc(seq);
  let sum = 0, n = 0;
  for (let at = 1; at < seq.length; at++) {
    const r = readingAt(doc, at, { signalReserve });
    sum += r.surprisalBits; n++;
  }
  return n ? sum / n : 0;
};

// Seeded Fisher-Yates — deterministic from the seed of record, so the shuffle is
// replayable. Destroys the temporal structure of novelty; keeps the exact token
// multiset (identical vocabulary and total novelty).
const shuffle = (seq, seed) => {
  const a = seq.slice(); const rng = makeRng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const seq = stim.stream;
const shuf = shuffle(seq, hashSeed(stim.seedOfRecord.title + ':' + stim.seedOfRecord.revid));

const ordered = { fixed: meanSurprisal(seq, false), signal: meanSurprisal(seq, true) };
const shuffled = { fixed: meanSurprisal(shuf, false), signal: meanSurprisal(shuf, true) };

const out = {
  experiment: 'E002-reserve-calibration',
  tokens: seq.length,
  ordered: {
    meanSurprisalFixed: round4(ordered.fixed),
    meanSurprisalSignal: round4(ordered.signal),
    improvement: round4(ordered.fixed - ordered.signal),
  },
  shuffled: {
    meanSurprisalFixed: round4(shuffled.fixed),
    meanSurprisalSignal: round4(shuffled.signal),
    improvement: round4(shuffled.fixed - shuffled.signal),
  },
  instrument: {
    // Verify the channel computed (non-trivial surprisal) and the organ is live.
    streamLive: seq.length > 50,
    nonTrivial: ordered.fixed > 0.1 && ordered.signal > 0.1,
  },
};
writeFileSync(join(HERE, 'measure-out.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`E002 measured: ${seq.length} tokens. ordered improvement=${out.ordered.improvement} `
  + `shuffled improvement=${out.shuffled.improvement}`);

function round4(x) { return Math.round(x * 10000) / 10000; }
