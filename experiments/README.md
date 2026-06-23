# Evolution campaign — continuous selection on the predictive engine

This directory is the persistent substrate for a campaign that puts the engine under a stream
of varied pressures, turns each into a **blind, falsifiable experiment**, and either confirms a
capability with its mechanism or diagnoses a failure to root cause and fixes it in the right
layer behind a parity gate.

The engine's job is prediction: read a unit, predict the next, the gap is **surprise** — the
only signal a teacherless system has. Almost every pressure reduces to one shape: *here is
something the reader should anticipate or tell apart from prior context alone; does it; and if
not, where is the signal lost.* The campaign sharpens the fidelity of that one signal.

## The discipline

**Randomness lives in the pressure, never in the test.** A wild pressure still becomes a blind
experiment with a held key and at least one **control where the cheap surface signal is loud**,
so a method that wins on the surface is caught. Every fix passes the **parity gate**
(`node --test tests/*.test.js` byte-identical on existing paths) and ships behind a flag,
off by default.

**A hand-rolled constant in the predictive path is a signal you are not using.** Every fixed
number — a reserve, a threshold, a rate, a band — is a place an external assumption stands in
for something the signal should teach. The fix is never a better-tuned constant; it is a
quantity derived from the signal's own recent history, carried as an **amplitude** through the
**fixed Born step**. Context enters at the amplitude; the law stays put.

**The interior carries the heaviest gate.** A change to the modality-agnostic core is not
confirmed until a **second sense** (a different organ) shows the same behavior. Confirmed in
one sense is a hypothesis; confirmed in two is the interior.

## The artifacts

| file | role |
| --- | --- |
| `archive.jsonl` | the population of pressures tried — each with its stimulus shape, **seed of record** (Wikipedia title+revision, so it replays), difficulty under the live engine, novelty vs. the rest, and verdict |
| `ledger.jsonl` | one line per experiment: capability, claim, stimulus shape, verdict, mechanism, fix layer, and the **scope** where it holds and where it does not |
| `coverage.json` | which sites the experiments have exercised; biases the inside-out draw toward the **cold regions** |
| `locks/` | pointer to the regression locks (the runnable locks live in `tests/`, so they run in the parity suite) |
| `lib/seed.mjs` | the replayable random-article seed source (the article supplies content; the axes supply the form) |
| `lib/store.mjs` | append-only helpers for the archive and ledger |
| `cycle-NNN-*/` | one experiment each: `stimulus.json` (blind), `key.json` (held), `measure.mjs` (read-only), `score.mjs` (blind), `out.json` (recorded), `FINDING.md` |

## Running a cycle

```sh
node experiments/cycle-001-novelty-reserve/measure.mjs   # read-only; writes out.json
node experiments/cycle-001-novelty-reserve/score.mjs     # reads the held key, grades blind
node --test tests/novelty-rate-reserve.test.js           # the regression lock
node experiments/lib/seed.mjs 2                           # draw a fresh seed for the next cycle
```

The measurement touches no production code and the suite stays byte-identical; the key never
enters the run, so reruns stay blind and comparable.

## Cycles so far

- **cycle-001-novelty-reserve** — *the flagship constant.* The novelty reserve `1/(mass+1)` is
  blind to whether newcomers have lately arrived. Replaced the constant amplitude with the
  γ-decayed recent newcomer **rate** through the unchanged Born step. **Confirmed in two senses**
  (text propositions, tonal pitches); gated behind `RULES_REV`/`NOVELTY_RATE`; parity green.
  See `cycle-001-novelty-reserve/FINDING.md`.
