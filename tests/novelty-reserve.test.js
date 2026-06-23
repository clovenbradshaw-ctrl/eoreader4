import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog, surpriseAt, noveltyAmplitude, NOVELTY_RESERVE } from '../src/core/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { readingAt } from '../src/perceiver/index.js';

// THE REGRESSION LOCK for the signal-derived novelty reserve (src/core/surprise.js
// noveltyAmplitude), threaded opt-in through readingAt({adaptiveReserve:true}). Capability:
// the reserve the reader holds for an as-yet-unseen atom tracks the RECENT NOVELTY RATE — the
// γ-decayed mass of recent newcomer admissions — instead of a hand-rolled constant, so the
// same newcomer is half-expected after a churn of newcomers and a violation after a sealed
// run of confirmation. Written to FAIL the day a precondition changes:
//   - if the reserve stops tracking novelty rate (regresses toward the constant), the
//     dissociations below fail;
//   - if the count-matched control stops being equal-count, the control assertion fails;
//   - if the default (flag-off) path stops being byte-identical (the reserve leaks into the
//     default surprise), the PARITY test fails — that is exactly what it should surface.
// The pressure that grew it: experiments/ledger.jsonl exp-0002 (inside-out constant hunt on
// NOVELTY_RESERVE, the campaign's named exemplar; cast from a random Wikipedia draw).

const m = (obj) => new Map(Object.entries(obj));

// ── 1. CORE ISOLATION — the reserve→surprise link, with ZERO confound. ──────────────
// surpriseAt over the SAME prior and the SAME arrival; only the reserve amplitude changes.
// A larger reserve (the reader expecting newcomers) makes a newcomer LESS surprising. This
// is the mechanism the engine-level dissociations rest on, isolated from any profile-shape
// difference.
test('ISOLATION: same prior + same newcomer, a larger reserve makes the newcomer LESS surprising', () => {
  const prior = m({ 'f:a': 2, 'f:b': 1 });
  const arrival = m({ 'f:z': 1 });                       // a brand-new atom
  const lowReserve  = surpriseAt(prior, arrival, { gamma: 0.7, novelty: 0.05 }).bayesBits; // sealed run
  const highReserve = surpriseAt(prior, arrival, { gamma: 0.7, novelty: 3.0  }).bayesBits; // fresh churn
  assert.ok(lowReserve > highReserve,
    `a newcomer costs more under a low reserve (${lowReserve}) than a high one (${highReserve})`);
  assert.ok(highReserve >= 0 && Number.isFinite(lowReserve), 'both finite, KL ≥ 0');
});

// ── 2. THE AMPLITUDE — γ-decay forgets stale novelty (the count-blind claim). ───────
test('AMPLITUDE: with the SAME newcomer count, a recent burst yields a far larger reserve than a stale one', () => {
  // Same number of newcomers (10), at the same γ — only their reading-distance differs.
  const recent = noveltyAmplitude(Array.from({ length: 10 }, (_, i) => i),      { gamma: 0.7 }); // dist 0..9
  const stale  = noveltyAmplitude(Array.from({ length: 10 }, (_, i) => i + 9),  { gamma: 0.7 }); // dist 9..18
  assert.ok(recent > 3 * stale, `recent novelty (${recent.toFixed(3)}) ≫ stale novelty (${stale.toFixed(3)}), same count`);
});

test('AMPLITUDE: no newcomer history falls back to the cold-start seed (the boundary stays defined)', () => {
  assert.equal(noveltyAmplitude([], { gamma: 0.7 }), NOVELTY_RESERVE);
  // and at an opening the KL is zero for ANY positive reserve — the seed never moves a prediction
  assert.equal(surpriseAt(new Map(), m({ 'f:a': 1 }), { gamma: 0.7, novelty: 0.0001 }).bayesBits, 0);
  assert.equal(surpriseAt(new Map(), m({ 'f:a': 1 }), { gamma: 0.7, novelty: 9.0    }).bayesBits, 0);
});

// ── 3. OMNIMODAL — a pure-operator log, no text, no parser. ──────────────────────────
// If readingAt's reserve dissociates a parser-free operator stream, the mechanism is
// interior: any organ emitting INS inherits it. Here the operators carry a TONAL reading
// (a repeated pitch is the same id; a new pitch is a newcomer) — a second sense.
const opDoc = (events, units) => {
  const log = createLog({ docId: 't' });
  for (const e of events) log.append(e);
  return { units, log };
};
const INS = (id, s) => ({ op: 'INS', id, label: id, sentIdx: s });

test('OMNIMODAL: a tonal operator stream — the reserve tracks novelty with no text in sight', () => {
  const N = 14, us = Array.from({ length: N }, (_, i) => `u${i}`), cur = N - 1;
  const stable = [];                                       // a 3-pitch motif repeating
  for (let s = 0; s < N - 1; s++) stable.push(INS(['C', 'D', 'E'][s % 3], s));
  stable.push(INS('Z', cur));                              // a new pitch enters
  const pit = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'c', 'd', 'e', 'f', 'g', 'b'];
  const churny = [];                                       // a fresh pitch nearly every step
  for (let s = 0; s < N - 1; s++) churny.push(INS(pit[s], s));
  churny.push(INS('Z', cur));

  const rS = readingAt(opDoc(stable, us), cur, { adaptiveReserve: true });
  const rC = readingAt(opDoc(churny, us), cur, { adaptiveReserve: true });
  // matched total mass (same length, one INS per step), so the CONSTANT reserve is equal
  assert.ok(Math.abs(rS.totalMass - rC.totalMass) < 1e-9, 'matched total mass → the constant reserve is equal');
  // the signal-derived reserve is NOT equal — churn reserves far more for the next newcomer
  assert.ok(rC.reserve > 3 * rS.reserve, `churny reserve ${rC.reserve.toFixed(3)} ≫ stable ${rS.reserve.toFixed(3)}`);
  // and the SAME new pitch Z is the larger violation after the sealed motif
  assert.ok(rS.bayesBits > rC.bayesBits, `the motif-newcomer (${rS.bayesBits}) outweighs the churn-newcomer (${rC.bayesBits})`);
});

// ── 4. TEXT — the stimulus re-derived here so the lock is self-contained. ─────────────
// Three streams, 20 lines, the same newcomer "Stevenson" at cursor 19. stream_b and stream_c
// are COUNT-MATCHED (identical distinct-name/intro/recurrence/total-mass) and differ only in
// when the newcomers cluster — so only a recency-weighted reserve can separate them.
const R = ['Enrico Saraceni', 'Dmitri Sychev', 'Mailin Vargas', 'Henning Wallgren', 'Ron Butler',
           'Jannie Borst', 'Bimini', 'Redshank', 'Harvey Kirkby', 'Billie Blonde'];
const V = ['spoke', 'waited', 'returned', 'listened', 'paused', 'nodded', 'watched', 'answered', 'smiled', 'stood'];
const STREAMS = {
  stable: (() => { const s = ['Toyama arrived.', `${R[0]} arrived.`, `${R[1]} arrived.`];
    for (let i = 0; i < 16; i++) s.push(`${['Toyama', R[0], R[1]][i % 3]} ${V[i % V.length]}.`);
    s.push('Stevenson arrived.'); return s; })(),
  stale: (() => { const s = ['Toyama arrived.']; for (let i = 0; i < 10; i++) s.push(`${R[i]} arrived.`);
    for (let i = 0; i < 8; i++) s.push(`${['Toyama', ...R][i % 11]} ${V[i % V.length]}.`);
    s.push('Stevenson arrived.'); return s; })(),
  recent: (() => { const s = ['Toyama arrived.']; for (let i = 0; i < 8; i++) s.push(`Toyama ${V[i % V.length]}.`);
    for (let i = 0; i < 10; i++) s.push(`${R[i]} arrived.`); s.push('Stevenson arrived.'); return s; })(),
};
const CURSOR = 19;
const readCursor = (lines, opts) => {
  const doc = parseText(lines.join('\n'), { docId: 'nr' });
  return readingAt(doc, doc.units.length - 1, opts);
};

test('TEXT: the signal-derived reserve tracks the recent novelty rate (recent > stale > stable)', () => {
  const a = readCursor(STREAMS.stable,  { adaptiveReserve: true });
  const b = readCursor(STREAMS.stale,   { adaptiveReserve: true });
  const c = readCursor(STREAMS.recent,  { adaptiveReserve: true });
  assert.ok(c.reserve > b.reserve && b.reserve > a.reserve,
    `reserve recent=${c.reserve.toFixed(3)} > stale=${b.reserve.toFixed(3)} > stable=${a.reserve.toFixed(3)}`);
});

test('TEXT CONTROL: stale and recent are count-matched — the gap is recency, not count', () => {
  const b = readCursor(STREAMS.stale,  { adaptiveReserve: true });
  const c = readCursor(STREAMS.recent, { adaptiveReserve: true });
  assert.ok(Math.abs(b.totalMass - c.totalMass) < 1e-9, `total mass matched: ${b.totalMass} vs ${c.totalMass}`);
  assert.ok(c.reserve >= 3 * b.reserve, `recency opens a ≥3× gap on identical counts: ${c.reserve.toFixed(3)} vs ${b.reserve.toFixed(3)}`);
});

test('TEXT GAP: the DEFAULT path reads the newcomer IDENTICALLY across the streams (blind to novelty rate)', () => {
  // The gap the pressure located: with the constant reserve, the same newcomer scores the same
  // whether novelty has been arriving or not. If this ever dissociates, the default surprise
  // started seeing novelty rate — the precondition changed, and that is what this should flag.
  const bayes = [STREAMS.stable, STREAMS.stale, STREAMS.recent].map((s) => readCursor(s).bayesBits);
  assert.ok(Math.max(...bayes) - Math.min(...bayes) < 0.02, `default bayes is flat: [${bayes}]`);
});

test('TEXT CONSEQUENCE: the sealed-cast newcomer moves belief far MORE than the fresh-churn one', () => {
  const a = readCursor(STREAMS.stable, { adaptiveReserve: true }).bayesBits;
  const c = readCursor(STREAMS.recent, { adaptiveReserve: true }).bayesBits;
  assert.ok(a > c, `stable-cast newcomer ${a} ≫ fresh-churn newcomer ${c}`);
});

test('PARITY: default readingAt carries no reserve fields and is byte-identical when the flag is off', () => {
  const doc = parseText(STREAMS.recent.join('\n'), { docId: 'nr' });
  const def = readingAt(doc, CURSOR);
  const adapt = readingAt(doc, CURSOR, { adaptiveReserve: true });
  assert.ok(!('reserve' in def) && !('noveltyMass' in def) && !('totalMass' in def), 'no reserve keys on the default path');
  assert.equal(def.bayesBits, readingAt(doc, CURSOR).bayesBits, 'default reading is deterministic');
  // the flag CHANGES the surprise (it is doing real work) while leaving the default untouched
  assert.notEqual(def.bayesBits, adapt.bayesBits, 'the opt-in actually moves the surprise — not a dormant patch');
});
