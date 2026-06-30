import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createRestCycle, AWAKE, RESTING,
  DEFAULT_NIGHT_PRESSURE, DEFAULT_MIN_DAY,
} from '../src/rest/cycle.js';
import { createFold } from '../src/write/fold.js';
import { createEnactedLoop } from '../src/core/enacted/index.js';

// docs/how-to-rest.md — the driver decides WHEN to rest. Pressure is read off the live
// fold (the integral losing its shape), not a clock. tick() blinks unless a night is
// owed; observe() is the day's intake; wake() recouples the night's hypotheses to EVA.
// The firewall is the type: every minted hypothesis is fromEnactor, so it can never
// ground itself. These drive the REAL fold and enacted loop.

// ── helpers — build a peaked vs a flat-high dossier on a real fold ────────────────
// A PEAKED referent: one loud descriptor, the rest fall away (a healthy integral).
const peakedRef = (fold, hash) => {
  fold.appear(hash, { head: hash });
  fold.record(hash, { t: 10, op: 'DEF', attr: 'the one that stands forward', res: 'firm' });
  fold.record(hash, { t: 0, op: 'DEF', attr: 'faded a', res: 'firm' });
  fold.record(hash, { t: 0, op: 'DEF', attr: 'faded b', res: 'firm' });
};
// A FLAT-HIGH referent: many descriptors all bound at the same recent time — every
// binding loud, nothing standing forward (the saturation reproject names).
const flatRef = (fold, hash, n = 6) => {
  fold.appear(hash, { head: hash });
  for (let i = 0; i < n; i++) fold.record(hash, { t: 10, op: 'DEF', attr: `loud ${i}`, res: 'firm' });
};

// ── pressure — the shape of the live integral ────────────────────────────────────

test('pressure reads a peaked integral as low saturation, a flat-high one as high', () => {
  const peaked = createFold(); peakedRef(peaked, 'r#1');
  const flat = createFold(); flatRef(flat, 'r#1');
  const cyclePeaked = createRestCycle({ fold: peaked });
  const cycleFlat = createRestCycle({ fold: flat });
  const sp = cyclePeaked.pressure();
  const sf = cycleFlat.pressure();
  assert.ok(sf.saturation > sp.saturation, 'flat-high saturates more than peaked');
  assert.ok(sf.saturation > 0.9, 'every binding near the ceiling reads near 1');
  assert.ok(sp.saturation < 0.5, 'one descriptor forward, the rest fallen away');
});

test('pressure ignores a single-descriptor dossier (no tail → not flat-high)', () => {
  const fold = createFold();
  fold.appear('r#1', { head: 'lone' });
  fold.record('r#1', { t: 0, op: 'DEF', attr: 'only one', res: 'firm' });
  const cycle = createRestCycle({ fold });
  const p = cycle.pressure();
  assert.equal(p.saturation, 0, 'a lone descriptor is the most peaked thing, not saturated');
  assert.equal(p.referents, 0, 'it contributes no tail to the read');
});

test('pressure load rises with the day and trips value on its own (the weighted max)', () => {
  const fold = createFold(); peakedRef(fold, 'r#1');   // a healthy, peaked integral
  const cycle = createRestCycle({ fold, budget: 4 });
  assert.equal(cycle.pressure().load, 0, 'empty day, no load');
  for (let i = 0; i < 4; i++) cycle.observe({ hash: 'r#1' });
  const p = cycle.pressure();
  assert.equal(p.load, 1, 'a full day against the budget reads max load');
  // value is the weighted max — load alone trips it though saturation is low
  assert.ok(p.value >= p.saturation, 'value takes the larger signal');
  assert.equal(p.value, 1);
});

// ── observe — the day's intake (bookkeeping; folds nothing) ───────────────────────

test('observe counts the day and remembers the referents it touched', () => {
  const fold = createFold(); fold.appear('r#1'); fold.appear('r#2');
  const cycle = createRestCycle({ fold });
  cycle.observe({ hash: 'r#1' });
  cycle.observe({ site: { hash: 'r#2' } });
  cycle.observe({ sites: ['r#1', { hash: 'r#2' }] });
  assert.equal(cycle.day, 3, 'every observation counts toward the day');
});

// ── tick — choose the cadence (the blink and the night) ───────────────────────────

test('tick blinks when no night is owed — re-integrates the touched, does not forget', () => {
  const fold = createFold(); peakedRef(fold, 'r#1');   // healthy: low saturation
  const cycle = createRestCycle({ fold });
  cycle.observe({ hash: 'r#1' });
  const r = cycle.tick(20);
  assert.equal(r.mode, 'blink');
  assert.equal(cycle.lastMode, 'blink');
  assert.equal(r.hypotheses, null, 'a blink does not descend or forget');
  assert.equal(cycle.phase, AWAKE, 'a blink leaves the engine awake');
  assert.equal(r.reprojected.length, 1, 'only the day-touched referent was re-projected');
});

test('tick refuses a night on a short day even under pressure (the refractory floor)', () => {
  const fold = createFold(); flatRef(fold, 'r#1');     // saturated → value high
  const cycle = createRestCycle({ fold, minDay: DEFAULT_MIN_DAY });
  cycle.observe({ hash: 'r#1' });                       // day length 1 < minDay
  assert.ok(cycle.pressure().value >= DEFAULT_NIGHT_PRESSURE, 'pressure says a night is due');
  const r = cycle.tick(20);
  assert.equal(r.mode, 'blink', 'but a night never sleeps on nothing — the day is too short');
});

test('tick runs a night when pressure crosses and the day is long enough', () => {
  const fold = createFold();
  flatRef(fold, 'r#1');                                 // a saturated, flat-high integral

  // a real enacted run gives the night frames to descend (reverse-learn)
  const surprises = [0, 0, 5, 5, 0, 0, 0, 0, 0, 0];
  const loop = createEnactedLoop({
    layers: ['proposition', 'document'], thresholds: { proposition: 1.5, document: 4.0 },
    confirmBand: 1.0, read: (c) => ({ surprise: surprises[c], terms: ['x'] }),
  });
  loop.runTo(surprises.length - 1);

  const cycle = createRestCycle({
    fold, enacted: loop, minDay: 3,
    figurable: (e) => e?.figurable === true,
  });
  // a long enough day, of real events to hold as residue
  cycle.observe({ hash: 'r#1', figurable: true });
  cycle.observe({ hash: 'r#1', figurable: false });
  cycle.observe({ hash: 'r#1', figurable: false });
  cycle.observe({ hash: 'r#1', figurable: true });

  const r = cycle.tick(50);
  assert.equal(r.mode, 'night', 'pressure crossed and the day was long enough');
  assert.ok(Array.isArray(r.forgotten), 'the night reverse-learned the frames');
  assert.equal(r.ground.kind, 'ground', 'the un-figurable residue is held as Ground');
  assert.ok(r.hypotheses.length >= 1, 'the night minted hypotheses');
  assert.equal(cycle.phase, RESTING, 'after a night the engine rests until wake');
  assert.equal(cycle.pending, r.hypotheses.length, 'the hypotheses are queued for wake');
  assert.equal(cycle.day, 0, 'the day counters reset — the backlog is cleared');
  // the integral was re-projected toward baseline with headroom returned
  assert.ok(r.reprojected.some(x => x.headroom > 0));
});

// ── the firewall — a dream hypothesis can never ground itself ─────────────────────

test('every minted hypothesis is fromEnactor — canGround is false (the §8 firewall)', () => {
  const fold = createFold(); flatRef(fold, 'r#1');
  const loop = createEnactedLoop({ layers: ['proposition'], thresholds: { proposition: 1.5 }, confirmBand: 1.0, read: () => ({ surprise: 0, terms: ['x'] }) });
  loop.runTo(4);
  const cycle = createRestCycle({ fold, enacted: loop, minDay: 1 });
  cycle.observe({ hash: 'r#1' });
  const r = cycle.tick(20);
  assert.equal(r.mode, 'night');
  for (const h of r.hypotheses) {
    assert.equal(h.grounded, false, 'a hypothesis is not grounded');
    assert.equal(cycle.canGround(h), false, 'and it cannot ground itself — the type bars it');
  }
});

// ── wake — recouple the queue to EVA ──────────────────────────────────────────────

test('wake recouples the queue — survivors become ungrounded proposals, the rest drop', () => {
  const fold = createFold(); flatRef(fold, 'r#1');
  const loop = createEnactedLoop({
    layers: ['proposition', 'document'], thresholds: { proposition: 1.5, document: 4.0 },
    confirmBand: 1.0, read: (c) => ({ surprise: [0, 0, 5, 5, 0, 0][c] ?? 0, terms: ['x'] }),
  });
  loop.runTo(5);
  const cycle = createRestCycle({ fold, enacted: loop, minDay: 1 });
  cycle.observe({ hash: 'r#1' });
  const night = cycle.tick(20);
  assert.ok(night.hypotheses.length >= 1);
  assert.equal(cycle.phase, RESTING);

  // the world's second look: keep only hypotheses on layer 'proposition'
  const { proposals, broken } = cycle.wake((h) => h.layer === 'proposition');
  assert.equal(proposals.length + broken.length, night.hypotheses.length, 'every hypothesis was judged');
  for (const p of proposals) {
    assert.equal(p.proposal, true, 'a survivor comes back as a proposal');
    assert.equal(p.grounded, false, 'but a proposal is STILL not grounded — the witness act promotes');
  }
  assert.equal(cycle.phase, AWAKE, 'the morning: the engine is awake again');
  assert.equal(cycle.pending, 0, 'the queue is cleared');
});

test('wake throws without an injected EVA (the world\'s second look is not the cycle\'s to invent)', () => {
  const fold = createFold();
  const cycle = createRestCycle({ fold });
  assert.throws(() => cycle.wake(null), /evaluate/);
});

test('createRestCycle throws without a fold', () => {
  assert.throws(() => createRestCycle({}), /fold/);
});
