import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  learningProgress, voidScore, rankByLearningProgress, pickVoid, isOpen,
} from '../src/write/voids.js';
import { createFold } from '../src/write/fold.js';
import { createIdleLoop, seededRng } from '../src/write/idle.js';

// SPEC §15 — curiosity as the DERIVATIVE OF COMPETENCE, not the level of confusion.
// The idle walk must be DRAWN to the frontier (surprise that shrinks when poked) and
// REPELLED by the wall (the noisy-TV / garbled-OCR trap: high surprise, never shrinks).
// Reward raw surprise and the creature stares at static forever; reward learning
// progress and it explores like a kid. This file locks that knob.

const open = (rid) => ({ rid, head: rid, text: rid, band: 'void', reason: '' });

test('the noisy-TV control: a high-REC, zero-shrinkage void ranks BELOW a quieter improving one', () => {
  const ledger = [open('wall'), open('frontier')];
  const history = new Map([
    ['wall', [0.9, 0.9, 0.9, 0.9]],      // maximally surprising, learns nothing — the static
    ['frontier', [0.5, 0.4, 0.3, 0.2]],  // yesterday confused, today slightly less so
  ]);
  const ranked = rankByLearningProgress(ledger, history, { priorLP: 0 });
  assert.equal(ranked[0].rid, 'frontier', 'curiosity is the derivative of competence, not the level of confusion');
  assert.equal(ranked[1].rid, 'wall', 'the wall — high surprise, no learning — is correctly repelled');
});

test('the flow channel: frontier ranks above the exhausted, the wall, and the too-hard', () => {
  const ledger = [open('exhausted'), open('wall'), open('toohard'), open('frontier')];
  const history = new Map([
    ['exhausted', [0.05, 0.04, 0.05, 0.04]], // too-easy: nothing left, bores
    ['wall', [0.9, 0.9, 0.9, 0.9]],          // too-hard, inert: high surprise, no shrinkage
    ['toohard', [0.2, 0.4, 0.6, 0.8]],       // re-surfing makes it WORSE — repel
    ['frontier', [0.7, 0.55, 0.4, 0.25]],    // the edge of its own knowing
  ]);
  const ranked = rankByLearningProgress(ledger, history, { priorLP: 0 }).map((e) => e.rid);
  assert.equal(ranked[0], 'frontier', 'drawn to where competence grows fastest');
  assert.equal(ranked[ranked.length - 1], 'toohard', 'rising surprise (losing competence) is repelled hardest');
});

test('optimism under uncertainty: an unpoked void is explored before being judged a wall', () => {
  const ledger = [open('wall'), open('fresh')];
  const history = new Map([['wall', [0.9, 0.9, 0.9]]]); // 'fresh' was never poked
  const ranked = rankByLearningProgress(ledger, history); // default priorLP is optimistic
  assert.equal(ranked[0].rid, 'fresh', 'the edge of its own knowing — the unpoked — is explored first');
});

test('learningProgress: REC falling is progress (+), flat or rising is not', () => {
  assert.ok(learningProgress([0.8, 0.6, 0.4, 0.2]) > 0, 'shrinking surprise = learning');
  assert.ok(Math.abs(learningProgress([0.9, 0.9, 0.9, 0.9])) < 1e-9, 'the wall: no shrinkage, no progress');
  assert.ok(learningProgress([0.2, 0.4, 0.6, 0.8]) < 0, 'rising surprise = the too-hard region');
  assert.equal(learningProgress([0.5]), null, 'one poke cannot show a trend');
  assert.equal(learningProgress([]), null, 'unmeasured void has no progress to read');
});

test('recency: a void that fell early then flatlined reads as exhausted NOW, not still-paying', () => {
  // the big drop (0.9 → 0.1) is OLDER than the recent window, so it is not credited now
  const fellLongAgo = learningProgress([0.9, 0.1, 0.1, 0.1, 0.1, 0.1], { window: 4 });
  // the same-size drop happening WITHIN the window still reads as live progress
  const fallingNow = learningProgress([0.1, 0.1, 0.9, 0.6, 0.3, 0.1], { window: 4 });
  assert.ok(Math.abs(fellLongAgo) < 1e-9, 'an old drop outside the window is not still-paying');
  assert.ok(fallingNow > 0.2, 'a drop inside the window is live learning progress');
});

test('voidScore falls back to the optimistic prior only when unmeasured', () => {
  const history = new Map([['known', [0.9, 0.9]]]);
  assert.equal(voidScore('unseen', history, { priorLP: 1 }), 1, 'unmeasured ⇒ optimistic prior');
  assert.ok(Math.abs(voidScore('known', history)) < 1e-9, 'a measured wall scores its (zero) progress, not the prior');
});

test('pickVoid biases attention to the frontier yet never LOCKS (I5)', () => {
  const ledger = [open('wall'), open('frontier')];
  const history = new Map([
    ['wall', [0.9, 0.9, 0.9, 0.9]],
    ['frontier', [0.6, 0.45, 0.3, 0.15]],
  ]);
  const rng = seededRng(7);
  const counts = { wall: 0, frontier: 0 };
  for (let i = 0; i < 400; i++) counts[pickVoid(ledger, rng, { history }).rid]++;
  assert.ok(counts.frontier > counts.wall, 'drawn to where competence grows fastest');
  assert.ok(counts.wall > 0, 'I5: the wall keeps a probability floor — attention biases, never locks');
});

test('pickVoid with NO history is byte-identical to the original seeded-uniform walk (I5)', () => {
  const ledger = [open('a'), { rid: 'b', head: 'b', text: 'b', band: 'hedged', reason: '' }];
  // the original implementation: open[floor(rng()*len) % len], one draw per call
  const reference = (lg, rng) => {
    const o = lg.filter(isOpen);
    return o[Math.floor(rng() * o.length) % o.length];
  };
  const mine = seededRng(11), ref = seededRng(11);
  for (let i = 0; i < 50; i++) {
    assert.equal(pickVoid(ledger, mine).rid, reference(ledger, ref).rid, 'default path unchanged');
  }
});

test('the idle loop forages the frontier: a one-void waking is unaffected (parity)', () => {
  // wiring recHistory into the loop must not perturb a single-void waking — there is
  // only one thing to attend, so the frontier bias is a no-op and the rng advances as
  // before. (Multi-void foraging is exercised by pickVoid above.)
  const fold = createFold();
  fold.appear('r#7f3', { head: 'the LLC behind the surveillance MOU' });
  let emitted = false;
  const surf = ({ void: v, docs }) => {
    const bears = docs.some((d) => d.bearsOn === v.rid);
    if (bears && !emitted) { emitted = true; return { rec: 0.9, bearsOn: 'A filing lists Bradshaw Holdings LLC.' }; }
    return { rec: 0.1 };
  };
  const loop = createIdleLoop({ fold, surf, medianBand: 0.5, rng: seededRng(1) });
  const r = loop.arrive({ bearsOn: 'r#7f3' });
  assert.equal(r.candidates.length, 1, 'one reafferent candidate, exactly as before the frontier wiring');
  assert.match(r.candidates[0].body, /Bradshaw Holdings/);
});
