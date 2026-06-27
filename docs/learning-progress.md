# Learning progress — curiosity as the derivative of competence

> The idle walk used to vary *which* void it attended by seeded noise alone (I5),
> ordered in the UX by **age** ("open 3 wks"). Age is not pay-off. This change makes
> attention **drawn to the frontier** — the void where the reading is improving
> fastest — and **repelled by the wall** — the void that is maximally surprising and
> never gets less so. It is the keystone the autonomous "day" hangs on: a curious
> creature that forages must know *where* foraging still pays.

The mechanism lives in [`src/write/voids.js`](../src/write/voids.js)
(`learningProgress`, `voidScore`, `rankByLearningProgress`, `pickVoid`); the wiring in
[`src/write/idle.js`](../src/write/idle.js) (`recHistory` → `pickVoid`); the lock in
[`tests/learning-progress.test.js`](../tests/learning-progress.test.js).

## The noisy-TV problem, in this engine's terms

Reward **raw surprise** and the creature gets hypnotized by static: noise is maximally
surprising and never becomes less so, so a naive curiosity drive sits and licks it
forever. In a document the most "surprising" span is usually the garbled table or the
OCR mess. The engine already refuses one half of this trap — README §3: *surprisal
chases TV-snow (maximally improbable, inert); Bayesian surprise arrests only where the
line rewrote the reading.* That handles a single span.

This change handles the **void** the idle loop returns to over and over. Bayesian
surprise is the *level* of belief-movement; what we rank by here is one derivative
further out — **learning progress**, the surprise that *shrinks when you poke it*:

> Curiosity is the derivative of competence, not the level of confusion.

## How it reads off the trail

Every idle pass records `{ rid, rec }` in `idle.js`'s `trail` — `rec` being the REC
magnitude (the accommodation) that re-surfing that void produced on that pass.
`recHistory()` folds the trail into a per-void chronological series, and
`learningProgress(series)` is the **recent reduction** in that series:

| series of REC pokes | reading | score | flow channel |
|---|---|---|---|
| `[0.5, 0.4, 0.3, 0.2]` | shrinking — being learned | **`> 0`** | the **frontier** — attend |
| `[0.9, 0.9, 0.9, 0.9]` | high, never shrinks | **`≈ 0`** | the **wall** (noisy TV) — repel |
| `[0.05, 0.04, 0.05]` | already at floor | **`≈ 0`** | **exhausted** (too-easy) — bored |
| `[0.2, 0.4, 0.6, 0.8]` | re-surfing makes it worse | **`< 0`** | **too-hard** — repel hardest |

Only the last `window` pokes count (recency), so a void that fell early and then
flatlined reads as exhausted *now*, not as still-paying.

## Two disciplines kept

- **Optimism under uncertainty.** A void with too few pokes to show a trend gets an
  optimistic `priorLP`, so the genuinely unknown — "the edge of its own knowing" — is
  explored *before* it can be judged a wall. Tune `priorLP` down to let an already-hot
  frontier compete with the unpoked.
- **I5 holds — biased, never locked.** `pickVoid` with a history weights attention by
  learning progress, but every open void keeps a probability **floor**, so the noise
  still steers *which* void and the bias never silences one entirely. With **no**
  history the walk is byte-identical to the original seeded-uniform attention — the
  default path, existing callers and goldens unchanged, the change earned only where a
  poke-history exists.
