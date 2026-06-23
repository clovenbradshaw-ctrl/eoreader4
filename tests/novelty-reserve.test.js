import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog, recentNoveltyReserve, forwardDist, NOVELTY_RESERVE } from '../src/core/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { ingestMusic } from '../src/organs/in/music.js';
import { readingAt } from '../src/perceiver/index.js';

// THE REGRESSION LOCK for the adaptive novelty reserve (src/core/surprise.js
// recentNoveltyReserve). Capability: the mass the reader holds for an as-yet-unseen atom
// tracks the γ-decayed RATE of newcomer arrivals, instead of a hand-set constant blind to it.
// The fixed NOVELTY_RESERVE (1.0) depends only on accumulated mass; at MATCHED mass it is the
// same whether newcomers just burst in or the cast has been stable — the gap this grew from.
// Written to FAIL the day a precondition changes:
//   - if the fixed reserve stops being blind at matched mass (the gap closes), the BLIND
//     assertion fails — that is exactly what this lock should surface;
//   - if the adaptive reserve starts firing on the loud-surface control (old, recurring
//     entities — distinct-count and surface activity matched to a burst), the CONTROL fails;
//   - if the dissociation stops holding in either sense, the OMNIMODAL gate fails.
// The pressure that grew it: experiments/ledger.jsonl exp-0002 (an inside-out constant hunt
// on src/core/surprise.js:21 / src/perceiver/reading.js:23).

const γ = 0.7;                                   // the default reading horizon (reading.js GAMMA)
const G2 = γ * γ;                                // γ² — a newcomer two steps back
const approx = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

// ── THE INTERIOR, on a pure-operator log (no text, no parser, no modality). ──────────
// If the reserve reads this, the mechanism is interior — the omnimodal claim that any organ
// emitting INS inherits the same adaptive reserve.
const opLog = (events) => { const log = createLog({ docId: 't' }); for (const e of events) log.append(e); return log; };
const INS = (id, s) => ({ op: 'INS', id, label: id, sentIdx: s });

test('OMNIMODAL: the reserve amplitude is the γ-decayed newcomer rate (interior, no text)', () => {
  // BURST: three DISTINCT newcomers at 0,1,2. CONFIRM: one entity admitted once, re-seen at 1,2.
  const burst   = opLog([INS('a', 0), INS('b', 1), INS('c', 2)]).snapshot();
  const confirm = opLog([INS('a', 0), INS('a', 1), INS('a', 2)]).snapshot();
  const nuBurst   = recentNoveltyReserve(burst, 3, { gamma: γ });
  const nuConfirm = recentNoveltyReserve(confirm, 3, { gamma: γ });
  // three first-appearances at 0,1,2 → γ²+γ¹+γ⁰ ; one first-appearance at 0 → γ²
  assert.ok(approx(nuBurst, G2 + γ + 1), `burst nu = γ²+γ+1, got ${nuBurst}`);
  assert.ok(approx(nuConfirm, G2), `confirm nu = γ² (only the first appearance counts), got ${nuConfirm}`);
  assert.ok(nuBurst > nuConfirm, 'a burst of newcomers reserves MORE than a confirmation stretch');
});

test('OMNIMODAL: the fixed reserve is BLIND at matched mass; the adaptive reserve is not', () => {
  // Two profiles with IDENTICAL total mass (γ²+γ+1) but different newcomer composition.
  const M = G2 + γ + 1;
  const spread = new Map([['a', G2], ['b', γ], ['c', 1]]);   // three newcomers, mass spread
  const massed = new Map([['a', M]]);                         // one entity, mass concentrated
  // FIXED reserve (novelty = 1.0): a function of total mass alone → identical for both (the gap).
  assert.ok(approx(forwardDist(spread, { novelty: NOVELTY_RESERVE }).reserve,
                   forwardDist(massed, { novelty: NOVELTY_RESERVE }).reserve),
    'fixed reserve cannot tell a burst from a confirmation stretch at matched mass');
  // ADAPTIVE reserve (novelty = nu): the burst reserves more (nu = M) than the stretch (nu = γ²).
  const rBurst   = forwardDist(spread, { novelty: M }).reserve;     // M/(M+M) = 0.5
  const rConfirm = forwardDist(massed, { novelty: G2 }).reserve;    // γ²/(M+γ²)
  assert.ok(rBurst > rConfirm + 0.1, `adaptive opens a gap the fixed reserve does not (${rBurst} vs ${rConfirm})`);
});

// ── THE TWO SENSES, through readingAt — the omnimodal gate (an interior change). ─────
// Re-derived here so the lock is self-contained (units 0-2 preamble, 3-5 window, 6 probe;
// every unit deposits one INS so accumulated mass is matched, only newcomer rate differs).
const TEXT = {
  newcomers:  ['Olivia waited.', 'Owen waited.', 'Oscar waited.', 'Xena waited.', 'Yara waited.', 'Zane waited.', 'Quinn arrived.'],
  one_recurs: ['Olivia waited.', 'Owen waited.', 'Oscar waited.', 'Olivia waited.', 'Olivia waited.', 'Olivia waited.', 'Quinn arrived.'],
  old_recur:  ['Olivia waited.', 'Owen waited.', 'Oscar waited.', 'Olivia waited.', 'Owen waited.', 'Oscar waited.', 'Quinn arrived.'],
};
const MUSIC = {
  newcomers:  ['C4', 'E4', 'G4', 'F4', 'A4', 'D4', 'B4'],
  one_recurs: ['C4', 'E4', 'G4', 'C4', 'C4', 'C4', 'B4'],
  old_recur:  ['C4', 'E4', 'G4', 'C4', 'E4', 'G4', 'B4'],
};
const reserveOf = (doc, opts) => readingAt(doc, doc.units.length - 1, { forward: true, ...opts }).pNovel;
const textDoc  = (units) => parseText(units.join('\n'), { docId: 'nr' });
const musicDoc = (notes) => ingestMusic({ name: 'nr', notes });

for (const [sense, conds, mk] of [['text', TEXT, textDoc], ['music', MUSIC, musicDoc]]) {
  test(`${sense.toUpperCase()}: adaptive reserve separates a burst from a confirmation stretch`, () => {
    const fixed = (u) => reserveOf(mk(u), {});
    const adapt = (u) => reserveOf(mk(u), { reserve: 'adaptive' });
    const fN = fixed(conds.newcomers), f1 = fixed(conds.one_recurs), fO = fixed(conds.old_recur);
    const aN = adapt(conds.newcomers), a1 = adapt(conds.one_recurs), aO = adapt(conds.old_recur);

    // the gap: the live fixed reserve is blind (equal across conditions at matched mass).
    assert.ok(approx(fN, f1) && approx(f1, fO), `fixed reserve blind, got [${fN}, ${f1}, ${fO}]`);
    // the split: the adaptive reserve fires high after a burst, low after a stretch.
    assert.ok(aN >= 0.4, `adaptive high after a burst, got ${aN}`);
    assert.ok(a1 <= 0.3, `adaptive low after a confirmation stretch, got ${a1}`);
    assert.ok(aN > a1 && aN > aO, 'the burst is the unique argmax of the adaptive reserve');
    // THE LOUD-SURFACE CONTROL: old_recur (same distinct-count and recent-mention activity as
    // the burst, but the entities are OLD) must group with one_recurs, not with the burst.
    assert.ok(Math.abs(aO - a1) < Math.abs(aO - aN) && aO <= 0.3,
      `old_recur groups with one_recurs, not the burst — reads recency, not distinct-count (got ${aO})`);
  });
}

test('PARITY: pNovel is opt-in (under forward); the default reading carries no reserve field', () => {
  const doc = textDoc(TEXT.newcomers);
  // (a) the default path carries no pNovel at all — byte-identical when the opt-in is off.
  assert.ok(!('pNovel' in readingAt(doc, doc.units.length - 1)), 'no pNovel on the default path');
  // (b) the ADAPTIVE reserve is itself opt-in: omitting reserve:'adaptive' leaves the fixed
  //     reserve in place, which (the gap) is identical across matched-mass conditions.
  const fixedNew = reserveOf(textDoc(TEXT.newcomers), {});
  const fixedOne = reserveOf(textDoc(TEXT.one_recurs), {});
  assert.ok(approx(fixedNew, fixedOne), `default forward reserve is the fixed, blind reserve (${fixedNew} vs ${fixedOne})`);
});
