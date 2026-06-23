# evolution — continuous selection on the predictive engine

This directory is the **substrate** for a standing campaign: a stream of varied
pressures, each turned into a blind falsifiable experiment, that either confirms a
capability *with its mechanism* or locates a failure and fixes it in the right
layer behind a parity gate.

One discipline holds above all: **randomness lives in the pressure, never in the
test.** A wild pressure still becomes a blind experiment with a held key and at
least one control where the cheap surface signal is loud, and every fix still
passes the parity gate (`node --test tests/*.test.js`, byte-identical with the
flag off). The draw decides *what* gets stressed; the control and the gate decide
what counts as adaptation.

The deepest fact: a self-learning thing has no teacher. The only signal is the
gap between what it predicted and what arrived, read against a distribution it
formed from the signal's own history. So **every fixed number in the predictive
path is debt** — a place an external assumption stands in for something the signal
should teach. The campaign hunts those constants and replaces each with a
signal-derived amplitude carried through the one fixed Born step.

## The three persistent artifacts

Every later step is a re-read of these three files.

### `archive.jsonl` — the population of pressures tried
One line per pressure. Fields:
- `id` — stable handle (e.g. `P-0003`).
- `cycle`, `ts` — when it was drawn.
- `source` — `outside-in` (a Wikipedia seed) or `inside-out` (a code site).
- `seed` — the **seed of record**, makes the draw replayable:
  Wikipedia `{title, revision}[]`, or a code `{file, symbol}`.
- `axes` — the sampled pressure object: `{target, modality, kind, level, horizon}`.
- `stimulus` — the stimulus shape (one line).
- `difficulty` — how the live engine fares (0 = trivially passes, 1 = nothing
  could pass; we keep the **intermediate** band).
- `novelty` — distance from the rest of the archive (0..1).
- `verdict` — `confirmed` | `gap` | `flat` | `fix-shipped` | `instrument-void`.
- `ledger` — id of the ledger line that carries the mechanism, if any.

### `ledger.jsonl` — one line per experiment
Fields: `id`, `archive` (the pressure id), `capability`, `claim` (one
falsifiable sentence), `stimulus`, `verdict`, `mechanism`, `layer` (interior /
organ / convention / none), `scope` (where it holds **and** where it does not),
`senses` (which organs exercised it — ≥2 for any interior change), `lock` (the
regression-lock id, if confirmed).

### `locks.jsonl` — one line per confirmed capability
A registry pointing at the **actual** lock, which is a test assertion in
`tests/` written to fail the day the capability's precondition changes —
**including the control condition**, so a run that fires on the noise or swings
across the control fails the lock rather than passing. Fields: `id`,
`capability`, `test` (file::name), `precondition`, `control`.

`coverage.json` records which interior sites the archive's runs have exercised,
so the inside-out draw can be biased toward the cold regions.

## The pressure object

Draw one value on each orthogonal axis; the product is varied by construction.
- **target** — which operator/cell (NUL … REC, the 27 cells). Bias toward thin
  cells and impoverished operators.
- **modality** — text · image regions · tone · raw frequency · a pair at once.
- **kind** — discrimination · invariance · prediction · robustness · transfer ·
  composition · adversarial.
- **level** — set-overlap (L1) · structure (L2) · significance (L3).
- **horizon** — within a unit · across a window · across the whole reading.

## The omnimodal gate

Any change that touches the **interior** (`src/core/`) is not recorded confirmed
until a **second sense** — a different organ — shows the same behavior. Confirmed
in one sense is a hypothesis; confirmed in two is the interior. The Born law is
identical for every sense and only the amplitudes differ, so a context-sensitive
amplitude that holds across two senses is interior; one that helps a single sense
leaked and belongs in that sense's organ.

## Running an experiment

Each experiment is four files of the same shape:
1. a **blind stimulus** (no labels), with a planted contrast and ≥1 loud-surface
   control;
2. a **read-only measurement** that emits per-item channels over prior context
   only (causal), touching no production code;
3. a **held key** with the predicted dissociation, the control's predicted
   behavior, and a mechanism tag — never read by the run;
4. a **channel-agnostic scorer** that reads the control first, then the per-item
   split, then stability across the control.

Verify the instrument before trusting the score: confirm the organ is live and
the channel computed (not all-zeros), and trace one positive and one negative
item at the event level. NULL is not the end — it is untested or starved.

See `evolution/lib.mjs` for the shared harness.
