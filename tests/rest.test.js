import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reproject, reprojectIntegral, descend, reverseLearn,
  holdAsGround, recouple, markHypothesis, recombine, rest,
  NIGHT_VOLUME, BLINK_VOLUME,
} from '../src/rest/index.js';
import { createFold } from '../src/write/fold.js';
import { createEnactedLoop } from '../src/core/enacted/index.js';

// docs/how-to-rest.md — rest is integration, not recovery. The nine operators run in
// the OTHER direction: re-project the integral at lower volume, descend the helix to
// forget by failing to regenerate, hold the un-figurable as Ground, recouple to EVA
// on wake. These run the SAME structures the wake side built (the fold's integral,
// the enacted loop's frames), so the tests drive those real structures.

// ── reproject — shed the absolute weight, keep the proportion ────────────────────

test('reproject re-projects to a lower volume, preserving the proportion (the shape)', () => {
  const items = [{ key: 'a', weight: 1.0 }, { key: 'b', weight: 0.5 }, { key: 'c', weight: 0.25 }];
  const re = reproject(items, { volume: 0.5 });
  // the new peak is exactly the volume; headroom is returned to the top
  assert.equal(re.peak, 0.5);
  assert.equal(re.headroom, 0.5);
  // EVERY pairwise ratio is unchanged — the relative shape survived the downscale
  const w = Object.fromEntries(re.items.map(it => [it.key, it.weight]));
  assert.ok(Math.abs(w.a / w.b - 2) < 1e-9, 'a:b ratio preserved');
  assert.ok(Math.abs(w.b / w.c - 2) < 1e-9, 'b:c ratio preserved');
  // and the absolute magnitude dropped — the loud bindings quieted
  assert.ok(w.a < items[0].weight, 'the top binding came down toward baseline');
  assert.ok(re.shapePreserved);
});

test('reproject of nothing bound returns full headroom (already at baseline)', () => {
  const re = reproject([], { volume: 0.5 });
  assert.equal(re.peak, 0);
  assert.equal(re.headroom, 1);
});

test('reprojectIntegral keeps a uniformly-old dossier by RELATIVE standing, not absolute volume', () => {
  // A dossier whose descriptors are all OLD — every absolute γ-weight is tiny. The wake
  // fold's absolute keep-threshold would forget the whole thing (length deciding
  // standing). Rest keeps by proportion, so the shape survives the re-projection.
  const fold = createFold({ gamma: 0.8 });
  fold.appear('r#1', { head: 'Gregor' });
  fold.record('r#1', { t: 0, op: 'DEF', attr: 'the provider', res: 'firm' });
  fold.record('r#1', { t: 2, op: 'DEF', attr: 'turned to an insect', res: 'firm' });
  const cursor = 60;   // far in the future — γ^60 is vanishing for both
  const wake = fold.dossierOf('r#1', cursor);
  assert.equal(wake.descriptors.length, 0, 'awake, absolute decay forgets the whole old dossier');
  const rested = reprojectIntegral(fold, 'r#1', { t: cursor, volume: NIGHT_VOLUME });
  assert.equal(rested.descriptors.length, 2, 'rested, relative standing keeps the shape');
  assert.equal(rested.head, 'Gregor');
  // the more-recent descriptor stands higher in the re-projection
  assert.equal(rested.descriptors[0].attr, 'turned to an insect');
  assert.ok(rested.headroom > 0);
});

// ── descend — forget by failing to regenerate ───────────────────────────────────

test('descend keeps patterns that regenerate a coherent instance, forgets the rest', () => {
  const patterns = [{ id: 'real', ok: true }, { id: 'spurious', ok: false }, { id: 'real2', ok: true }];
  const { kept, forgotten, instances } = descend(patterns, (p) => p.ok ? { from: p.id } : null);
  assert.deepEqual(kept.map(p => p.id), ['real', 'real2']);
  assert.deepEqual(forgotten.map(p => p.id), ['spurious']);
  assert.equal(instances.length, 2, 'an instance regenerated per kept pattern');
});

test('descend throws without an injected regenerator (the coherence test is not its to invent)', () => {
  assert.throws(() => descend([], null), /regenerate/);
});

test('reverseLearn forgets a frame that fit one arrival and nothing after', () => {
  // A reading whose document frame is forced by a burst then immediately re-forced,
  // with no confirming arrival between — the spurious coupling. Drive the real loop.
  const surprises = [0, 0, 0, 5, 5, 0, 0, 0];   // a confirming run, a straining burst, calm again
  const loop = createEnactedLoop({
    layers: ['proposition', 'document'],
    thresholds: { proposition: 1.5, document: 4.0 },
    confirmBand: 1.0,
    read: (c) => ({ surprise: surprises[c], terms: ['x'] }),
  });
  loop.runTo(surprises.length - 1);
  const { kept, forgotten } = reverseLearn(loop.events);
  // every kept frame either confirmed at least once or is the live standing commitment
  for (const p of kept) assert.ok(p.confirms > 0 || p.standing, 'kept ⇒ regenerated a coherent instance');
  // every forgotten frame earned no confirm and was replaced — it could not regenerate
  for (const p of forgotten) {
    assert.equal(p.confirms, 0, 'forgotten ⇒ no confirming arrival');
    assert.equal(p.standing, false, 'forgotten ⇒ not the live commitment, a discarded one');
  }
  assert.ok(kept.length >= 1, 'the initial/standing frames survive the descent');
});

// ── holdAsGround — let the un-figurable rest as Ground ───────────────────────────

test('holdAsGround sorts Figures from the un-figurable, holding the rest as ONE field', () => {
  const residue = ['a definite claim', 'an emanon', 'another fact', 'an un-namable shape'];
  const figurable = (x) => x.includes('claim') || x.includes('fact');
  const { figures, ground } = holdAsGround(residue, figurable);
  assert.deepEqual(figures, ['a definite claim', 'another fact']);
  // the un-figurable residue is held as a SINGLE uncollapsed field — not forced into
  // N proliferating Figures (the measurement-problem failure the dream avoids)
  assert.equal(ground.kind, 'ground');
  assert.equal(ground.collapsed, false);
  assert.deepEqual(ground.members, ['an emanon', 'an un-namable shape']);
});

test('holdAsGround throws without an injected figurability test', () => {
  assert.throws(() => holdAsGround([], null), /figurable/);
});

// ── recouple — wake, re-couple to EVA ────────────────────────────────────────────

test('recouple keeps only the dream figures the world declines to break', () => {
  const figures = [{ rhyme: 'holds' }, { rhyme: 'breaks' }, { rhyme: 'holds-too' }];
  const evaluate = (f) => f.rhyme.startsWith('holds');
  const { confirmed, broken } = recouple(figures, evaluate);
  assert.deepEqual(confirmed.map(f => f.rhyme), ['holds', 'holds-too']);
  assert.deepEqual(broken.map(f => f.rhyme), ['breaks']);
});

test('markHypothesis stamps a regenerated figure as ungrounded — it cannot ground itself', () => {
  const h = markHypothesis({ terms: ['x'] });
  assert.equal(h.hypothesis, true);
  assert.equal(h.grounded, false, 'the firewall: only a wake re-coupling to EVA can promote it');
});

// ── recombine — the dreamer: strengthen the meaningful-but-untraversed (the Born walk) ─

test('recombine rhymes only the UNtraversed pairs, ranked by the Born rule (amplitude²)', () => {
  // three referents; a—b already traversed awake (skip it), a—c strongly rhymes, b—c weakly.
  const items = ['a', 'b', 'c'];
  const aff = { 'a|c': 0.9, 'b|c': 0.3, 'a|b': 1.0 };
  const key = (x, y) => [x, y].sort().join('|');
  const { proposals, considered, mass } = recombine(items, {
    affinity: (x, y) => aff[key(x, y)] ?? 0,
    traversed: (x, y) => key(x, y) === 'a|b',     // the reading already walked a—b
  });
  assert.equal(considered, 2, 'only the two untraversed pairs are in the field');
  // the walk never surfaces the traversed pair
  assert.ok(!proposals.some(p => key(p.a, p.b) === 'a|b'), 'a—b was traversed; the dream skips it');
  // Born ranking: the strong rhyme dominates. weight ∝ amp² normalized: 0.81 vs 0.09.
  assert.equal(proposals[0].a === 'a' || proposals[0].b === 'a', true);
  assert.equal(key(proposals[0].a, proposals[0].b), 'a|c', 'the strong latent rhyme ranks first');
  assert.ok(proposals[0].weight > proposals[1].weight, 'the Born rule sharpens the field');
  // squaring sharpens: 0.81/0.9 = 0.9 of the mass to the top, not 0.9/1.2 = 0.75 (linear)
  assert.ok(proposals[0].weight > 0.85, 'amplitude² concentrates the measure on the strong rhyme');
  assert.ok(mass > 0);
});

test('recombine marks a faded prior a strengthen, a bare rhyme a propose — both ungrounded', () => {
  const { proposals } = recombine(['x', 'y', 'z'], {
    affinity: () => 0.8,
    prior: (a, b) => ([a, b].sort().join('|') === 'x|y' ? 0.2 : 0),  // x—y carried a faded bond
  });
  const xy = proposals.find(p => [p.a, p.b].sort().join('|') === 'x|y');
  const xz = proposals.find(p => [p.a, p.b].sort().join('|') === 'x|z');
  assert.equal(xy.kind, 'strengthen', 'a meaningful connection the reading under-traversed');
  assert.equal(xz.kind, 'propose', 'a latent rhyme with no prior bond');
  // every proposal is a hypothesis — ungrounded, cannot ground itself (the firewall)
  for (const p of proposals) { assert.equal(p.hypothesis, true); assert.equal(p.grounded, false); }
});

test('recombine keeps only the top-N by weight — most of the field evaporates (as it should)', () => {
  const items = ['a', 'b', 'c', 'd'];
  const strong = new Set(['a|b']);
  const { proposals } = recombine(items, {
    affinity: (x, y) => strong.has([x, y].sort().join('|')) ? 0.95 : 0.1,
    top: 2,
  });
  assert.equal(proposals.length, 2, 'only the top-N survive');
  assert.equal([proposals[0].a, proposals[0].b].sort().join('|'), 'a|b', 'the strongest rhyme survives');
});

test('recombine throws without an injected affinity (the rhyme test is not its to invent)', () => {
  assert.throws(() => recombine(['a', 'b'], {}), /affinity/);
});

// ── rest — the cadence (the blink and the night) ─────────────────────────────────

test('a blink re-integrates the recent at near-full volume, without descending or forgetting', () => {
  const fold = createFold();
  fold.appear('r#1', { head: 'Gregor' });
  fold.record('r#1', { t: 4, op: 'DEF', attr: 'the provider', res: 'firm' });
  const report = rest({ fold, hashes: ['r#1'] }, { mode: 'blink', t: 5 });
  assert.equal(report.mode, 'blink');
  assert.equal(report.volume, BLINK_VOLUME, 'the blink only takes the edge off');
  assert.equal(report.reprojected.length, 1);
  assert.equal(report.forgotten, null, 'the blink does not descend or forget');
  assert.equal(report.ground, null);
});

test('a night descends, forgets, holds Ground, and re-projects toward baseline', () => {
  const fold = createFold();
  fold.appear('r#1', { head: 'Gregor' });
  fold.record('r#1', { t: 2, op: 'DEF', attr: 'turned to an insect', res: 'firm' });

  const surprises = [0, 0, 5, 5, 0, 0];
  const loop = createEnactedLoop({
    layers: ['proposition', 'document'], thresholds: { proposition: 1.5, document: 4.0 },
    confirmBand: 1.0, read: (c) => ({ surprise: surprises[c], terms: ['x'] }),
  });
  loop.runTo(surprises.length - 1);

  const residue = ['a fact', 'an un-figurable shimmer'];
  const figurable = (x) => x.includes('fact');

  const report = rest(
    { fold, hashes: ['r#1'], events: loop.events, residue },
    { mode: 'night', figurable, t: 10 },
  );
  assert.equal(report.mode, 'night');
  assert.equal(report.volume, NIGHT_VOLUME, 'the night drops the top hard');
  assert.ok(Array.isArray(report.forgotten), 'the night reverse-learns');
  assert.equal(report.ground.kind, 'ground');
  assert.deepEqual(report.ground.members, ['an un-figurable shimmer'], 'the un-figurable rests as Ground');
  // the regenerated figures are hypotheses — ungrounded until wake recouples them
  assert.ok(report.hypotheses.length >= 1);
  for (const h of report.hypotheses) assert.equal(h.grounded, false);
  // the integral came down toward baseline with headroom returned
  assert.ok(report.reprojected[0].headroom > 0);
});

test('a night with the dreamer opted in ALSO strengthens the meaningful-but-untraversed', () => {
  const fold = createFold();
  fold.appear('r#1', { head: 'Gregor' });
  fold.record('r#1', { t: 2, op: 'DEF', attr: 'turned to an insect', res: 'firm' });

  // three referents; the reading traversed Gregor—Grete but never Gregor—the-lodgers,
  // though they share the household (a meaningful latent rhyme). The dream surfaces it.
  const items = ['gregor', 'grete', 'lodgers'];
  const aff = { 'gregor|lodgers': 0.8, 'grete|lodgers': 0.5 };
  const key = (a, b) => [a, b].sort().join('|');

  const report = rest(
    { fold, hashes: ['r#1'], events: [], residue: [], items },
    {
      mode: 'night', t: 10,
      recombine: {
        affinity: (a, b) => aff[key(a, b)] ?? 0,
        traversed: (a, b) => key(a, b) === 'gregor|grete',   // already read
      },
    },
  );
  assert.ok(report.strengthened, 'the dreamer ran');
  assert.equal(report.strengthened.considered, 2, 'only the untraversed rhymes were in the field');
  const top = report.strengthened.proposals[0];
  assert.equal(key(top.a, top.b), 'gregor|lodgers', 'the strongest latent rhyme leads');
  // its proposals are hypotheses on the same firewall as the descent's
  assert.ok(report.hypotheses.some(h => h.from === 'recombine'), 'the proposals join the night\'s hypotheses');
  for (const h of report.hypotheses) assert.equal(h.grounded, false, 'nothing the dream makes is grounded');
});

test('a night WITHOUT the dreamer leaves strengthened null (opt-in, per the doc)', () => {
  const fold = createFold();
  fold.appear('r#1', { head: 'x' });
  const report = rest({ fold, hashes: ['r#1'], events: [], residue: [] }, { mode: 'night', t: 5 });
  assert.equal(report.strengthened, null, 'the generative face stays off unless opted into');
});
