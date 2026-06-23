# evo — continuous evolution under random pressure

This directory is the substrate for the selection campaign on the omnimodal
predictive engine. It holds the three persistent artifacts every cycle re-reads,
plus the per-experiment files and the shared sampler.

The engine's job is prediction: it reads a unit, predicts the next, and the gap
is **surprise** — the only signal a teacher-less system has. Every pressure here
reduces to one shape: *here is something the reader should anticipate or tell
apart from prior context alone; does it, and if not, where is the signal lost?*

**The one discipline.** Randomness lives in the *pressure*, never in the *test*.
A wild draw still becomes a blind experiment with a held key and at least one
control where the cheap surface signal is loud. Every fix passes the parity gate
(`node --test tests/*.test.js` byte-identical with the flag off) and, when it
touches the interior, is confirmed on a **second sense**.

## The three artifacts

| file | what it is |
| --- | --- |
| `archive.jsonl` | the population of pressures tried — one JSON line each: id, axes draw, seed of record (article titles + revids, or the code site), difficulty, novelty, verdict. The seed makes every draw replayable. |
| `ledger.jsonl` | one appended line per experiment: capability, claim, stimulus shape, verdict, mechanism, the layer of any fix, and the scope where it holds and where it does not. |
| `coverage.json` | which sites/cells the experiments have exercised, so the inside-out draw can be biased toward the cold regions. |

`locks/` holds one regression lock per confirmed capability (also surfaced as a
`tests/evo-*.test.js` so it runs in the suite). A lock is written to **fail** the
day its precondition changes — including the control — so a run that fires on the
noise or swings across the control fails the lock rather than passing silently.

`experiments/<ID>/` holds the four files of the experiment loop:

1. `claim.md` — one falsifiable sentence (the capability + the dissociation it predicts).
2. `stimulus.json` — the blind stimulus (a handful of items; the contrast planted; **no labels**).
3. `key.json` — held separately: item identities, predicted per-channel dissociation, the control's predicted behaviour, a mechanism tag. The key never enters the run.
4. `measure.mjs` — read-only; emits every relevant channel per item over prior context only, causally. Touches no production code.
5. `score.mjs` — blind scorer: reads the control first, then the per-item split, then stability across the control.

## The sampler (`lib/`)

- `rng.mjs` — a seeded PRNG and the axis samplers (target cell, modality, kind, reading level, horizon). Randomness in *what gets stressed*; never in *what counts as passing*.
- `seed.mjs` — the outside-in seed: one or two random Wikipedia articles (`/page/random/summary`), recorded as the seed of record (title + revid). The article is never the stimulus; the phenomenon is extracted and a minimal blind stimulus is built around it.
- `archive.mjs` — append helpers for the three artifacts.

## Running

```
node evo/run.mjs            # one cycle: draw, build, measure, score, record
node evo/experiments/<ID>/measure.mjs   # re-run one experiment's measurement (read-only)
node evo/experiments/<ID>/score.mjs     # score it blind against the held key
```

The interior is universal (the log, the nine operators, the projection, the fold,
the surprise core, the reading cursor); conventions are the seeded-and-learnable
ledger; organs are the edges. A fact specific to one language or modality goes in
an organ or a convention — never in an interior file. The membrane (the bare
comparable-ordered unit) is the line.
