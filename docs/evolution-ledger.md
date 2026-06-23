# Evolution ledger — the map of what the engine can and cannot predict

> A continuous force of selection on the predictive engine: each pressure becomes a
> blind falsifiable experiment with a held key and a loud-surface control; every fix
> passes the parity gate. The product is an engine reshaped by pressures no one chose,
> and a map of what it can and cannot predict, and why. This file is that map; the
> machine-readable record is [`data/evolution-ledger.jsonl`](../data/evolution-ledger.jsonl)
> and the replayable population is [`data/pressure-archive.jsonl`](../data/pressure-archive.jsonl).

## The substrate

| Artifact | What it is |
|----------|------------|
| [`data/pressure-archive.jsonl`](../data/pressure-archive.jsonl) | the population of pressures tried — stimulus shape, **seed of record** (random-Wikipedia titles + revisions, so every draw is replayable), difficulty under the live engine, novelty against the rest, verdict |
| [`data/evolution-ledger.jsonl`](../data/evolution-ledger.jsonl) | one line per experiment — capability, claim, verdict, mechanism, fix layer, and the scope where it holds and where it does not |
| `tests/*.test.js` regression locks | one lock per confirmed capability, written to **fail** the day its precondition (or its control) changes |

## Discipline

- **Randomness lives in the pressure, never in the test.** A wild draw becomes a blind
  experiment with a held key and at least one control where the cheap surface signal is loud.
- **A hand-rolled constant is a signal you are not using.** Every fixed number in the
  prediction/surprise path is a pressure waiting to be drawn; the fix is a signal-derived
  amplitude through the *fixed* Born step, never a better-tuned constant.
- **The interior carries the heaviest gate.** A capability that touches the interior is not
  confirmed until a **second sense** (a different organ) shows the same behaviour.
- **Fitness is generalization.** A fix is kept only if it lifts a sample of the archive and
  breaks no confirmed capability. Every prior lock stays green.

## Cycle 1 — the novelty-reserve constant hunt

The brief's own worked exemplar, found living in the code: `NOVELTY_RESERVE = 1.0` in
`src/core/surprise.js` — a fixed reserve probability for the unseen, blind to whether
newcomers have been arriving. Replaced with the signal's own γ-decayed novelty rate through
the unchanged Born step. Full write-up: [`docs/novelty-reserve.md`](novelty-reserve.md).

| Exp | Capability | Verdict | Senses | Fix layer | Scope |
|-----|-----------|---------|--------|-----------|-------|
| EVO-1 | novelty-rate-tracking reserve | **confirmed** | text + tonal | interior | holds for any reading with newcomers vs a non-trivial prior; inert (correctly) without newcomers |
| EVO-2 | reserve recency (decay load-bearing) | **confirmed** | text | interior | stale flurry surprises like a drought (0.64 ≫ fresh-flurry 0.12) |
| EVO-3 | content/parameter generalization | **general (9/9)** | text | interior | independent casts, lengths {4,6,8}, γ {0.5,0.7,0.9} |
| EVO-4 | surprisal-channel reserve (`pNovel`) | **located, not closed** | — | perceiver | same constant smell in the −log p surface channel — a future pressure |
| EVO-5 | generation reserve (`forwardDist`) | **located, not closed** | — | interior | the generation-side twin — a future pressure |
| EVO-6 | inert without novelty | **flat (by design)** | — | none | records a flat region — stop generating here |

### What changed on the map

- **A confirmed interior capability.** The engine's surprise now tracks real structure it was
  blind to: a newcomer is surprising in proportion to how *unexpected* it was given the recent
  novelty rate, not merely to the standing mass. Confirmed in two senses → interior.
- **Two located gaps.** The same constant smell lives in the surprisal channel (`pNovel`) and in
  the generation reserve (`forwardDist`). Both are recorded as open pressures (EVO-4, EVO-5) for
  later cycles — the constant hunt is not finished.
- **A flat region named.** Pure-confirmation readings have no newcomer to draw the reserve, so
  the fix is inert there. Recorded so exploration is not wasted on a flat landscape.

### Parity

`npm test` → **674 green** (667 prior + 7 new locks). The fix is opt-in (`signalReserve`,
default off); with the flag off, `readingAt` is byte-identical to the constant-reserve goldens
(`tests/surprise.test.js`). The Born law in `surpriseAt` is unchanged — only the amplitude fed
to it became context-sensitive.

## Reproduce the cycle

```
node scripts/novelty-reserve.mjs              # the blind experiment + the omnimodal (tonal) gate
node scripts/novelty-reserve-generalize.mjs   # the generalization sweep (9 independent cases)
node --test tests/novelty-reserve.test.js     # the regression lock, incl. the control
npm test                                       # parity — 674 green
```
