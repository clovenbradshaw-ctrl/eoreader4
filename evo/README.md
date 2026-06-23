# evo — continuous evolution of the predictive engine

A standing force of selection on the engine. It generates varied pressures, turns
each into a **blind falsifiable experiment** with a held key and a loud-surface
control, and either confirms a capability with its mechanism or diagnoses a failure
to root cause and fixes it in the right layer behind a parity gate.

> One discipline holds above all: **randomness lives in the pressure, never in the
> test.** A wild pressure still becomes a blind experiment with a held key and at
> least one control where the cheap surface signal is loud, and every fix still
> passes the parity gate. The draw decides what gets stressed; the control and the
> gate decide what counts as adaptation.

The only thing a teacherless system can leverage is the gap between what it predicted
and what arrived — **surprise** — read against a distribution it formed from the
signal's own history. The campaign is not bolting capabilities on; it is sharpening
the fidelity of that one signal. Every confirmed capability is a place where the
engine's surprise was shown to track real structure; every located gap is a place
where it does not yet.

## The substrate (build first — everything else re-reads it)

| file | what it is |
| --- | --- |
| `archive.jsonl` | the population of pressures tried — stimulus shape, **seed of record** (article titles+revisions or a code site, so every draw replays), difficulty under the live engine, novelty vs the rest, verdict. |
| `ledger.jsonl` | one line per experiment — capability, claim, stimulus shape, verdict, mechanism, **fix layer**, and the scope where it holds and where it does not. |
| `coverage.json` | which engine sites the runs have exercised, so the inside-out draw can be biased toward the **cold regions**. |
| `locks/` → `tests/*.lock.test.js` | one regression lock per confirmed capability, written to fail the day its precondition changes — **including the control**. |
| `lib/seed.mjs` | the random seed: `randomSeed()` / `randomTitles(n)` from Wikipedia (no key). The article is raw variation; the axes supply the form. |
| `lib/sample.mjs` | the axes sampler. A pressure is a sampled object: `drawPressure(seed)` → `{target, modality, kind, level, horizon}`, biased toward the thin cells. Seeded (mulberry32) so a draw replays. |
| `lib/record.mjs` | the append-only writers + `noveltyOf` / `difficultyBand` / `bumpSite`. |

## A pressure is a sampled object

Draw one value on each orthogonal axis; the draw composes into the smallest stimulus
that stresses that combination.

- **target** — which of the 27 cells (operator × grain, NUL…REC × Ground·Figure·Pattern). Biased toward the thin cells (EVA, REC, the empty SYN by Ground).
- **modality** — text · image · tonal · frequency · or a pair.
- **kind** — discrimination · invariance · prediction · robustness · transfer · composition · adversarial.
- **level** — set-overlap (L1) · structure (L2) · significance (L3).
- **horizon** — within-unit · across-window · across-reading.

Two sources, one loop. **Outside-in**: fetch one or two random articles, run domain
injection or (most often) orthogonal collision — variation in the environment.
**Inside-out**: draw a random code site biased toward the cold regions, then *target*
(reverse-engineer the claim a line makes and test it), *hunt a constant* (a fixed
number in the predictive path is an external assumption the signal should teach), or
*probe by mutation* (perturb read-only behind the flag — the value is what it reveals
about coverage, never the kept change) — variation in the genome.

## The fixed law, the contextual amplitude

Belief is a posterior read off by the **Born step** — square the amplitude, normalize
(`src/core/surprise.js`). That law is fixed and identical for every sense. What is
contextual is the **amplitude** that goes in. A hand-rolled constant in the predictive
path is a place where the signal should be teaching and isn't: replace it with a
quantity derived from the signal's own recent history, carried as an amplitude through
the *same* fixed Born step.

## What has landed

**Confirmed — the novelty reserve now tracks the recent novelty rate**
(`experiments/reserve-rate/`, lock `tests/reserve-rate.lock.test.js`).

The constant `NOVELTY_RESERVE = 1` was a fixed pseudocount (`one over mass plus one`)
for the mass held for an unseen atom — blind to whether newcomers had been arriving.
The fix is not a better formula: `noveltyRateProfile` makes the reserved amplitude the
**γ-decayed count of newcomer atoms** over prior steps, on the same decay kernel as the
figure field, run through the same Born step. High after a burst of newcomers, low
after a long stretch of confirmation — with no constant in the path.

- **control** — the constant reserve is blind: `const bayesBits(turnover) == (stable)` (0.26=0.26 text, 1.4=1.4 frequency); the surface `surprisal` is blind too (1.82=1.82).
- **mechanism** — the signal reserve separates: `signal(turnover) < signal(stable)` (0.09<0.63 text, 0.36<1.23 frequency).
- **null** — a confirmation probe shows no such separation (the reserve only weighs an *unseen* atom).
- **omnimodal** — confirmed in **two senses** (text proposition field + frequency overtone bins), routing the same `surpriseAt` core → it is **interior**, not a modality fact.
- **parity** — opt-in (`opts.reserve='signal'`, default `'const'`); the exact-value goldens are byte-identical, 654/654 green.
- **generalization** — 6/6 scored random-Wikipedia seeds hold the dissociation; a confounded trial (control not blind) is void, not a fail.

Located, not yet fixed (next exploit cycles): the sibling reserve in the **forward
object** (`pNovel` / `forwardDist`, the −log p surprisal floor) carries the same
blindness; it shifts the surprisal goldens and needs its own parallel golden.

## Run a cycle

```
node evo/lib/seed.mjs                 # one random article (seed of record)
node evo/lib/sample.mjs 42            # one axes draw (deterministic in the seed)
node evo/experiments/reserve-rate/measure.mjs    # read-only measurement → out.jsonl
node evo/experiments/reserve-rate/score.mjs      # blind scorer (reads the held key)
node evo/experiments/reserve-rate/generalize.mjs 8   # generalization on fresh seeds
node --test tests/*.test.js           # the parity gate + every regression lock
```

## Never

Loosen a rule to pass the planted items · tune a constant to make one item score ·
read the aggregate when the result is a split · trust a score without verifying the
organ is live · treat NULL as the end · put a modality fact in an interior file ·
keep a random code edit because the suite stayed green · regress a confirmed
capability for any single pressure.
