# The novelty reserve — an amplitude the signal teaches, not a constant

> Confirmed by `campaign/exp/001-novelty-baserate` in two senses (text, music).
> The reserve mass a reading holds for an as-yet-unseen atom is no longer the
> hand-set constant `NOVELTY_RESERVE = 1.0`; under `signalNovelty` it tracks the
> recent **rate** of newcomers, carried through the *same* fixed Born step. Off by
> default — the default reader is byte-identical.

## The constant that was a signal in disguise

Surprise is `D_KL(posterior ‖ prior)` over a γ-decayed proposition field
(`docs/bayesian-surprise.md`). To stay defined when a genuine newcomer arrives —
an atom with no prior — the field keeps a **reserve atom**: a sliver of belief
held for the unseen. Its mass entered the Born step as a constant:

```
reserve = novelty / (sumPrior + novelty)        // surpriseAt, novelty = 1.0
```

The figure field saturates to ≈ `1/(1-γ)` whatever it is made of, so this reserve
**probability** converges to the same value after a burst of newcomers as after a
long stable stretch. The reader grows equally certain that nothing new will come
whether it just saw five newcomers or none. That is the reader failing to learn
from its own signal — an external assumption (a literal `1.0`) standing in for
something the stream should teach.

The diagnostic is blunt. Two readings, matched unit-for-unit so total decayed
mass is identical, differing only in whether the recent units introduced new
figures or recurred the same cast, score a newcomer **byte-identically** under the
live reader:

```
                          massAtCursor   live bayesBits
  burst of newcomers         3.318          0.29
  stable recurrence          3.318          0.29     ← blind to the difference
```

## The fix is not a better formula

It is to make the reserved **amplitude** track the recent novelty rate under the
same decay the figure field uses, then run it through the *same* Born step.
Context enters at the amplitude; the law stays put.

```
  noveltyAmplitude = Σ γ^(cursor − firstStep)        // over each atom's FIRST appearance
```

A newcomer arriving at the cursor weighs γ⁰ = 1 — which is exactly the old
constant, so the **opening still falls to zero** and absolute continuity is
preserved precisely when a newcomer is present. A newcomer `k` steps back weighs
γ^k, so old arrivals decay out of the window. The amplitude is high after a burst
of newcomers and low after a stretch of confirmation, with no constant in the
path. It is the streaming recurrence `a′ = γ·a + newcomers_now` under the same γ.

`noveltyAmplitude` lives in `src/core/surprise.js` (the interior) and reads only
step indices — never an atom's content — so it is modality-agnostic. Each reader
builds the first-appearance steps from its own stream; `src/perceiver/reading.js`
does it for the proposition field behind `opts.signalNovelty`.

## What the fix buys (the per-item split)

The reserve effect `Δ = live − signal` isolates the reserve within one item —
priorProp, the deposit, the bonds and γ are identical, only the amplitude differs:

```
            Δ (reserve effect)     text      music
  high recent novelty               0.20      0.58
  low  recent novelty               0.01      0.24
  large-cast CONTROL                0.03      0.28     ← tracks recent rate, not cast size
```

The same genuine newcomer is markedly less surprising after a burst. The control
— a large cast (or wide pitch-set) introduced early, with the recent window all
recurrence and total mass matched — does **not** move the reserve: a method
winning on the cheap surface signal (cast size, mass) fails it. And it holds in a
second organ: the interior change helps text (entities) and music (pitch classes)
alike, the omnimodal gate for an interior change.

## Gates

- **Parity.** `opts.signalNovelty` is off by default; the default reader is
  byte-identical (the `surprise.test.js` exact-value goldens are unchanged). The
  Born step in `surpriseAt` is untouched — only the amplitude fed to it changed.
  `node --test tests/*.test.js` → 654 green.
- **Regression lock.** `campaign/locks/001-novelty-baserate.mjs` fails the day the
  dissociation collapses, the control swings, or the default path drifts.
- **Open residue.** The *predictive* reserve `pNovel` (`reading.js`, the −log p
  channel) still uses the constant — the same gap seen from the other channel, a
  follow-up pressure. The image / frequency / video organs have not yet been
  driven through `signalNovelty`.
