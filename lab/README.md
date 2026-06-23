# lab — continuous evolution under random pressure

A standing campaign that puts the omnimodal predictive engine under a stream of
varied, partly-random pressures. Each pressure becomes a **blind, falsifiable
experiment**: here is something the reader should anticipate or tell apart from
prior context alone — does it, and if not, where is the signal lost. A pressure
either **confirms** a capability with its mechanism, or **locates** a gap that is
fixed in the right layer behind the parity gate.

One discipline holds above all: **randomness lives in the pressure, never in the
test.** A wild draw still becomes a blind experiment with a held key and at least
one control where the cheap surface signal is loud, and every fix still passes the
parity gate (`node --test tests/*.test.js`, byte-identical with the flag off).

## The substrate (read by every later step)

| file | what it is |
|---|---|
| `pressure-archive.jsonl` | every pressure drawn: its axes, its **seed of record** (Wikipedia title + revision, so the draw replays), its novelty, its difficulty under the live engine, its verdict |
| `ledger.jsonl` | one line per experiment: capability, claim, stimulus shape, verdict, mechanism, the layer of any fix, and the scope where it holds and where it does not |
| `regression-locks.jsonl` | one lock per confirmed capability, pointing at the `tests/` file that fails the day its precondition (including the control) changes |
| `seeds/` | cached Wikipedia summaries — the campaign replays offline and reproducibly |

## How a pressure is made

`lib/seed.mjs` pulls one or two **random Wikipedia articles** (the variation, from
outside the designer's head — a descriptive User-Agent + backoff is required or the
shared egress IP is rate-limited to a block page). `lib/sampler.mjs` draws the five
orthogonal **axes** (target cell · modality · kind · reading level · horizon),
biased toward the thin cells (EVA, REC, the empty SYN·Ground). The article supplies
the *content*; the axes supply the *form*. `draw.mjs` composes them, scores novelty
against the archive, and appends the pressure.

```
node lab/draw.mjs [nCycles] [seedsPerCycle]     # explore: draw fresh pressures
```

## How a pressure becomes an experiment (four files, every time)

Under `exp/<pressure>/`:

1. **`stimulus.json`** — blind. The smallest streams that isolate the capability,
   with a planted contrast and at least one **loud-surface control**. No labels.
2. **`key.json`** — held. Item identities, the predicted per-channel dissociation,
   the control's predicted behaviour, a mechanism tag. Never read during the run.
3. **`measure.mjs`** — read-only. Emits every channel per item over **prior context
   only** (causal). Touches no production code; the suite stays byte-identical.
   Verifies the instrument first (organ live, channel fed, fold reproduces the
   production reading) — a score off a dead organ is void.
4. **`score.mjs`** — blind. Reads the **control first** (did the trivial explanation
   get caught), then the **per-item split**, then branches.

## Confirmed capabilities

### P001 · novelty-reserve as a signal (interior, two senses)

*Seed of record:* `Crucifixion Triptych`@1352548289 × `Ceriagrion auranticum`@1314350478
(orthogonal collision). *Target cell:* NUL·Pattern — the held-open protention for an
as-yet-unseen form. *Phenomenon extracted:* a sequence that keeps introducing **new
forms** (the damselfly's metamorphosis) versus one that **dwells on a fixed cast**
(the triptych's settled panels).

**Claim.** The reserve the significance/forward Born step holds for the unseen should
track the recent **rate of newcomers**, not accumulated mass — high after newcomers,
low after a stretch of confirmation.

**Gap (status quo).** The constant `NOVELTY_RESERVE = 1.0` makes the reserve a
`1/(mass+1)`. At **matched mass**, novel-rich and confirm-rich streams get the
*identical* bayes value (text 0.274 = 0.274; frequency 0.744 = 0.744) — the reader is
blind to whether newcomers have been arriving. The recency control collapses too
(recent = stale): the constant tracks only the matched mass and diversity.

**Fix.** `noveltyRate` (`src/core/surprise.js`) — the γ-decayed rate of first
appearances, under the **same kernel** the proposition field decays by — supplies the
reserve *amplitude*; the Born step (`surpriseAt`/`forwardDist`) is untouched. Context
enters at the amplitude; the law stays put. Wired into `reading.js` behind `RULES_REV`
(flag off → byte-identical; `opts.rulesRev` overrides for a bench).

**Verdict — CONFIRMED, blind.** Under the rate reserve the mechanism pair dissociates
(novel-rich ≪ confirm-rich: text 0.08 vs 0.95; frequency 0.18 vs 1.47) **and** the
recency control dissociates (recent < stale: text 0.10 vs 0.22; frequency 0.21 vs
0.35), in **both senses**, while the constant collapses both. Two senses through
identical interior code → the change is **interior**, not a text fact in disguise.

**Gates.** Parity: `654` tests green, flag off. Trace: `RULES_REV=1` flips the
production `readingAt` bayes channel to the rate values. Generalization: finite,
well-formed and discriminating on `metamorphosis.txt` and `esker.txt`. Lock:
`tests/novelty-reserve.test.js`.

Reproduce:

```
node lab/exp/P001-novelty-reserve/measure.mjs     # emit the channels (writes out.json)
node lab/exp/P001-novelty-reserve/score.mjs       # blind verdict
node lab/exp/P001-novelty-reserve/generalize.mjs  # independent-document stability
RULES_REV=1 node --test tests/novelty-reserve.test.js
```

## Open pressures

`P002` (EVA·Figure, rhythm — Barbagia × Quoya cuneata) and `P003` (SIG·Pattern,
rhythm — Ledebouria × House of God) are drawn and awaiting a rhythm organ. A drawn
pressure whose sense has no adapter is not skipped — the organ is the next build.
