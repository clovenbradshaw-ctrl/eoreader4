# Cycle 001 — the forward object's novelty reserve

- **target** REC / the forward object (Generate × Interpretation — the thin GENERATE side:
  "generation is reading past the frontier").
- **modality** text (interior claim; omnimodal cross-check on a non-text basis).
- **kind** prediction / calibration.
- **reading level** L3 significance.
- **horizon** across a window.
- **seed of record** (orthogonal collision): *USCGC Duane* (rev 1326789648) — one persistent
  referent through a temporal event-sequence; *The Moment of Truth (1952 film)* (rev 1341455993)
  — a cast of distinct named entities in roles. The collision: one persistent figure interleaved
  with a roster of one-shot newcomers. Content from the draw; form from the axes.

## Claim (falsifiable)

The forward distribution `pNext` (the object the engine reads-past-the-frontier from, and draws
from) holds a **reserve** — the probability mass for an as-yet-unseen atom, i.e. `P(next arrival
is novel)`. The claim: **that reserve is a calibrated, contextual probability of novelty.**

## The dissociation it predicts

Read three streams of equal length, each one persistent figure plus newcomers at a different
rate:

- **steady novelty** — a newcomer every other unit (true recent rate ≈ 0.5).
- **cast-then-recurrence** — the cast is set in the first two units, then pure verbatim
  recurrence (true recent rate → ~0).
- **regime shift** (the CONTROL) — newcomers front-loaded, then they stop (true recent rate
  1.0 → ~0.1). A *cheap cumulative counter* stays elevated (~0.5) after the shift; only a
  recency-weighted estimate falls.

A calibrated reserve must (a) **separate** steady-novelty from cast-then-recurrence, and (b) on
the control, **fall** after the regime shifts — tracking the recency-weighted rate, not the
cumulative count and not the step index.

## What would falsify it (the negative result this run expects under the live engine)

The live reserve is `novelty/(sum+novelty)` with `novelty` a fixed constant, so it decays with
accumulated mass alone. Prediction: **all three streams land at the same reserve regardless of
their novelty rate** — the reserve does not separate the regimes and does not fall on the control.
That is the gap; the claim is FALSE under the live engine, and the fix must restore it.

## Mechanism tag

`forward-reserve-fixed-constant` → fix in the **interior** (`src/core/surprise.js`,
`bornNoveltyReserve`): novelty tied to the Born rule (the recurrence void gives the odds, alpha
the only policy) and contextual (γ-weighted recent rate), opt-in behind `calibrateReserve` with
the default path byte-identical. Modality-agnostic core; the text front-end only builds the
per-step proposition-basis deposits.
