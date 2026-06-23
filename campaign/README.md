# The selection campaign — continuous evolution under random pressure

This directory is the substrate for an open-ended campaign that puts the
predictive engine under a stream of varied pressures, turns each into a blind
falsifiable experiment, and either confirms a capability with its mechanism or
diagnoses a failure to root cause and fixes it in the right layer behind a parity
gate. Randomness lives in the *pressure*. The control and the gate decide what
counts as adaptation — never the draw.

The engine's job is prediction: it reads a unit, predicts the next, and the gap
is surprise. Almost every pressure reduces to one shape — *here is something the
reader should anticipate or tell apart from prior context alone; does it, and if
not, where is the signal lost.* A self-learning thing has no teacher; the one
thing it can leverage is the gap between what it predicted and what arrived,
read against a distribution it formed from the signal's own history. Every
confirmed capability is a place where the engine's surprise was shown to track
real structure; every located gap is a place where it does not yet.

## The three persistent artifacts

Every later step is a re-read of these three files, not an intention.

| file | what it holds |
|---|---|
| `archive.jsonl` | the **pressure archive** — one line per pressure tried: its stimulus shape, its random seed of record (so the draw replays), its difficulty under the live engine, its novelty against the rest, its verdict. |
| `ledger.jsonl` | one appended line per **experiment**: the capability, the claim, the stimulus shape, the verdict, the mechanism, the layer of any fix, and the scope where it holds and where it does not. |
| `coverage.json` | which **sites** (cells / operators / code regions) the experiments have exercised, so the inside-out draw can be biased toward the cold regions. |

A fourth artifact, `locks/`, holds one **regression lock** per confirmed
capability — a runnable check written to fail the day its precondition changes,
including the control condition, so a run that fires on the noise or swings
across the control fails the lock rather than passing.

## The shape of one experiment

Each pressure becomes four files under `exp/<id>/`, the same shape every time:

1. **`stimulus.json`** — the smallest blind stimulus that isolates the
   capability, a handful of items, with the contrast planted and at least one
   **control** where the cheap surface signal is loud. No labels in the stimulus.
2. **`measure.mjs`** — a read-only measurement that emits per-item channels over
   prior context only, causally. It touches no production code; the test suite
   stays byte-identical. It can come back negative.
3. **`key.json`** — held separately: item identities, the predicted per-channel
   dissociation, the control's predicted behaviour, a mechanism tag. The key
   never enters the run.
4. **`score.mjs`** — a channel-agnostic scorer that reads the per-item split and
   the control. It reads the control first (did the trivial explanation get
   caught), then the per-item split, then stability.

## The law that does not move

Belief is a posterior over a basis, read off by the Born step: square the
amplitude and normalize. That law is fixed and identical for every sense. What
is contextual is the **amplitude** that goes into the law. A hand-rolled
constant in the predictive path — a reserve, a threshold, a rate, a band — is a
place where an external assumption stands in for something the signal should
teach. The campaign hunts those constants and replaces each with a quantity
derived from the signal's own recent history, carried as an amplitude through
the *same* fixed Born step.

## The gates

- **Parity.** Every fix ships behind a flag, off by default, with the existing
  paths byte-identical and the suite green. `node --test tests/*.test.js`.
- **Generalization.** A fix's fitness is how many independent pressures it
  improves, not whether it passes the one that prompted it. Re-run a sample of
  the archive; keep the fix only if it raises aggregate competence and breaks no
  confirmed capability.
- **Omnimodal (interior changes only).** The interior's claim is that it is
  universal, so it carries the heaviest gate: a capability that touches the
  interior is not confirmed until a **second sense** (a different organ) shows
  the same behaviour. Confirmed in one sense is a hypothesis; confirmed in two
  is the interior.

## Running

```
node campaign/run.mjs            # run every regression lock (the standing guard)
node campaign/run.mjs <exp-id>   # run one experiment's measure + score
node campaign/exp/<id>/measure.mjs [--trace]
node campaign/exp/<id>/score.mjs
```
