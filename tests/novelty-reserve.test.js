// Regression lock for exp-0002 (experiments/exp-0002-novelty-reserve).
//
// CONFIRMED capability: the context-sensitive novelty reserve tracks the recent newcomer
// RATE — high after a burst of first-time atoms, low after a confirmation plateau — and
// does so in two senses (music, text) plus the bare membrane, where the live CONSTANT
// reserve (a hand-set 1/(mass+1)) cannot, because a burst/plateau pair is matched on total
// mass. The fix rides behind RULES_REV; with the flag off the constant path is byte-
// identical (the rest of the suite is that golden).
//
// This lock fails the day its precondition changes: if the reserve reverts to the constant
// (no separation), if the constant control starts separating (a surface leak), or if the
// no-opt default stops tracking the gate.
//
// NOT locked here: promotion to default-on. The generalization check (does tracking recent
// rate improve next-step newcomer prediction) is positively-autocorrelation-dependent —
// it lifts bursty text, regresses alternating melodies, aggregate flat — so the flag stays
// off. See experiments/ledger.jsonl for the scope and the deeper located gap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, noveltyAmplitude } from '../src/core/index.js';
import { ingestText, ingestMusic } from '../src/organs/in/index.js';
import { readingAt } from '../src/perceiver/index.js';

const L = 8;
// burst → anchor settles, newcomers at the END of the prior; plateau → newcomers early,
// anchor recurs to the end. Same multiset, same length → identical total γ-mass.
const seq = ({ anchor, newcomers, mode }) => {
  const k = newcomers.length, prior = [];
  if (mode === 'burst') { for (let i = 0; i < (L - 1) - k; i++) prior.push(anchor); for (const n of newcomers) prior.push(n); }
  else { prior.push(anchor); for (const n of newcomers) prior.push(n); while (prior.length < L - 1) prior.push(anchor); }
  return [...prior, anchor];
};
const synth = (atoms, name) => {
  const log = createLog({ docId: name });
  atoms.forEach((a, i) => log.append({ op: 'INS', id: String(a), label: String(a), sentIdx: i }));
  return { docId: name, units: atoms.map((a, i) => `${a}@${i}`), log };
};
const reserve = (doc, mode) => readingAt(doc, L - 1, { forward: true, reserve: mode }).pNext.reserve;
const auc = (burst, plateau) => {
  let s = 0; for (const a of burst) for (const b of plateau) s += a > b ? 1 : (a === b ? 0.5 : 0);
  return s / (burst.length * plateau.length);
};

test('core: noveltyAmplitude is a causal γ-decayed count of newcomer first-appearances', () => {
  const nu = noveltyAmplitude([0, 5, 6, 7], 8, 0.7);
  assert.ok(Math.abs(nu - (0.7 ** 7 + 0.7 ** 2 + 0.7 + 1)) < 1e-9, 'sums γ^(at-1-s) over first steps');
  assert.equal(noveltyAmplitude([8, 9], 8, 0.7), 0, 'steps ≥ at are not yet seen (causal)');
  assert.equal(noveltyAmplitude([], 5, 0.7), 0, 'empty history → 0 (opening handled by the caller fallback)');
});

test('parity: the no-opt reserve follows the RULES_REV gate; the two paths differ on a burst', () => {
  const doc = synth(seq({ anchor: 'A', newcomers: ['B', 'C', 'D'], mode: 'burst' }), 'lb');
  const envOn = /^(1|true|on)$/i.test(process.env.RULES_REV || '');
  const def = reserve(doc, undefined);
  const con = reserve(doc, 'constant');
  const ctx = reserve(doc, 'context');
  assert.equal(def, envOn ? ctx : con, 'no-opt default tracks RULES_REV (off → constant, byte-identical)');
  assert.notEqual(con, ctx, 'constant and context reserve diverge on a burst stream');
});

test('control: a burst/plateau pair is matched on mass → the constant reserve cannot separate', () => {
  const burst   = synth(seq({ anchor: 'A', newcomers: ['B', 'C', 'D'], mode: 'burst' }),   'b');
  const plateau = synth(seq({ anchor: 'A', newcomers: ['B', 'C', 'D'], mode: 'plateau' }), 'p');
  assert.equal(reserve(burst, 'constant'), reserve(plateau, 'constant'),
    'matched mass → identical constant reserve (the loud surface signal is useless)');
});

test('mechanism + omnimodal gate: context reserve separates burst>plateau in membrane, music, text', async () => {
  // membrane (bare INS stream) — the mechanism
  const mB = ['A', 'P', 'X'].map((a, i) => synth(seq({ anchor: a, newcomers: ['Q' + i, 'R' + i, 'S' + i], mode: 'burst' }), 'mb' + i));
  const mP = ['A', 'P', 'X'].map((a, i) => synth(seq({ anchor: a, newcomers: ['Q' + i, 'R' + i, 'S' + i], mode: 'plateau' }), 'mp' + i));
  // music — sense #1
  const muB = [ingestMusic({ name: 'b1', notes: seq({ anchor: 'C4', newcomers: ['D4', 'E4', 'F4'], mode: 'burst' }) }),
               ingestMusic({ name: 'b2', notes: seq({ anchor: 'G4', newcomers: ['A4', 'B4'], mode: 'burst' }) })];
  const muP = [ingestMusic({ name: 'p1', notes: seq({ anchor: 'C4', newcomers: ['D4', 'E4', 'F4'], mode: 'plateau' }) }),
               ingestMusic({ name: 'p2', notes: seq({ anchor: 'G4', newcomers: ['A4', 'B4'], mode: 'plateau' }) })];
  // text — sense #2 (matched template, equal mass per sentence)
  const T = (name) => `${name} entered the hall.`;
  const tB = [await ingestText(seq({ anchor: 'Mara', newcomers: ['Tomas', 'Yusuf', 'Priya'], mode: 'burst' }).map(T).join(' '), {}),
              await ingestText(seq({ anchor: 'Ines', newcomers: ['Bao', 'Caleb'], mode: 'burst' }).map(T).join(' '), {})];
  const tP = [await ingestText(seq({ anchor: 'Mara', newcomers: ['Tomas', 'Yusuf', 'Priya'], mode: 'plateau' }).map(T).join(' '), {}),
              await ingestText(seq({ anchor: 'Ines', newcomers: ['Bao', 'Caleb'], mode: 'plateau' }).map(T).join(' '), {})];

  for (const [sense, B, P] of [['membrane', mB, mP], ['music', muB, muP], ['text', tB, tP]]) {
    const ctxBurst = B.map(d => reserve(d, 'context'));
    const ctxPlat  = P.map(d => reserve(d, 'context'));
    const conBurst = B.map(d => reserve(d, 'constant'));
    const conPlat  = P.map(d => reserve(d, 'constant'));
    assert.equal(auc(ctxBurst, ctxPlat), 1, `[${sense}] context reserve ranks every burst above every plateau`);
    assert.ok(auc(conBurst, conPlat) <= 0.6, `[${sense}] constant reserve does NOT separate (control holds)`);
  }
});
