import { test } from 'node:test';
import assert from 'node:assert/strict';

import { surpriseAt, contextualReserve, RESERVE_SEED } from '../src/core/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// THE REGRESSION LOCK for the contextual novelty reserve (src/core/reserve.js) — the
// reserve as a Born AMPLITUDE the signal teaches (the γ-decayed newcomer rate) rather than
// the fixed NOVELTY_RESERVE=1.0. Capability: RATE-AWARE SURPRISE — a newcomer after a
// drought moves belief far more than a SURFACE-IDENTICAL newcomer in the middle of a churn;
// the fixed reserve cannot separate them (it scores them equal, even inverted), the
// contextual reserve separates them ~4×. Confirmed in two senses (the core reads only
// atom→mass; disjoint vocabularies give identical surprise).
//
// Written to FAIL the day a precondition changes:
//   - if the contextual reserve stops tracking the rate (reserve flat), the rate assertions fail;
//   - if it starts firing on the noise (a steady line with no newcomers), the control fails;
//   - if it ever stops being modality-blind (two vocabularies diverge), the omnimodal lock fails;
//   - if the default reading stops being byte-identical, the wiring lock fails.
// The pressure that grew it: experiments/ledger.jsonl exp-0002 (the constant hunt on
// surprise.js:21 × the drifting-signal hard problem).

const GAMMA = 0.7;

// Walk an atom stream causally through the REAL core, returning per-line channels — the
// modality-agnostic instrument (no text, no parser): atoms are opaque keys.
const readStream = (units, { gamma = GAMMA } = {}) => {
  const firstSeen = new Map();
  units.forEach((u, i) => { for (const a of u) if (!firstSeen.has(a)) firstSeen.set(a, i); });
  const newAt = units.map((u, i) => u.filter(a => firstSeen.get(a) === i).length);
  return units.map((_, at) => {
    const prior = new Map();
    for (let k = 0; k < at; k++) { const w = Math.pow(gamma, at - 1 - k); for (const a of units[k]) prior.set(a, (prior.get(a) || 0) + w); }
    const deposit = new Map(); for (const a of units[at]) deposit.set(a, (deposit.get(a) || 0) + 1);
    const reserve = contextualReserve(newAt.slice(0, at), at, { gamma });
    return {
      at, newcomers: newAt[at], reserve,
      fixed: surpriseAt(prior, deposit, { gamma, novelty: 1.0 }).bayesBits,
      ctx: surpriseAt(prior, deposit, { gamma, novelty: reserve }).bayesBits,
    };
  });
};

// The experiment's structure, in slot tokens — steady drought, an event, a churn with a
// surface-identical newcomer (E2) and a loud 3-newcomer burst (C_loud).
const SLOTS = [
  ['S1', 'S2'], ['S2', 'S3'], ['S1', 'S3'], ['S1', 'S2'], ['S2', 'S3'], ['S1', 'S2', 'S3'],
  ['S1', 'S3'], ['S2', 'S3'], ['S1', 'S2'],
  ['X1', 'S1'],                         // 9  E1 — newcomer after a drought
  ['S2', 'S3'], ['S1', 'S2'],
  ['D1', 'S3'], ['D2', 'D1'], ['D3', 'D2'], ['D4', 'D3'], ['D5', 'D4'], ['D6', 'D5'],
  ['D7', 'D6'],                         // 18 E2 — newcomer mid-churn, surface-identical to E1
  ['D8', 'D7'],
  ['B1', 'B2', 'B3'],                   // 20 C_loud — 3 newcomers at once
];
const E1 = 9, E2 = 18, C = 20;
const CHURN = [12, 13, 14, 15, 16, 17, 19];
const render = (map) => SLOTS.map(u => u.map(a => map[a]));
const vocabA = Object.fromEntries(['S1', 'S2', 'S3', 'X1', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'B1', 'B2', 'B3'].map((s, i) => [s, `wordA_${i}`]));
const vocabB = Object.fromEntries(Object.keys(vocabA).map((s, i) => [s, `mvB_${i}`]));

test('the reserve is the opening constant at line 0, then tracks the rate (high after newcomers, low after a drought)', () => {
  assert.equal(contextualReserve([], 0, { gamma: GAMMA }), RESERVE_SEED, 'opening reserve == seed (byte-identical opening)');
  const r = readStream(render(vocabA));
  // After the drought (E1) the reserve is LOW; deep in the churn (E2) it is HIGH.
  assert.ok(r[E1].reserve < 0.5, `reserve after a drought is low (got ${r[E1].reserve.toFixed(3)})`);
  assert.ok(r[E2].reserve > 2.5, `reserve mid-churn is high (got ${r[E2].reserve.toFixed(3)})`);
  // Strictly positive everywhere (absolute continuity: the KL stays defined on a newcomer).
  for (const x of r) assert.ok(x.reserve > 0, `reserve strictly positive at ${x.at}`);
});

test('CAPABILITY: the contextual reserve separates a drought-event from a surface-identical churn-newcomer (~4×); the fixed reserve cannot', () => {
  const r = readStream(render(vocabA));
  // E1 and E2 are surface-identical (1 newcomer, same active-cast size). The fixed reserve
  // is blind to the rate: it does NOT lift E1 above E2 (it inverts them).
  assert.ok(r[E1].fixed <= r[E2].fixed * 1.15, `fixed cannot separate E1/E2 (fixed(E1)=${r[E1].fixed} fixed(E2)=${r[E2].fixed})`);
  // The contextual reserve separates them by the recent rate — the confirmed capability.
  assert.ok(r[E1].ctx >= 3 * r[E2].ctx, `ctx separates E1>>E2 (ctx(E1)=${r[E1].ctx} ctx(E2)=${r[E2].ctx}, ratio ${(r[E1].ctx / r[E2].ctx).toFixed(2)})`);
});

test('CONTROL: ctx does not fire on the noise (a steady line with no newcomers reads ~the same as fixed)', () => {
  const r = readStream(render(vocabA));
  // On a quiet line the reserve sits near the opening (~1), so ctx must not invent surprise.
  for (const at of [4, 6, 7, 10, 11]) {
    assert.equal(r[at].newcomers, 0, `line ${at} is a steady line`);
    assert.ok(Math.abs(r[at].ctx - r[at].fixed) <= 0.02, `ctx≈fixed on steady line ${at} (ctx=${r[at].ctx} fixed=${r[at].fixed})`);
  }
});

test('CONTROL: the loud burst is the fixed argmax (surface trap), and the contextual reserve attenuates it', () => {
  const r = readStream(render(vocabA));
  const fixedArgmax = r.reduce((m, x) => (x.fixed > m.fixed ? x : m));
  assert.equal(fixedArgmax.at, C, 'the rate-blind fixed channel argmaxes the loud 3-newcomer burst (the surface trap)');
  // The mechanism must NOT inherit the trap blindly: it roughly halves the burst's score.
  assert.ok(r[C].ctx / r[C].fixed < 0.7, `ctx attenuates the burst (ratio ${(r[C].ctx / r[C].fixed).toFixed(3)})`);
});

test('OMNIMODAL: two DISJOINT vocabularies give byte-identical surprise (the core reads only atom→mass)', () => {
  const a = readStream(render(vocabA));
  const b = readStream(render(vocabB));
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(a[i].ctx - b[i].ctx) < 1e-12, `ctx identical across senses at ${i}`);
    assert.ok(Math.abs(a[i].fixed - b[i].fixed) < 1e-12, `fixed identical across senses at ${i}`);
  }
});

test('WIRING: readingAt opt-off is byte-identical; opt-on changes the reading and exposes the reserve', () => {
  const doc = parseText('Alice met Bob. Bob saw Carol. Carol left. A stranger arrived. The stranger spoke.');
  const S = (doc.units || doc.sentences).length;
  let anyChanged = false, sawReserve = false;
  for (let at = 0; at < S; at++) {
    const base = readingAt(doc, at);
    const ctx = readingAt(doc, at, { contextualReserve: true });
    assert.ok(!('reserve' in base), `default reading carries no reserve field (line ${at})`);
    if (ctx.reserve != null && Math.abs(ctx.reserve - 1.0) > 1e-9) sawReserve = true;
    if (Math.abs(base.bayesBits - ctx.bayesBits) > 1e-9) anyChanged = true;
  }
  assert.ok(anyChanged, 'opt-on changes bayesBits on at least one line (the patch is not dormant)');
  assert.ok(sawReserve, 'opt-on exposes a non-trivial (rate-derived) reserve');
});
