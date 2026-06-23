# The selection campaign — a continuous force on the predictive engine

This directory is the **substrate** of a continuous evolutionary campaign on the
omnimodal predictive engine in `src/`. The engine's job is prediction: it reads a
unit, predicts the next, and the gap is **surprise**. A self-learning thing has no
teacher — the *only* signal it can leverage is that gap, read against a
distribution it formed from the signal's own history. The campaign sharpens the
fidelity of that one signal. It does not bolt capabilities on; it finds the places
where the engine's surprise already tracks real structure (confirm + lock them)
and the places where it does not yet (locate + fix them in the right layer behind
a parity gate).

## The one discipline

**Randomness lives in the pressure, never in the test.** Each cycle draws a wild
pressure — most often by colliding one or two *random Wikipedia articles* — but
that pressure always becomes a **blind, falsifiable experiment**: a stimulus with
a planted contrast, at least one **control where the cheap surface signal is
loud**, a **held key**, and a read-only measurement. A fix counts as adaptation
only if it passes the **parity gate** (existing suite byte-identical, shipped
behind a flag) and **generalizes** (lifts a sample of the archive, breaks no
confirmed capability). The draw decides what gets stressed; the control and the
gate decide what counts.

## The three persistent artifacts (read by every later step)

| file | what it is |
|------|------------|
| [`pressure-archive.jsonl`](pressure-archive.jsonl) | one line per pressure tried: its stimulus shape, its **seed of record** (the source article titles + revision ids, so every draw is replayable), its difficulty under the live engine, its novelty against the rest, and its verdict. |
| [`ledger.jsonl`](ledger.jsonl) | one line per experiment: the capability, the claim, the stimulus shape, the verdict, the mechanism, the **layer** of any fix, and the **scope** where it holds and where it does not. |
| [`locks/`](locks/) | a pointer per confirmed capability to its **regression lock** — a test (under `tests/`, picked up by `npm test`) written to fail the day its precondition changes, *including the control condition*, so a run that fires on the noise or swings across the control fails the lock rather than passing. |

## The engine's three layers (a fix goes in the layer the fact belongs to)

- **interior** (`src/core`, `src/perceiver/reading.js`, `src/fold`, …) — universal;
  the log, the nine operators, the projection, the fold, the surprise core, the
  reading cursor. Modality- and language-agnostic. An interior change must help
  **≥2 senses** (the omnimodal gate) or it is a modality fact in disguise.
- **conventions** (`src/core/conventions`) — the seeded-and-learnable ledger of
  word/structure classes. A language fact is a seed here, never a literal in a parse file.
- **organs** (`src/organs`) — the edges. A sense organ maps a raw signal into the
  bare comparable-ordered membrane and emits the nine operators onto the log. When
  a pressure needs a sense no organ covers, you **build the organ**.

## A hand-rolled constant is a signal you are not using

Any fixed number in the predictive/surprise path — a reserve, a threshold, a rate,
a band — is a place where an external assumption stands in for something the signal
should teach. The campaign hunts them and replaces each with a quantity **derived
from the signal's own recent history**, carried as an *amplitude* through the fixed
Born step. The law (square the amplitude, normalize) stays put; context enters at
the amplitude. See `p001` for the exemplar (the novelty reserve).

## How a cycle runs

1. **Draw** one value on each axis (target cell · modality · kind · reading level ·
   horizon) and pull a random-article seed. Compose the smallest stimulus that
   stresses the combination, with a planted contrast and a loud-surface control.
2. **Build the four files** — `stimulus` (blind), `measure.mjs` (read-only,
   touches no production code, suite stays byte-identical), `key.json` (held), and
   the scoring inside `measure`/a `score` step (channel-agnostic).
3. **Verify the instrument** before reading the score: organ live, channel computed
   (not all-zeros), trace one positive and one negative item.
4. **Score blind** — control first (did the trivial explanation get caught), then
   the per-item split, then stability across the control.
5. **Branch** — separates + control holds → confirm, write the lock. Fails →
   diagnose to root cause, fix in the right layer behind the parity gate, re-run a
   sample of the archive (keep only if it lifts aggregate competence and breaks no
   lock), then confirm with rules on.
6. **Append** the pressure (difficulty, novelty, verdict) to the archive and the
   experiment to the ledger.

## Replay

Every pressure records its seed of record. `lib/seed.mjs` fetches a fresh random
article online, but a recorded `{title, revision}` replays the same draw offline
(`lib/seed.mjs --replay`), so a pressure that located a gap can be re-run exactly.

```
node campaign/lib/seed.mjs                 # draw N fresh random seeds (online)
node campaign/experiments/<id>/measure.mjs  # run one experiment's read-only measurement
RESERVE=signal node campaign/experiments/<id>/measure.mjs   # same instrument, rules on
```
