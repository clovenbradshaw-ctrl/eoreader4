import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';
import { ingestFrequencies } from '../src/organs/in/frequency.js';
import { surpriseAt, noveltyRateProfile } from '../src/core/index.js';

// REGRESSION LOCK — the signal-derived novelty reserve (evo/experiments/reserve-rate).
//
// Confirmed capability: the novelty reserve tracks the recent novelty rate of the
// signal's own history. After a burst of newcomers the reserve is high and a further
// newcomer is expected (belief barely moves); after a long stretch of confirmation the
// reserve is low and a newcomer is unexpected (belief moves far). The CONSTANT reserve
// is blind to this; the SIGNAL reserve carries the context as an amplitude through the
// FIXED Born step. Confirmed in TWO senses (text + frequency) → interior.
//
// This lock fails the day a precondition changes — INCLUDING THE CONTROL. If the constant
// reserve stops being blind, or the default stops being byte-identical, or the signal
// reserve stops separating in the predicted direction, this trips rather than passing.

const GAMMA = 0.7;
const round = (x) => Math.round(x * 100) / 100;

// --- The parity precondition: the default path is the constant reserve, byte-identical. --
test('lock/parity: default reading == constant reserve (the signal path is off by default)', () => {
  const doc = parseText('Ana arrived. Bob arrived. Cy arrived. Dan arrived. Zed arrived.', { docId: 'p' });
  const at = doc.units.length - 1;
  assert.equal(readingAt(doc, at).bayesBits, readingAt(doc, at, { reserve: 'const' }).bayesBits,
    'omitting reserve must equal reserve:const — the goldens are untouched');
});

// --- TEXT: the control is blind, the mechanism separates, on a matched newcomer pair. ----
test('lock/text: const reserve BLIND, signal reserve separates (turnover < stable)', () => {
  const turnover = parseText('Ana arrived. Bob arrived. Cy arrived. Dan arrived. Zed arrived.', { docId: 't' });
  const stable   = parseText('Ana arrived. Ana waited. Ana waited. Ana waited. Zed arrived.', { docId: 's' });
  const at = 4;
  const tC = readingAt(turnover, at, { reserve: 'const' }).bayesBits;
  const sC = readingAt(stable,   at, { reserve: 'const' }).bayesBits;
  const tS = readingAt(turnover, at, { reserve: 'signal' }).bayesBits;
  const sS = readingAt(stable,   at, { reserve: 'signal' }).bayesBits;

  // CONTROL: the constant reserve cannot tell turnover from stability — it must be blind.
  assert.equal(tC, sC, 'constant reserve must be blind to the signal history');
  // MECHANISM: the signal reserve makes a newcomer LESS surprising after turnover.
  assert.ok(tS < sS, `signal reserve must separate: turnover ${tS} < stable ${sS}`);
  // EXACT exemplar values — a numeric drift in the core or the deposit map trips here.
  assert.deepEqual([tC, sC], [0.26, 0.26], 'control exact value');
  assert.deepEqual([tS, sS], [0.09, 0.63], 'mechanism exact value');
});

// --- TEXT null: a confirmation probe must NOT show the newcomer separation. ---------------
test('lock/text-null: the reserve does not separate a confirmation probe', () => {
  const turnover = parseText('Ana arrived. Bob arrived. Cy arrived. Dan arrived. Dan arrived.', { docId: 'tc' });
  const stable   = parseText('Ana arrived. Ana waited. Ana waited. Ana waited. Ana waited.', { docId: 'sc' });
  const at = 4;
  const cΔ = Math.abs(readingAt(turnover, at, { reserve: 'signal' }).bayesBits - readingAt(stable, at, { reserve: 'signal' }).bayesBits);
  assert.ok(cΔ < 0.54, `confirm separation ${cΔ} must be smaller than the newcomer separation (0.54)`);
});

// --- FREQUENCY: the same dissociation through a DIFFERENT organ → the interior gate. ------
// The same single Born step (surpriseAt) over the frequency organ's overtone-bin atoms.
function freqBorn(notes, novelty) {
  const doc = ingestFrequencies({ name: 'f', notes, partials: 4 });
  const deposits = doc.tokensBySentence.map((s) => [...s]);
  const probe = deposits.length - 1;
  const amp = noveltyRateProfile(deposits, GAMMA)[probe];
  const prior = new Map();
  for (let j = 0; j < probe; j++) { const w = Math.pow(GAMMA, probe - 1 - j); for (const a of deposits[j]) prior.set(a, (prior.get(a) || 0) + w); }
  const arrival = new Map(); for (const a of deposits[probe]) arrival.set(a, (arrival.get(a) || 0) + 1);
  const sumPrior = [...prior.values()].reduce((s, m) => s + m, 0);
  const newBins = [...arrival.keys()].filter((k) => !prior.has(k)).length;
  return { bits: round(surpriseAt(prior, arrival, { gamma: GAMMA, novelty: novelty === 'signal' ? amp : 1.0 }).bayesBits), amp: round(amp), sumPrior: round(sumPrior), newBins };
}
test('lock/frequency: const reserve BLIND, signal reserve separates (turnover < stable)', () => {
  const turn = [233, 547, 1009, 1493, 1877];   // five distinct tones — newcomers
  const stab = [233, 233, 233, 233, 1877];     // one tone confirmed; same probe
  const tC = freqBorn(turn, 'const'), sC = freqBorn(stab, 'const');
  const tS = freqBorn(turn, 'signal'), sS = freqBorn(stab, 'signal');

  // The confound is matched across the pair (so the control is genuinely blind).
  assert.equal(tC.sumPrior, sC.sumPrior, 'matched sumPrior across the pair');
  assert.equal(tC.newBins, sC.newBins, 'matched probe novelty across the pair');
  // CONTROL: constant reserve blind.
  assert.equal(tC.bits, sC.bits, 'constant reserve must be blind in frequency too');
  // MECHANISM: signal reserve separates, turnover < stable.
  assert.ok(tS.bits < sS.bits, `signal reserve must separate in frequency: turnover ${tS.bits} < stable ${sS.bits}`);
  // INSTRUMENT: the amplitude is high after turnover, low after stability.
  assert.ok(tS.amp > sS.amp, `reserve amplitude tracks novelty rate: ${tS.amp} > ${sS.amp}`);
  // EXACT exemplar values — a numeric drift in the frequency organ or the core trips here.
  assert.deepEqual([tC.bits, sC.bits], [1.4, 1.4], 'frequency control exact value');
  assert.deepEqual([tS.bits, sS.bits], [0.36, 1.23], 'frequency mechanism exact value');
});

// --- The core helper's own contract: the γ-decay matches the figure field's kernel. ------
test('lock/core: noveltyRateProfile is the γ-decayed newcomer count, causal', () => {
  // Three newcomer steps, then a confirmation. reserve before step k = Σ_{j<k} γ^(k-1-j)·n_j.
  const deposits = [['a'], ['b'], ['c'], ['a']];   // a,b,c new; then a confirmed
  const p = noveltyRateProfile(deposits, 0.5);
  assert.deepEqual(p, [
    0,            // before step 0: nothing seen
    1,            // before step 1: a (1 newcomer, decay 0.5^0)
    0.5 * 1 + 1,  // before step 2: 0.5·a + b = 1.5
    0.5 * 1.5 + 1,// before step 3: 0.5·1.5 + c = 1.75
  ]);
  // A confirmation deposits no newcomer — the count only decays past it.
  const p2 = noveltyRateProfile([['a'], ['a'], ['a']], 0.5);
  assert.deepEqual(p2, [0, 1, 0.5]);   // newcomer at 0 only, then pure decay
});
