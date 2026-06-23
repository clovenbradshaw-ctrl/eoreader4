// REGRESSION LOCK — the signal-derived novelty reserve (docs/novelty-reserve.md).
//
// One lock per confirmed capability, written to FAIL the day its precondition changes —
// including the CONTROL, so a change that makes the reserve fire on surface activity (the
// re-confirm null) or that lets it swing the matched-mass control trips here rather than
// passing silently. The capability: a newcomer's Bayesian surprise tracks the recent NOVELTY
// RATE (ν), not the standing mass or the bare fact of being new. Confirmed in TWO senses
// (text proposition basis + tonal pitch basis) → it is interior.
//
// Run: node --test tests/novelty-reserve.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { surpriseAt, NOVELTY_RESERVE } from '../src/core/surprise.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

const m = (o) => new Map(Object.entries(o));
const GAMMA = 0.7;

// === PARITY: signalReserve OFF (the default) is byte-identical to the constant reserve. ===
test('PARITY — readingAt default and {signalReserve:false} both use the CONSTANT reserve', () => {
  const doc = parseText(
    'Ada Long spoke. Ada Long spoke. Ben Cole arrived. Ben Cole spoke. Cara Dove entered. Cara Dove spoke.',
    { docId: 'gold' });
  // The exact-value goldens (tests/surprise.test.js) — unchanged with the flag off.
  for (const c of [0, 1, 2, 4]) {
    const def = readingAt(doc, c);
    const off = readingAt(doc, c, { signalReserve: false });
    assert.deepEqual([off.surprisalBits, off.bayesBits], [def.surprisalBits, def.bayesBits],
      `flag-off matches default at cursor ${c}`);
  }
  assert.deepEqual([readingAt(doc, 2).surprisalBits, readingAt(doc, 2).bayesBits], [1.43, 0.2],
    'the constant-reserve golden still holds');
});

// === THE CORE RECURRENCE: ν′ = γ·ν + newcomerMass, exposed by the interior. ===============
test('CORE — surpriseAt returns noveltyNext = γ·novelty + newcomer mass (purely additive)', () => {
  const r = surpriseAt(m({ 'f:a': 3 }), m({ 'f:a': 1, 'f:b': 1, 'f:c': 1 }), { gamma: GAMMA, novelty: 2 });
  assert.equal(r.noveltyNext, GAMMA * 2 + 2, 'b,c are newcomers (mass 1 each) → ν′ = 0.7·2 + 2');
  // additive: the scoring channels are untouched, so every existing caller stays byte-identical
  const base = surpriseAt(m({ 'f:a': 3 }), m({ 'f:b': 1 }), { gamma: GAMMA });
  assert.equal(base.noveltyNext, GAMMA * NOVELTY_RESERVE + 1, 'defaults to the constant when novelty omitted');
  assert.ok(typeof base.bayesBits === 'number', 'bayesBits still computed');
});

// === THE DISSOCIATION (text proposition basis). ===========================================
// Drought vs flurry: standing mass matched, surface (line shape, verb, token count) matched,
// both end on a newcomer. The ONLY difference is the recent novelty rate.
const DROUGHT = 'Arna entered. Arna entered. Arna entered. Arna entered. Arna entered. Arna entered. Wieman entered.';
const FLURRY  = 'Arna entered. Dammann entered. Keim entered. Randolph entered. Aelvoet entered. Lamprecht entered. Wieman entered.';
const CONTROL = 'Arna entered. Arna entered. Arna entered. Arna entered. Arna entered. Arna entered. Arna entered.';
const AT = 6;

test('TEXT — OFF the constant reserve is BLIND: bayes(drought) == bayes(flurry)', () => {
  const d = readingAt(parseText(DROUGHT, { docId: 'd' }), AT);
  const f = readingAt(parseText(FLURRY,  { docId: 'f' }), AT);
  // matched standing mass → the constant reserve gives the SAME KL despite drought vs flurry
  assert.equal(d.bayesBits, f.bayesBits, 'the constant cannot tell drought from flurry');
  // and the surface channel is identical too — no surface feature could split them
  assert.equal(d.surprisalBits, f.surprisalBits, 'surprisal (surface) is identical between the two');
});

test('TEXT — ON the signal reserve TRACKS the rate: bayes(drought) ≫ bayes(flurry)', () => {
  const d = readingAt(parseText(DROUGHT, { docId: 'd' }), AT, { signalReserve: true });
  const f = readingAt(parseText(FLURRY,  { docId: 'f' }), AT, { signalReserve: true });
  assert.ok(d.bayesBits - f.bayesBits > 0.3,
    `drought ≫ flurry under the signal reserve (got ${d.bayesBits} vs ${f.bayesBits})`);
  assert.ok(d.bayesBits > f.bayesBits, 'newcomer-after-drought moves belief more than newcomer-after-flurry');
});

// === THE CONTROL (the loud-surface null). A re-confirm at the test line — byte-identical ===
// surface to the drought test line — must move NO belief under EITHER reserve. A reserve that
// fired on surface activity would trip here.
test('CONTROL — a re-confirm at the test line stays ≈0 under BOTH reserves (no surface leak)', () => {
  const off = readingAt(parseText(CONTROL, { docId: 'c' }), AT);
  const on  = readingAt(parseText(CONTROL, { docId: 'c' }), AT, { signalReserve: true });
  assert.ok(off.bayesBits < 0.01, `control bayes ≈ 0 with constant reserve (got ${off.bayesBits})`);
  assert.ok(on.bayesBits  < 0.01, `control bayes ≈ 0 with signal reserve (got ${on.bayesBits})`);
  // and the signal reserve does NOT inflate the control above the drought newcomer
  const d = readingAt(parseText(DROUGHT, { docId: 'd' }), AT, { signalReserve: true });
  assert.ok(d.bayesBits > on.bayesBits, 'the drought NEWCOMER moves belief; the re-confirm does not');
});

// === THE OMNIMODAL GATE (second sense — tonal pitch basis). ===============================
// The SAME core (surpriseAt) over a pitch basis, threading ν via noveltyNext. Confirmed in a
// second, different organ → the capability is interior, not a text fact.
function readTonal(notes, { signalReserve }) {
  let prior = new Map(), nu = 0, last = 0;
  for (const p of notes) {
    const arrival = new Map([[`n:${p}`, 1]]);
    const r = surpriseAt(prior, arrival, { gamma: GAMMA, novelty: signalReserve ? nu : 1.0 });
    last = r.bayesBits;
    const post = new Map();
    for (const k of new Set([...prior.keys(), ...arrival.keys()]))
      post.set(k, GAMMA * (prior.get(k) || 0) + (arrival.get(k) || 0));
    prior = post; nu = r.noveltyNext;
  }
  return last; // bayes at the final (test) note
}
test('TONAL — the SAME reserve dissociates on a pitch basis (the omnimodal gate)', () => {
  const dNotes = [60, 60, 60, 60, 60, 60, 67];   // drought: one pitch recurs, then a new pitch
  const fNotes = [60, 62, 64, 65, 66, 69, 67];   // flurry: six distinct pitches, then a new pitch
  const offD = readTonal(dNotes, { signalReserve: false });
  const offF = readTonal(fNotes, { signalReserve: false });
  const onD  = readTonal(dNotes, { signalReserve: true });
  const onF  = readTonal(fNotes, { signalReserve: true });
  assert.ok(Math.abs(offD - offF) < 1e-6, 'OFF: the constant is blind on the tonal basis too');
  assert.ok(onD - onF > 0.3, `ON: drought ≫ flurry on the tonal basis (got ${onD} vs ${onF})`);
});

// === MATCHED-RATE NULL: hold ν fixed, vary nothing about novelty → no split (the reserve is ==
// the ONLY lever). Two readings with identical novelty history score identically.
test('NULL — identical novelty history yields identical reserve, hence identical bayes', () => {
  // same drought structure, different incumbent identity — same first-appearance TIMING → same ν
  const a = readingAt(parseText('Solo entered. Solo entered. Solo entered. Solo entered. Solo entered. Solo entered. Newcomer entered.', { docId: 'a' }), AT, { signalReserve: true });
  const b = readingAt(parseText('Alpha entered. Alpha entered. Alpha entered. Alpha entered. Alpha entered. Alpha entered. Stranger entered.', { docId: 'b' }), AT, { signalReserve: true });
  assert.equal(a.bayesBits, b.bayesBits, 'matched novelty history → matched reserve → matched KL (identity is irrelevant)');
});
