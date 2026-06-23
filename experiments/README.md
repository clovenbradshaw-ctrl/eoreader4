# The selection-pressure substrate

This directory is the persistent memory of a continuous-evolution campaign against
the predictive engine. Every cycle draws a *pressure*, turns it into a *blind
falsifiable experiment*, verifies the instrument, scores blind, and either confirms
a capability (with its mechanism) or diagnoses a gap to root cause and fixes it in
the right layer behind the `RULES_REV` parity gate.

One discipline holds above all: **randomness lives in the pressure, never in the
test.** A wild pressure still becomes a blind experiment with a held key and at
least one control where the cheap surface signal is loud, and every fix still
passes the parity gate (`node --test tests/*.test.js` byte-identical with
`RULES_REV` off) and — for any interior change — the omnimodal gate (the same
behaviour in two senses, a different organ each).

## The three artifacts

| File | What it is |
|---|---|
| `archive.jsonl` | The population of pressures tried. One line per pressure: its stimulus shape, its seed of record (wiki title+revision, or code site), its difficulty under the live engine, its novelty against the rest, and its verdict. The seed makes every draw replayable. |
| `ledger.jsonl` | One appended line per experiment: capability, claim, stimulus shape, verdict, mechanism, fix layer, the scope where it holds and where it does not, and the senses it was confirmed in. |
| `coverage.json` | Which sites the experiments have exercised, so the inside-out draw can be biased toward the cold regions. |

Regression locks live in `tests/` so they run with the suite: one lock per confirmed
capability, written to **fail the day its precondition changes**, including the
control condition, so a run that fires on the noise or swings across the control
fails the lock rather than passing.

## An experiment is four files

Each `exp-NNN-*/` holds the same shape every time:

1. `stimulus.json` — the smallest **blind** stimulus that isolates the capability,
   a handful of items, with the contrast planted and at least one **control** where
   the surface signal is loud. No labels in the stimulus.
2. `key.json` — **held**: item identities, the predicted per-channel dissociation,
   the control's predicted behaviour, a mechanism tag. The key never enters the run.
3. `measure.mjs` — **read-only**: emits every relevant channel per item over prior
   context only, causally. Touches no production code; the suite stays byte-identical.
4. `score.mjs` — **blind scorer**: reads the control first (did the trivial
   explanation get caught), then the per-item split, then stability across the control.

## The axes a pressure is drawn on

- **target** — which of the 27 cells / nine operators (NUL … REC). Bias toward thin cells.
- **modality** — text, image regions, tone, raw frequency, or a pair.
- **kind** — discrimination, invariance, prediction, robustness, transfer, composition, adversarial.
- **reading level** — set-overlap, structure, significance.
- **horizon** — within a unit, across a window, across the whole reading.

## The law is fixed; the amplitude is contextual

Belief is a posterior over a basis read off by the fixed Born step. We never make the
law context-dependent. What is contextual is the **amplitude** that goes into it —
including the mass reserved for the unseen. Every hand-set constant in the predictive
path (a reserve, a threshold, a rate, a band) is a place where an external assumption
stands in for something the signal should teach: a pressure waiting to be drawn. The
replacement is always signal-derived and carried through the unchanged Born step,
never a better-tuned constant.

## Running the campaign

```
node experiments/exp-001-novelty-reserve/measure.mjs   # read-only, emits channels
node experiments/exp-001-novelty-reserve/score.mjs     # blind scorer, reads the key
```

See `ledger.jsonl` for the running map of what the engine can and cannot predict, and why.
