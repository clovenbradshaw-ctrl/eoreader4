# EXP-001 · The novelty reserve (the named exemplar)

**Pressure (inside-out, the constant hunt).** `src/core/surprise.js:21` holds
`NOVELTY_RESERVE = 1.0` and `src/perceiver/reading.js:23` holds `NOVELTY = 1.0` — a
hand-set constant in the predictive path. The reserve the reader holds for an unseen
atom is `novelty / (mass + novelty)`: a "one over mass plus one" that tracks only TOTAL
accumulated mass and is **blind to whether newcomers have recently been arriving**.

**Claim.** The reserved amplitude should track the recent newcomer RATE — high after a
burst, low after a confirmation plateau — not a fixed number.

**Stimulus (blind) + control.** Each item is a stream measured at its final cursor. A
*burst* stream ends its prior with several first-time atoms; a *plateau* stream front-
loads the same newcomers and ends in pure recurrence. A burst/plateau pair shares the
**same atom multiset and length**, so the γ-decayed total mass is identical — hence the
constant reserve is identical (membrane, text) or anti-correlated (music). **Total mass,
the loud surface signal, provably cannot separate the labels.** Three organs: a bare
INS-only membrane (mechanism), music, text (the two senses for the omnimodal gate).

**Result under the live engine — GAP located.** Instrument ok; control caught (constant
reserve AUC 0.5 / 0.0 / 0.5); the context channel *coincides with the constant* — the
reserve is blind to newcomer recency.

**Fix.** A pure, modality-agnostic helper `noveltyAmplitude(firstSeen, at, γ) = Σ γ^(at-1-s)`
— the γ-decayed count of first-appearances — carried as the `novelty` amplitude through
the **unchanged** Born step (`surpriseAt`/`forwardDist`). Context enters at the amplitude;
the law does not move. Threaded into the perceiver behind `RULES_REV` (default off →
byte-identical, **671 tests green**; on → 7 reserve-sensitive goldens shift).

**Result with the fix — MECHANISM CONFIRMED in two senses.** Context reserve separates
burst > plateau (AUC = 1.000) in membrane, music, AND text. Constant control stays flat.
Omnimodal gate: PASS. Trace: `m-b1` reserve 0.246 → 0.430 (the events genuinely changed).

**Generalization — SCOPED, not a universal win.** On the pre-registered lag-1 newcomer-
discrimination metric across diverse real streams: metamorphosis **+0.29**, wiki(Mark
Sanford) **+0.25**, esker **−0.12**, twinkle melody **−0.43**; aggregate **−0.002 (flat)**.
Tracking recent rate helps positively-autocorrelated novelty (natural text, where new
entities cluster) and regresses anti-correlated alternation (a scale repeats each new
note). A smoother rate-normalized amplitude is strictly worse (aggregate 0.371).

**Disposition.** Kept behind the gate, **NOT promoted** — it does not clear the strict
"raises aggregate competence" bar. Locked: parity + mechanism + control
(`tests/novelty-reserve.test.js`).

**Deeper gap (seed for a future cycle).** A signal-derived reserve needs the
autocorrelation STRUCTURE of the newcomer process — does novelty persist or alternate? —
not merely its rate. The blind constant was a real defect; the rate-only amplitude is the
right *shape* of fix but an incomplete model.

## Reproduce

```
node experiments/exp-001-novelty-reserve/build.mjs       # blind stimulus + held key
node experiments/exp-001-novelty-reserve/measure.mjs      # read-only channels
node experiments/exp-001-novelty-reserve/score.mjs        # blind scorer (control first)
node experiments/exp-001-novelty-reserve/generalize.mjs   # fitness across diverse streams
```
