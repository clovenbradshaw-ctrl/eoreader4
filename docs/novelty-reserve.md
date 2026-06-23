# The novelty reserve — a constant the signal should teach

The one surprise (`docs/spec-one-surprise.md`) keeps a **reserve** of prior mass for an
as-yet-unseen atom, so a newcomer stays finite (absolute continuity) and an opening falls to
zero on its own. That reserve was a hand-rolled constant — `NOVELTY_RESERVE = 1.0` in
`src/core/surprise.js`, and `NOVELTY = 1.0` in `src/perceiver/reading.js`:

```
reserve = novelty / (sumPrior + novelty)        // the Born step
```

## The gap (measured, not asserted)

Under a steady deposit rate the γ-decayed `sumPrior` saturates toward `1/(1−γ)`, so
`1/(sumPrior+1)` saturates with it — a near-constant. The reserve is then a function of
**accumulated mass**, blind to whether newcomers have actually been **arriving**. The reader
grows equally certain that nothing new will come whether it just saw ten newcomers or none.

The measurement is flat and damning. A newcomer after ten confirmations and a newcomer after
ten newcomers — both genuine, surface-matched newcomers — score the **identical** surprise:

| final unit | after 10× confirmation (settled) | after 10 newcomers (churning) |
| --- | --- | --- |
| a newcomer · **fixed reserve** | `bayes 0.28` | `bayes 0.28` |

That is the reader failing to learn the novelty **rate** from its own signal.

## The fix — context at the amplitude, the law unchanged

Not a better constant. The reserved **amplitude** is made to track the recent novelty rate
under the **same γ** the figure field decays by, then run through the **same fixed Born step**:

```
noveltyReserveMass(firstSeenSteps, { at, γ }) = Σ γ^(at−1−s)   over newcomers s < at
```

Each step at which a newcomer first arrived deposits 1; every prior deposit decays by γ. High
after a churn of newcomers, falling toward zero after a long stretch of confirmation. Fed as
the `novelty` amplitude, the **fixed** `reserve = a/(sum+a)` then yields a context-sensitive
belief — high reserve after newcomers, low after confirmation — with no constant in the path.
`surpriseAt` itself (the Born law) is untouched; context enters only at the amplitude.

| final unit | settled | churning | separation |
| --- | --- | --- | --- |
| a newcomer · **signal reserve** | `bayes 1.56` | `bayes 0.08` | **1.48 bits** |
| a *repeat* (control) · signal | `0.00` | `0.07` | `0.07` (flat) |

The separation is newcomer-specific (the repeat control stays flat) and deepens with the
confirmation run (`len 15 → 2.32`). Both newcomer finals are equally unseen, so a cheap
surface "is-this-atom-new" detector — which is what the fixed reserve is — gives zero
separation: the rate-sensitivity cannot be a surface artifact.

## Layer, gate, omnimodality

- **Interior (genome).** `noveltyReserveMass` lives in `src/core/surprise.js`; it sees only
  first-appearance steps and the decay, so any organ that streams arrivals onto the log
  inherits it. Wired into `reading.js` behind **`RULES_REV`** (env) / `opts.signalReserve`,
  **default off** → every existing path byte-identical (`npm test` 688 green).
- **Omnimodal gate (two senses).** The text organ (parsed entities) and a non-text tone organ
  (a bare `INS` operator-log, no parser) produce the **identical** dissociation — the
  mechanism reads only the membrane. Confirmed in one sense is a hypothesis; confirmed in two
  is the interior.

Experiment: `data/novelty-reserve-{stimulus,key}.json`, `scripts/novelty-reserve{,-score}.mjs`,
lock `tests/novelty-reserve.test.js` (`experiments/` exp-0002).

## What it opens

The reserve now tracks the rate of **discrete** newcomers. It does not yet distinguish a slow
**drift** of the generating distribution from genuine newcomers — the drifting-signal hard
problem, where this contextual-amplitude idea applied to the *background* either generalizes
or dies. That is the next pressure.
