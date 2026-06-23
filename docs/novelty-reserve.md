# The signal-derived novelty reserve

> A hand-rolled constant in the predictive path is a teacher the self-learning
> system is not supposed to have, smuggled in as a literal. This is the story of
> finding one and replacing it with a quantity the signal teaches.

## The constant

`src/core/surprise.js` opens with

```js
export const NOVELTY_RESERVE = 1.0;   // reserved prior mass for an as-yet-unseen atom
```

The one surprise is `D_KL(posterior ‖ prior)` over a γ-decayed referent profile in a
fixed basis. To keep that divergence finite on a *newcomer* — an atom in the arrival
that the prior has never seen — the Born step reserves a sliver of prior probability
for "the unseen": `reserve = ν / (sumPrior + ν)`. With `ν` fixed at `1.0`, that reserve
probability is a function of the **standing mass only**. It is blind to whether
newcomers have actually been arriving. The reader grows equally certain that nothing
new will come whether it just saw six newcomers in a row or none in fifty lines.

That is the reader failing to learn from its own signal. The single thing a teacherless
system can leverage is the gap between what it predicted and what arrived, read against
a distribution it formed from the signal's own history. A reserve that ignores the
recent novelty history is a piece of that distribution frozen by the designer instead of
fit to the text.

## The fix is not a better number

The reserve is an **amplitude**. The law that turns it into a belief — square it into the
KL via the fixed Born step — is not the thing to change; making the law context-dependent
would put modality into the law. What is contextual is the amplitude fed to it.

The honest reserve is the recent **novelty rate**: how much fresh mass has lately been
arriving. The profile already accumulates every incumbent under the recurrence

```
m′ = γ·m + (mass delivered this step)
```

The reserve should obey the *same* recurrence, but be deposited-into by **first
appearances only**:

```
ν′ = γ·ν + (mass that arrived on the as-yet-unseen)
```

So `ν` is just another atom in the field — "the unseen" — that newcomers deposit into and
that decays at the same γ as everything else. High right after a flurry of newcomers, low
after a long stretch of confirmation. No constant anywhere in the path: at the opening
`ν = 0`, and the first deposit seeds it from the signal (a non-empty prior always implies
`ν > 0`, because every atom in the prior was once a first appearance, so the KL never
diverges).

`surpriseAt` exposes this as `noveltyNext` — purely additive, so `bayesBits`/`bayesBy` are
untouched and every existing caller stays byte-identical. A caller threads it back as the
next step's `novelty`; the same fixed Born step then turns the context-sensitive amplitude
into a context-sensitive belief. **Context enters at the amplitude, the law stays put.**

`readingAt(doc, cursor, { signalReserve: true })` (text) computes `ν` as the closed form of
that recurrence — the γ-decayed mass of first appearances in the proposition field —
unrolled over the prior its from-scratch scan already rebuilds. Default `false` →
`novelty: NOVELTY` → byte-identical (the exact-value goldens in `tests/surprise.test.js`).

## What it buys — the dissociation

A newcomer after a long confirmation stretch (**drought**) versus the *same* newcomer after
a flurry of newcomers (**flurry**), with standing mass matched and every line the same shape
(`Name entered.` / one note — matched length, verb, token count):

| condition | OFF (constant) | ON (signal) | surprisal (surface) |
|-----------|---------------:|------------:|--------------------:|
| drought   | 0.27           | **0.95**    | 1.98                |
| flurry    | 0.27           | **0.08**    | 1.98                |
| control (re-confirm) | 0.00  | 0.00        | 0.42                |

The constant reserve is **blind** (0.27 = 0.27) — and so is every cheap surface signal:
surprisal is *identical* (1.98 = 1.98) and standing mass is identical, so nothing on the
surface can tell drought from flurry. Only the signal reserve splits them, and in the right
direction: the newcomer nobody was expecting (drought) moves belief an order of magnitude
more than the newcomer arriving amid a flurry. The **control** re-confirms an incumbent at the
test line — byte-identical surface to the drought test line — and stays at zero under both
reserves: the reserve fires on *novelty*, not on surface activity.

It tracks the **recent** rate, not a cumulative count — a *stale* flurry (newcomers early,
then a long confirmation stretch) surprises like a drought (0.64) rather than like a fresh
flurry (0.12), because `ν` decayed back down. The decay term is load-bearing.

## The omnimodal gate

The change is in the interior, so it carries the heaviest gate: confirmed in one sense is a
hypothesis, confirmed in two is the interior. Driven over a **tonal** (pitch) basis — atoms
are `n:<midi>`, the same `surpriseAt` core, `ν` threaded via `noveltyNext` — the same split
appears (drought 0.95 ≫ flurry 0.08 under the signal reserve; 0.27 = 0.27 under the constant),
identical to the text path to the digit because it is the *same* Born law with a different
front-end. A capability that holds across two organs is interior, not a text fact.

## Scope — where it holds, where it does not

- **Holds** wherever a reading has newcomers against a non-trivial prior: text proposition
  field and the tonal pitch basis, across independent casts, drought lengths {4,6,8}, and γ
  horizons {0.5,0.7,0.9} (9/9 in `scripts/novelty-reserve-generalize.mjs`). Bigger drought and
  tighter horizon → bigger split, as expected.
- **Inert** (correctly) on pure-confirmation readings with no newcomers — the reserve is never
  drawn, so `ON == OFF`. This is not a failure; it is the absence of the phenomenon.
- **Unchanged by this work:** the surprisal (−log p) channel still uses its own constant
  `pNovel = NOVELTY / Z` (`reading.js`), and `forwardDist`'s generation reserve is still the
  constant. Both are the same smell in a different channel — located, recorded in the ledger as
  open pressures, not yet closed.

## Reproduce

```
node scripts/novelty-reserve.mjs              # the blind experiment + the omnimodal gate
node scripts/novelty-reserve-generalize.mjs   # the generalization sweep (9 independent cases)
node --test tests/novelty-reserve.test.js     # the regression lock (incl. the control)
npm test                                       # parity — 674 green, flag off byte-identical
```

The stimulus is blind (`data/novelty-pressure/stimulus.json`, opaque ids); the key is held
separately (`data/novelty-pressure/key.json`) and read only when scoring. Cast names and the
phenomenon are drawn from random Wikipedia articles, recorded as seeds of record in the key.
