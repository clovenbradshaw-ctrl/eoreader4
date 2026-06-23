import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLog } from '../src/core/log.js';
import { readingAt } from '../src/perceiver/reading.js';
import { predictiveSequenceReading } from '../src/surfer/index.js';
import { noveltyAmplitude, NOVELTY_RESERVE } from '../src/core/surprise.js';

// REGRESSION LOCK — the novelty reserve, signal-derived (the constant hunt).
// Pressure archive: experiments/cycle-0001-novelty-reserve.  Cell: REC(Generate × Interpretation).
//
// THE GAP. A fixed novelty reserve, run through the Born step `reserve = novelty/(Σmass+novelty)`,
// is blind to whether newcomers have actually been arriving — only the accumulated mass moves it.
// So the reader grows equally certain that nothing new will come whether it just saw a burst of
// first-appearances or a long stretch of pure confirmation. THE FIX. The reserve AMPLITUDE tracks
// the γ-decayed RATE of first-appearances (noveltyAmplitude), under the same kernel the figure
// field decays under, fed through the UNCHANGED Born step. Context enters at the amplitude; the
// law is untouched. Gated by opts.adaptiveNovelty so the default is byte-identical.
//
// THE CONTROL. The two contexts are matched on total γ-mass (six deposits, same decay positions),
// so the ONLY thing that differs is the novelty rate. A method keying on the loud surface signal
// (total mass / step count / the probe's own −log p) gives the SAME answer for both and cannot win
// the dissociation. Only reading the context's novelty rate distinguishes them. Written to fail the
// day the gate is removed (the goldens move) OR the recipe stops tracking the rate (the dissociation
// or the control collapses).

const m = (obj) => new Map(Object.entries(obj));

// An abstract comparable-ordered unit stream as an INS-only log — no meaning, no labels, just
// units. The SAME stream is read by the figure-field reader (text) and the n-gram learner (the
// sense that reads melodies): one stimulus, two senses, one interior recipe (the omnimodal gate).
const unitStream = (ids) => {
  const log = createLog({ docId: 'novelty-stim' });
  ids.forEach((id, i) => log.append({ op: 'INS', id, label: id, sentIdx: i }));
  return { log, units: ids.map((_, i) => `u${i}`) };
};

const CHURN   = ['a', 'b', 'c', 'd', 'e', 'f'];   // every step a newcomer — a high novelty rate
const CONFIRM = ['a', 'a', 'a', 'a', 'a', 'a'];   // one figure, then pure confirmation — rate → 0
// CHURN and CONFIRM deposit the SAME number of units at the SAME decay positions, so their total
// γ-mass at the probe is identical: the constant reserve (∝ 1/(mass+1)) MUST read them the same.

const textProbe = (ctx, probe, adaptiveNovelty) => {
  const doc = unitStream([...ctx, probe]);
  return readingAt(doc, ctx.length, { adaptiveNovelty });
};

// --- The recipe itself: a γ-decayed count of first-appearances, modality-agnostic. -----------
test('noveltyAmplitude is the γ-decayed rate of first-appearances — high under churn, low after confirmation', () => {
  // CHURN: six first-appearances at steps 0..5.  CONFIRM: one first-appearance at step 0.
  const churn   = noveltyAmplitude([0, 1, 2, 3, 4, 5], 6, 0.7);
  const confirm = noveltyAmplitude([0], 6, 0.7);
  assert.ok(churn > confirm * 5, `churn (${churn}) must dwarf confirm (${confirm}) — the rate, not the count`);
  // Causal: a first-appearance AT or AFTER the cursor never counts.
  assert.equal(noveltyAmplitude([6, 7], 6, 0.7), 0, 'only first-appearances strictly before the cursor');
  // Same decay the figure field uses: the most-recent first-appearance carries weight γ^0 = 1.
  assert.equal(noveltyAmplitude([5], 6, 0.7), 1, 'the newcomer one step back weighs γ^0 = 1');
});

// --- PARITY (flag off): the default reserve is the constant, blind to novelty history. --------
test('PARITY — flag off, the constant reserve reads matched-mass contexts IDENTICALLY (the gap, pinned)', () => {
  const ch = textProbe(CHURN, 'z', false);
  const co = textProbe(CONFIRM, 'z', false);
  // Byte-identical to the pre-fix engine: the newcomer is equally surprising either way, because
  // the constant cannot see that one context churned and the other settled. This is the gap.
  assert.equal(ch.surprisalBits, co.surprisalBits, 'the constant reserve is blind to the novelty rate');
  assert.equal(ch.surprisalBits, 1.98, 'exact pre-fix value — a refactor that shifts the default trips here');
  // And the default truly is the constant reserve.
  assert.equal(NOVELTY_RESERVE, 1.0);
});

// --- THE DISSOCIATION (flag on): the newcomer is more surprising after a confirmation stretch. -
test('FLAG ON — a newcomer into a SETTLED context is far more surprising than into a CHURNING one', () => {
  const ch = textProbe(CHURN, 'z', true);
  const co = textProbe(CONFIRM, 'z', true);
  assert.equal(ch.surprisalBits, 1.0,  'after churn the reader expected novelty — the newcomer barely surprises');
  assert.equal(co.surprisalBits, 4.21, 'after a confirmation stretch the reader had settled — the newcomer shocks');
  assert.ok(co.surprisalBits > ch.surprisalBits + 2,
    `the dissociation a constant cannot make: settled ${co.surprisalBits} ≫ churning ${ch.surprisalBits}`);
});

// --- THE CONTROL: the loud surface signal must NOT win. ----------------------------------------
test('CONTROL — the quiet newcomer beats the loud confirmation (surface presence is not significance)', () => {
  // In CONFIRM, the standing figure `a` carries the maximal prior mass (the loudest possible
  // surface), while the newcomer `z` carries none. A method scoring by presence/mass would rank
  // `a` over `z`. The correct reader ranks the quiet newcomer far above the loud confirmation.
  const z = textProbe(CONFIRM, 'z', true);
  const a = textProbe(CONFIRM, 'a', true);
  assert.equal(a.surprisalBits, 0.08, 'a re-confirmation of the loudest figure barely moves — not significance');
  assert.ok(z.surprisalBits > a.surprisalBits + 3,
    `the quiet newcomer (${z.surprisalBits}) dominates the loud confirmation (${a.surprisalBits})`);
});

// --- THE OMNIMODAL GATE: the SAME recipe, a SECOND sense (the n-gram learner that reads melodies).
test('OMNIMODAL — the same reserve recipe moves the n-gram learner the same way (text + sequence)', () => {
  const seqProbe = (ctx, adaptiveNovelty) => {
    const doc = unitStream([...ctx, 'z']);
    const steps = predictiveSequenceReading(doc, { order: 2, adaptiveNovelty });
    return steps[steps.length - 1].pNovel;   // the reserve at the probe cursor
  };
  const chOff = seqProbe(CHURN, false),   coOff = seqProbe(CONFIRM, false);
  const chOn  = seqProbe(CHURN, true),    coOn  = seqProbe(CONFIRM, true);

  // A single constant cannot move in two directions. The signal-derived amplitude RAISES the
  // reserve under churn (stay open to novelty) and LOWERS it after confirmation (settle) — relative
  // to the very same constant-reserve baseline. That two-way move IS the capability.
  assert.ok(chOn > chOff, `churn: flag on raises the reserve (${chOn} > ${chOff}) — stays open to newcomers`);
  assert.ok(coOn < coOff, `confirm: flag on lowers the reserve (${coOn} < ${coOff}) — settles`);
  assert.ok(chOn > coOn + 0.25,
    `flag on, churn reserve ≫ confirm reserve (${chOn} vs ${coOn}) — the rate now governs both senses`);
});

// --- Cold start is finite (absolute continuity): an opening under the flag does not blow up. ---
test('an opening under the flag is finite — the amplitude floor keeps the KL defined', () => {
  const doc = unitStream(['a', 'b']);
  const r0 = readingAt(doc, 0, { adaptiveNovelty: true });
  const r1 = readingAt(doc, 1, { adaptiveNovelty: true });
  for (const r of [r0, r1]) {
    assert.ok(Number.isFinite(r.surprisalBits) && Number.isFinite(r.bayesBits),
      `surprise stays finite at cold start, got ${r.surprisalBits}/${r.bayesBits}`);
  }
  assert.equal(r0.bayesBits, 0, 'the opening still falls to exactly zero — no prior to diverge from');
});
