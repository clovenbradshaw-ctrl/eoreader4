import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { surpriseAt, noveltyReserveMass, createLog } from '../src/core/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// REGRESSION LOCK — the signal-derived novelty reserve (experiments/ exp-0002).
//
// The constant NOVELTY_RESERVE = 1.0 makes the reserve 1/(mass+1), which saturates under a
// steady deposit rate and is BLIND to whether newcomers have RECENTLY been arriving. The fix
// is a signal-derived reserve: the γ-decayed newcomer rate (noveltyReserveMass) fed as the
// `novelty` amplitude through the SAME fixed Born step inside surpriseAt. This lock fails the
// day the mechanism, the control, the parity, or the omnimodal claim changes.

const STIM = JSON.parse(readFileSync(new URL('../data/novelty-reserve-stimulus.json', import.meta.url)));
const KEY  = JSON.parse(readFileSync(new URL('../data/novelty-reserve-key.json', import.meta.url)));

// The two front-ends — the only modality-specific code; both yield a doc the one reader reads.
const buildText = (item) => parseText(item.units.join(' '), { docId: item.id });
const buildTone = (item) => {
  const log = createLog({ docId: item.id });
  item.steps.forEach((p, i) => log.append({ op: 'INS', id: p, label: p, sentIdx: i }));
  return { docId: item.id, modality: 'tone', units: item.steps.slice(), log };
};
const finalRead = (item, signalReserve) => {
  const doc = item.sense === 'tone' ? buildTone(item) : buildText(item);
  const at = (doc.units || doc.sentences).length - 1;
  return readingAt(doc, at, { signalReserve });
};
const itemsBy = (sense, regime, final) => STIM.items.filter(it => {
  const k = KEY.items[it.id];
  return it.sense === sense && k.regime === regime && k.final === final;
});
const bayes = (sense, regime, final, signal) =>
  itemsBy(sense, regime, final).map(it => finalRead(it, signal).bayesBits);

// --- 1. The core primitive: the reserve amplitude tracks the recent newcomer rate. -------

test('noveltyReserveMass: high after a churn of newcomers, ~0 after a long confirmation, γ-decayed', () => {
  const at = 10, gamma = 0.7;
  // churn — a newcomer first appeared at every step before the cursor.
  const churn = noveltyReserveMass([0,1,2,3,4,5,6,7,8,9], { at, gamma });
  // settled — exactly ONE newcomer, at step 0, then pure confirmation.
  const settled = noveltyReserveMass([0], { at, gamma });
  assert.ok(churn > 3 && churn < 1 / (1 - gamma) + 1e-9, `churn saturates near 1/(1-γ)=${(1/(1-gamma)).toFixed(2)}, got ${churn}`);
  assert.ok(settled < 0.05, `settled has decayed toward zero, got ${settled}`);
  assert.ok(churn / settled > 50, 'the rate dominates the reserve — not a constant');
  // strictly a decayed sum: one newcomer k steps back contributes γ^(at-1-k).
  assert.ok(Math.abs(settled - Math.pow(gamma, at - 1)) < 1e-12, 'γ-decayed first-appearance');
  // longer confirmation decays it further (monotone): a newcomer at step 0 seen from at=15.
  assert.ok(noveltyReserveMass([0], { at: 15, gamma }) < settled, 'more confirmation → smaller reserve');
});

// --- 2. The dissociation, per sense — the capability itself. ------------------------------

for (const sense of ['text', 'tone']) {
  test(`[${sense}] signal reserve SEPARATES a newcomer-after-confirmation from a newcomer-after-churn`, () => {
    const settledSig  = bayes(sense, 'settled',  'newcomer', true);
    const churningSig  = bayes(sense, 'churning', 'newcomer', true);
    // every settled newcomer is far more surprising than every churning newcomer.
    const minSettled = Math.min(...settledSig), maxChurning = Math.max(...churningSig);
    assert.ok(minSettled - maxChurning > 0.3,
      `signal: settled (${settledSig}) ≫ churning (${churningSig})`);
  });

  test(`[${sense}] fixed reserve is BLIND to the rate (the loud-surface control)`, () => {
    // Both finals are equally-unseen newcomers, so a surface 'is-this-new' method — which is
    // what the fixed reserve is — gives the SAME score. The separation cannot be surface.
    const settledFix  = bayes(sense, 'settled',  'newcomer', false);
    const churningFix  = bayes(sense, 'churning', 'newcomer', false);
    for (const s of settledFix) for (const c of churningFix)
      assert.ok(Math.abs(s - c) < 0.05, `fixed reserve does not separate: ${s} vs ${c}`);
  });

  test(`[${sense}] CONTROL: a repeat-final opens no wide gap under the signal reserve`, () => {
    // The dissociation is newcomer-specific: with no newcomer, the reserve barely matters, so
    // settled-vs-churning stays flat. A fix that swung the control would be a generic context
    // artifact, not the novelty mechanism — this fails it.
    const [settledRep] = bayes(sense, 'settled',  'repeat', true);
    const [churningRep] = bayes(sense, 'churning', 'repeat', true);
    assert.ok(Math.abs(settledRep - churningRep) < 0.2,
      `control swung (${settledRep} vs ${churningRep}) — not newcomer-specific`);
    // and the newcomer gap is far larger than the control gap.
    const newcGap = Math.min(...bayes(sense, 'settled', 'newcomer', true)) -
                    Math.max(...bayes(sense, 'churning', 'newcomer', true));
    assert.ok(newcGap > 5 * Math.abs(settledRep - churningRep),
      'the newcomer dissociation dwarfs the control gap');
  });

  test(`[${sense}] more confirmation deepens the effect (monotone in run length)`, () => {
    const short = finalRead(itemsBy(sense, 'settled', 'newcomer').find(it => KEY.items[it.id].confirm_len === 10), true).bayesBits;
    const long  = finalRead(itemsBy(sense, 'settled', 'newcomer').find(it => KEY.items[it.id].confirm_len === 15), true).bayesBits;
    assert.ok(long >= short, `len15 (${long}) ≥ len10 (${short})`);
  });
}

// --- 3. Omnimodal — the interior gate: two senses, identical behavior. --------------------

test('omnimodal: text organ and a non-text tone operator-log show the IDENTICAL dissociation', () => {
  // The mechanism reads only the membrane, so a structurally-matched stimulus scores the same
  // whether its atoms are entities or pitches — the interior cannot tell which sense it reads.
  const pairs = [['i01','i07'],['i02','i08'],['i03','i09'],['i04','i10'],['i05','i11'],['i06','i12']];
  for (const [tid, oid] of pairs) {
    const t = STIM.items.find(i => i.id === tid), o = STIM.items.find(i => i.id === oid);
    for (const signal of [false, true])
      assert.equal(finalRead(t, signal).bayesBits, finalRead(o, signal).bayesBits,
        `${tid}≟${oid} (signal=${signal}) must match`);
  }
});

// --- 4. Parity — the default path is byte-identical; the guard is not a predictive knob. ---

test('parity: default reading == fixed reserve, and the known live values are unchanged', () => {
  // The fixed channel IS the live default (signalReserve omitted ⇒ RULES_REV off). A drift in
  // the extracted reserve trips here. The values are the pre-fix engine's, measured live.
  const i03 = STIM.items.find(i => i.id === 'i03');
  const doc = buildText(i03);
  const at = doc.units.length - 1;
  assert.equal(readingAt(doc, at).bayesBits, readingAt(doc, at, { signalReserve: false }).bayesBits,
    'omitting the opt is the fixed-reserve (default-off) path');
  assert.equal(readingAt(doc, at).bayesBits, 0.28, 'the live churning-newcomer value is byte-identical');
});

test('the opening self-zeroes for ANY positive reserve — the empty-prior guard moves no score', () => {
  // surpriseAt returns 0 on an empty prior for any novelty>0 (the reserve cancels), so the
  // `|| NOVELTY` fallback (only reachable when the prior field is empty) cannot tune a score.
  const arrival = new Map([['f:a', 1]]);
  for (const novelty of [0.007, 0.04, 1, 3.33, 100])
    assert.equal(surpriseAt(new Map(), arrival, { gamma: 0.7, novelty }).bayesBits, 0,
      `opening is amplitude-invariant at novelty=${novelty}`);
});
