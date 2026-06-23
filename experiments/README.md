# The selection substrate — continuous evolution under random pressure

This directory is the substrate for a continuous evolutionary loop on the engine.
The engine's job is prediction: it reads a unit, predicts the next, and the gap is
surprise. Almost every pressure reduces to one shape — *here is something the reader
should anticipate or tell apart from prior context alone; does it, and if not, where
is the signal lost?* The loop generates varied pressures, turns each into a **blind
falsifiable experiment** with a held key and a loud-surface control, and either
confirms a capability with its mechanism or diagnoses a failure to root cause and
fixes it in the right layer behind the parity gate.

**One discipline holds above all others: randomness lives in the pressure, never in
the test.** The draw decides what gets stressed. The control and the parity gate
decide what counts as adaptation.

## The three persistent artifacts

| File | What it is |
| --- | --- |
| `archive.jsonl` | The **pressure archive** — one line per pressure tried: its stimulus shape, its seed of record (source article titles + revision ids, so every draw replays), its difficulty under the live engine, its novelty against the rest, and its verdict. |
| `ledger.jsonl` | The **experiment ledger** — one line per experiment: the capability, the falsifiable claim, the stimulus shape, the verdict, the mechanism, the layer of any fix, and the scope where it holds and where it does not. |
| `tests/*.test.js` | The **regression-lock set** — one lock per confirmed capability, written to fail the day its precondition changes, *including the control condition*, so a run that fires on the noise or swings across the control fails the lock rather than passing. (Locks live in the repo's `tests/` so they run in the suite.) |

## A pressure is a sampled object (`lib/pressure.mjs`)

Draw one value on each orthogonal axis; the product is varied by construction:

- **target** — which of the 27 cells / nine operators (NUL…REC). Bias toward thin cells.
- **modality** — text, image regions, tone, raw frequency, a sequence, or a pair.
- **kind** — discrimination · invariance · prediction · robustness · transfer · composition · adversarial.
- **reading level** — set-overlap · the middle level · significance.
- **horizon** — within a unit · across a window · across the whole reading.

## Where pressures come from

- **Outside-in** (`lib/wiki.mjs`): fetch one or two random Wikipedia articles; the
  article supplies the *content*, the axes supply the *form*. The random article is
  never the stimulus itself — extract the phenomenon, then build a minimal blind
  stimulus around it. Two-article *orthogonal collision* is the richest source.
- **Inside-out**: draw a random site in the engine — a function, a branch, a constant,
  an event emission — and ask what capability it is responsible for and whether that
  holds under a stimulus built to stress it. A draw that lands on a **fixed number in
  the predictive path** is the operational way to find the constants the signal should
  be teaching (the *constant hunt*). Mutation is a probe, never a kept change.

## The experiment loop — four files per cycle

Each `cycle-NNNN-*/` holds the same shape every time:

1. `stimulus.mjs` — the smallest **blind** stimulus that isolates the capability, with
   a planted contrast and **at least one control where the surface signal is loud**. No
   labels in the stimulus.
2. `measure.mjs` — a **read-only** script that emits per-item channels over prior
   context only (item *k* sees the items before it). Touches no production code; the
   test suite stays byte-identical.
3. `key.json` — the **held** key: item identities, the predicted per-channel
   dissociation, the control's predicted behaviour, a mechanism tag. Never enters the run.
4. `score.mjs` — the **blind** scorer: reads the control first (did the trivial
   explanation get caught), then the per-item split, then stability across the control.

Then: verify the instrument is live and the channel computed before reading the score;
score blind; branch (confirm + lock, or diagnose to root cause); append to the archive
and the ledger.

## Fix discipline

Locate the fix in the correct layer. Language/modality facts → an organ or a
convention. Mechanism → an adapter or the interior, modality-agnostic. Ship behind a
flag (`opts.adaptiveNovelty` for the surprise core; `RULES_REV` for the talker), off by
default, with **golden parity** — existing paths byte-identical, the suite green — and
run the experiment with the flag on. An interior change is not confirmed until a
**second sense** shows the same behaviour (the omnimodal gate). A fix's fitness is how
many independent pressures it improves, not whether it passes the one that prompted it.

## Running

```
node experiments/lib/wiki.mjs                       # draw a seed of record (1 article)
node experiments/lib/wiki.mjs --pair                # draw two (orthogonal collision)
node experiments/lib/pressure.mjs                   # sample a pressure across the axes
node experiments/cycle-0001-novelty-reserve/measure.mjs   # read-only measurement
node experiments/cycle-0001-novelty-reserve/score.mjs     # blind score against the held key
```
