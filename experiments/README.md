# Selection substrate — the continuous-evolution loop

This directory is the persistent memory of a continuous force of selection on the
engine. It is **not** product code. Nothing here is imported by `src/`; the
measurement scripts are read-only projections of the log (the discipline of every
`scripts/*.mjs` falsification already in the tree).

The engine's job is prediction: read a unit, predict the next, the gap is surprise.
Almost every pressure reduces to one shape — *here is something the reader should
anticipate or tell apart from prior context alone; does it, and if not, where is the
signal lost.* Randomness lives in the **pressure** (a wild draw from outside the
designer's head), never in the **test** (a blind experiment with a held key and a
loud-surface control). The draw decides what gets stressed; the control and the
parity gate decide what counts as adaptation.

## The three artifacts (re-read every cycle)

- **`archive.jsonl`** — the population of pressures tried. One line per pressure:
  its stimulus shape, its **seed of record** (random Wikipedia `title` + `revision`,
  so every draw replays exactly), its axes, its difficulty under the live engine, its
  novelty against the rest, and its verdict.
- **`ledger.jsonl`** — one appended line per experiment: the capability, the claim,
  the stimulus shape, the verdict, the mechanism, the layer of any fix, and the scope
  where it holds and where it does not.
- **`../tests/lock-*.test.js`** — the regression-lock set. One lock per confirmed
  capability, written to **fail the day its precondition changes** — including the
  control condition, so a run that fires on the noise or swings across the control
  fails the lock rather than passing. Locks live in `tests/` so `npm test` (the
  parity gate) enforces them with the rest of the suite.

## A pressure is a sampled object

Draw one value on each orthogonal axis; the draw composes into the smallest stimulus
that stresses that combination.

- **target** — which operator/cell (NUL…REC, the 27 cells). Bias toward the thin
  cells (EVA, REC, empty SYN×Ground) and impoverished operators.
- **modality** — text · image regions · tonal sequence · raw frequency · a pair.
- **kind** — discrimination · invariance · prediction · robustness · transfer ·
  composition · adversarial.
- **reading level** — set-overlap (L1) · structure (L2) · significance (L3).
- **horizon** — within a unit · across a window · across the whole reading.

## Where a pressure comes from

The content is pulled from outside the designer's head — `GET
https://en.wikipedia.org/api/rest_v1/page/random/summary` (no key). The article is
raw variation; the axes supply the form. The article is **never** the stimulus
itself — the phenomenon is extracted and a minimal blind stimulus is built around it
with a planted contrast and a loud-surface control. Five recipes: domain injection,
**orthogonal collision** (two draws, the richest), structured draw, mutation of a
known-good, empty-cell pressure.

## Each cycle's files (`cycles/NNN-slug/`)

1. `claim.md` — one falsifiable sentence + the dissociation it predicts.
2. `stimulus.json` — the smallest blind stimulus, a handful of items, a planted
   contrast, ≥1 loud-surface control. **No labels.**
3. `key.json` — held: item identities, predicted per-channel dissociation, the
   control's predicted behaviour, a mechanism tag. Never read by the run.
4. `measure.mjs` — read-only; emits every relevant channel per item over prior
   context only, causally. Touches no production code; suite stays byte-identical.
5. `score.mjs` — channel-agnostic; reads the control first, then the per-item split,
   then stability across the control. Branches: confirm (→ lock) or diagnose.

## The rules that never bend

Randomness in the pressure, never the test. Verify the instrument (organ live,
channel computed, trace one ±item) before trusting a score. NULL is untested or
starved, never the end. A language/modality fact goes in an organ or convention,
never an interior file. A fix ships behind `RULES_REV`, off by default, golden
parity green, and its fitness is how many independent pressures it lifts — not the
one that prompted it. Never regress a confirmed capability.
