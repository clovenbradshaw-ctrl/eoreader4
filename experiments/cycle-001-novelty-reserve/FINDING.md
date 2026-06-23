# cycle-001 — the novelty reserve, made signal-derived

**Verdict: gap located → fixed → confirmed in two senses.** Gated behind `RULES_REV` /
`NOVELTY_RATE`; the shipped (flag-off) path is byte-identical; +7 regression-lock assertions.

## The pressure

An **inside-out constant hunt** crossed with an **outside-in orthogonal collision**.

The constant: `NOVELTY = 1.0` in `src/perceiver/reading.js` (and `NOVELTY_RESERVE = 1.0` in
`src/core/surprise.js`). It sets the reserve the reader holds for an as-yet-unseen atom:

```
reserve = novelty / (mass + novelty)   →   with novelty ≡ 1,   reserve = 1 / (mass + 1)
```

A function of the total γ-mass **alone**. So the reader reserves the same probability for a
newcomer after a burst of three newcomers as after a long stretch of pure confirmation — *"the
reader grows equally certain that nothing new will come whether it just saw three newcomers or
none."* That is the reader failing to learn from its own signal.

The seed (replayable, `archive.jsonl`): two random Wikipedia draws — **Dean of Ely** (rev
1313694173), an ecclesiastical *succession* of office-holders, and **Swing Street** (rev
1354076665), a *music* album. Forced into one shape: a stream whose **recent novelty rate**
varies, read once as figures-over-an-office (text/proposition basis) and once as
pitches-over-a-drone (tonal basis).

## The blind stimulus and its controls

Three matched conditions (`stimulus.json`, opaque ids, two senses each):

- **RECENT** — confirmation, then a burst of newcomers (admissions at steps 5,6,7).
- **EARLY** — a burst of newcomers, then confirmation (admissions at steps 0,1,2).
- **CONFIRM** — one admission, then confirmation throughout.

Every step deposits **exactly one unit of mass**, so the total γ-mass at the probe is
**identical** across all three. Two controls fall out of that:

1. **The loud surface is flat.** Total mass is held equal, so the *constant* reserve is provably
   identical across conditions — a method that keys on mass **cannot** tell them apart. Any win
   here that rides mass is caught.
2. **Recency, not count.** RECENT and EARLY carry the **same distinct-atom count** (4); they
   differ only in *when* the newcomers arrived. So a RECENT>EARLY result cannot be a
   cumulative-count effect — it is recency.

The held key (`key.json`) predicts, for a reader that learns from its signal: reserve
**RECENT > EARLY > CONFIRM** in both senses; constant reserve flat.

## The measurement (read-only) and the score (blind)

`measure.mjs` runs both amplitudes — the constant `1.0` and the signal-derived
`noveltyAmplitude` — through the **same** `forwardDist`/`surpriseAt`, emitting per-condition
channels. `score.mjs` reads the control first, then the per-item split. Result (`out.json`):

| cond | sense | total γ-mass | distinct | reserve **const** | reserve **tracked** | newcomer-surprise tracked |
| --- | --- | --- | --- | --- | --- | --- |
| RECENT  | A | 3.14 | 4 | **0.2415** | **0.4198** | 1.25 bits |
| EARLY   | A | 3.14 | 4 | **0.2415** | 0.1622 | 2.62 bits |
| CONFIRM | A | 3.14 | 1 | **0.2415** | 0.0255 | 5.29 bits |
| RECENT  | B | 3.14 | 4 | 0.2415 | 0.4198 | 1.25 bits |
| EARLY   | B | 3.14 | 4 | 0.2415 | 0.1622 | 2.62 bits |
| CONFIRM | B | 3.14 | 1 | 0.2415 | 0.0255 | 5.29 bits |

- **Gap (live engine):** the constant reserve is `0.2415` for **all** conditions — flat exactly
  where recency should separate them. The live reader is blind to its own recent novelty rate.
- **Capability (candidate):** the tracked reserve orders RECENT > EARLY > CONFIRM strictly, with
  RECENT and EARLY *matched on count* — so the separation is recency. A newcomer is least
  surprising to a reader that has lately seen newcomers (1.25 bits) and most surprising after a
  long confirmation run (5.29 bits).
- **Interior:** the identical ordering holds in sense A (proposition atoms) and sense B (tonal
  pitch atoms) — the same law and the same helper, two front-end maps.
- **Liveness:** through the real organ, `readingAt(...).pNext.reserve` is flat across two
  reorderings of the same atoms with the wiring off (0.2537 = 0.2537) and recency-ordered with
  it on (0.3884 > 0.2968). The patch changed the events on the production path.

## The fix (right layer, behind the gate)

The reserve is an **amplitude**; the **Born step is the law**. The fix touches only the
amplitude:

- `src/core/surprise.js` — new modality-agnostic `noveltyAmplitude(firstSeen, now, {gamma})` =
  Σ γ^(now-1-firstSeen): the γ-decayed count of first-appearances, under the **same** γ the
  field decays under. Strictly positive for any non-empty prior, so the KL stays absolutely
  continuous on a newcomer with no hand-set floor; 0 only at the opening, where there is no
  signal yet to learn the rate from.
- `src/perceiver/reading.js` — under `SIGNAL_RESERVE` (env `RULES_REV` or `NOVELTY_RATE`) or the
  explicit `opts.signalReserve`, the figure and proposition reserves use this amplitude instead
  of the constant. `forwardDist`/`surpriseAt` — the law — are **unchanged**.

`reserve = nu / (mass + nu)` is then literally the recent novelty **rate**: the γ-weighted
fraction of recent deposits that were newcomers.

## Scope — where it changes existing behavior

The fix is **gated off by default**, and the default suite is byte-identical (649 tests). With
the flag on, 6 existing tests diverge because they **encode the constant-reserve protention** —
the located structure, recorded honestly rather than papered over:

- **bayes #33** ("the same newcomer costs more entering a committed cast than a thin field") —
  *reverses*. That "committed" cast has newcomers arriving every two steps; under the rate
  reserve the reader has *learned* newcomers keep coming, so the next one is *less* surprising.
  This is the exact bug the pressure targets.
- **bayes #36** (REC liveness) — the bayes signal is **sharper, not numb**: it peaks at 0.279 on
  the *first* turnover (vs 0.152) and then *decays* as the rate is learned, instead of escalating
  with mass. The REC count is a median-band calibration interaction over the now front-loaded
  distribution.
- **battery #318** (shuffle vs ordered) — the engine still reads order; the margin shrinks
  (the rate reserve is slightly more shuffle-robust).
- **predict #384**, **write-answer #569**, **surprise #504** — predictor-accuracy margin,
  frame-walk values, and the exact-value golden shift, all by design on the bayes scale.

Promoting the capability to default would require reconciling these. That is why it ships gated:
the constant-reserve protention is a *different model*, and the parity gate keeps the claim that
the rate reserve is better falsifiable rather than asserted.

## Lock

`tests/novelty-rate-reserve.test.js` — 7 assertions: the control is flat (mass is blind), the
tracked amplitude orders recent>early>confirm, recency-not-count, the two-sense interior, absolute
continuity, the production wiring, and the default-path golden. Flag-independent, so it stays
green in the parity suite and fails the day the mechanism or its control changes.
