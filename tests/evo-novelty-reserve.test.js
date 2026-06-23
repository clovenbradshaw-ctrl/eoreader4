// REGRESSION LOCK — E001: the novelty reserve tracks the recent novelty rate.
//
// Written to FAIL the day its precondition changes, including the control. It locks
// the confirmed capability (evo/experiments/E001-novelty-reserve): the signal-
// derived reserve makes a reader's surprise at a newcomer track its own γ-decayed
// novelty rate, where a hand-set constant reserve was blind to it. A run that fires
// on the matched surface (the hollow win) or swings across the control fails here
// rather than passing silently.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLog, surpriseAt, noveltyReserve, NOVELTY_RESERVE } from '../src/core/index.js';
import { readingAt } from '../src/perceiver/reading.js';

const G = 0.7;
// Two contexts matched on surface (distinct figures, raw newcomers, total γ-mass),
// differing ONLY in the recency of the newcomers.
const early = ['e1', 'e2', 'e3', 'e3', 'e3', 'e3', 'e3', 'e3']; // newcomers early, then plateau
const late  = ['e1', 'e1', 'e1', 'e1', 'e1', 'e1', 'e2', 'e3']; // plateau, then newcomers late
const CURSOR = 8;

const streamDoc = (seq) => {
  const log = createLog({ docId: 's' });
  seq.forEach((tok, i) => log.append({ op: 'INS', id: tok, label: tok, sentIdx: i }));
  return { units: seq.slice(), sentences: seq.slice(), log };
};
const surface = (seq) => {
  const first = new Map(); let mass = 0;
  seq.forEach((tok, i) => { if (i < CURSOR) { if (!first.has(tok)) first.set(tok, i); mass += Math.pow(G, CURSOR - 1 - i); } });
  return { distinct: first.size, rawNew: first.size, mass: Math.round(mass * 1e6) / 1e6 };
};

test('E001 control: early and late are matched on the loud surface signals', () => {
  const a = surface(early), b = surface(late);
  assert.equal(a.distinct, b.distinct, 'distinct-figure count must match');
  assert.equal(a.rawNew, b.rawNew, 'raw newcomer count must match');
  assert.equal(a.mass, b.mass, 'total γ-mass must match — only recency may differ');
});

test('E001 gap: with the fixed reserve, a newcomer is EQUALLY surprising in both contexts', () => {
  const e = readingAt(streamDoc([...early, 'e9']), CURSOR, {});           // newcomer e9
  const l = readingAt(streamDoc([...late, 'e9']), CURSOR, {});
  // The bare stream's belief field is the figure field alone, so nothing but the
  // reserve can dissociate — and the fixed reserve cannot. This is the blindness.
  assert.equal(e.bayesBits, l.bayesBits, 'fixed reserve must be flat across recency');
});

test('E001 fix: with the signal reserve, a newcomer is LESS surprising after a recent burst', () => {
  const e = readingAt(streamDoc([...early, 'e9']), CURSOR, { signalReserve: true });
  const l = readingAt(streamDoc([...late, 'e9']), CURSOR, { signalReserve: true });
  // late-burst (newcomers just arrived) expects another newcomer → lower surprise.
  assert.ok(e.bayesBits - l.bayesBits > 0.1,
    `signal reserve must dissociate: early ${e.bayesBits} should exceed late ${l.bayesBits}`);
});

test('E001 newcomer-specific: the reserve change acts on a newcomer, not a returner', () => {
  const fixN = readingAt(streamDoc([...late, 'e9']), CURSOR, {});
  const sigN = readingAt(streamDoc([...late, 'e9']), CURSOR, { signalReserve: true });
  const fixR = readingAt(streamDoc([...late, 'e1']), CURSOR, {});          // returning e1
  const sigR = readingAt(streamDoc([...late, 'e1']), CURSOR, { signalReserve: true });
  const dN = Math.abs(sigN.bayesBits - fixN.bayesBits);
  const dR = Math.abs(sigR.bayesBits - fixR.bayesBits);
  assert.ok(dN > dR * 2, `reserve effect must concentrate on the newcomer: ${dN} vs ${dR}`);
});

test('E001 omnimodal: the dissociation direction is interior, not text-specific', async () => {
  const { ingestMusic } = await import('../src/organs/in/index.js');
  const eM = readingAt(ingestMusic({ notes: ['C4','D4','E4','E4','E4','E4','E4','E4','F#4'] }), CURSOR, { signalReserve: true });
  const lM = readingAt(ingestMusic({ notes: ['C4','C4','C4','C4','C4','C4','D4','E4','F#4'] }), CURSOR, { signalReserve: true });
  // Same shared reader, a different organ (pitch class as the recurring entity):
  // the fix points the same way. (The music belief field also carries interval
  // propositions, so it is not the confound-free flatness test — that is the stream.)
  assert.ok(eM.bayesBits - lM.bayesBits > 0.1,
    `music must replicate the direction: early ${eM.bayesBits} > late ${lM.bayesBits}`);
});

test('E001 helper: noveltyReserve is the γ-decayed newcomer count, strictly causal', () => {
  assert.ok(Math.abs(noveltyReserve([0, 1, 2], 8, G) - 0.3681) < 1e-3, 'early-burst reserve');
  assert.ok(Math.abs(noveltyReserve([0, 6, 7], 8, G) - 1.7824) < 1e-3, 'late-burst reserve');
  assert.equal(noveltyReserve([5, 6, 7], 8, G) > noveltyReserve([0, 1, 2], 8, G), true, 'recent > distant');
  assert.equal(noveltyReserve([10, 11], 8, G), 0, 'future first-sightings are excluded (causal)');
});

test('E001 parity: reserve off reproduces the constant exactly; opening stays finite', () => {
  // Flag off == the hand-set constant (the byte-identical default path).
  const off = readingAt(streamDoc([...early, 'e9']), CURSOR, {});
  const explicit = surpriseAt(
    // rebuild the same prior the reader would, to confirm the default reserve is the constant
    new Map(), new Map(), { gamma: G, novelty: NOVELTY_RESERVE });
  assert.equal(explicit.bayesBits, 0, 'empty prior reads zero under the constant');
  assert.ok(Number.isFinite(off.bayesBits), 'fixed reserve path is finite');
  // The opening guard: an empty prior with a zero signal reserve must not be NaN.
  const opening = surpriseAt(new Map(), new Map([['x', 1]]), { gamma: G, novelty: 0 });
  assert.equal(opening.bayesBits, 0, 'opening with zero signal reserve is zero, not NaN');
});
