# exp-0002 — the signal-derived novelty reserve (the constant hunt)

## Pressure
`NOVELTY_RESERVE = 1.0` (`src/core/surprise.js`) is a hand-rolled prior: it reserves the same
mass for an as-yet-unseen atom whether newcomers are pouring in or the cast has long since
closed. A swarm of parallel variants (PRs #90, 92, 93, 94, 95, 97, 98, 103, 104) all proposed the
same fix — derive the reserve from the signal: the γ-decayed count of recent **first-appearances**,
`ν = Σ_{f<at} γ^(at−1−f)`. This experiment is the blind, falsifiable test of whether that helps.

## Claim (held in `key.json`)
The rate-derived reserve **improves** predictive surprise where novelty is positively
autocorrelated (bursts) and **regresses** it where novelty is anti-correlated (maximally-spaced
newcomers). The same mechanism cuts both ways because it tracks the *rate* of newcomers but is
blind to their *autocorrelation*.

## Stimulus (blind) · two novelty regimes
- `stream-01` — burst / drought: newcomers cluster, then long recurrence droughts.
- `stream-02` — a recurring 4-core with single newcomers maximally spaced.

The measure (`measure.mjs`) is key-blind: per stream it reads each cursor twice (reserve OFF vs
ON) and reports the mean change in predictive surprisal. The scorer (`score.mjs`) joins the key.

## Control (the parity gate)
With `opts.signalReserve` **OFF** the reading is byte-identical to the text goldens
(`tests/surprise.test.js`, `tests/bayes.test.js`, all 676 tests green). Every delta is measured
strictly against that off baseline, so a non-zero delta is the on-path's own effect.

## Verdict
**CONFIRMED DISSOCIATION — NOT PROMOTED.** The sign-split holds (stream-01 helps, stream-02
regresses). It is not promoted to default because (1) turning it ON breaks byte-identical parity
on the 202 text goldens — the cardinal gate — and (2) a blanket reserve would regress an unknown
fraction of real signals, since the net sign over a corpus is set by that corpus's novelty
autocorrelation, which a rate-only reserve cannot see. It ships OPT-IN behind `opts.signalReserve`
and is kept as the recorded variant the next cycle (an autocorrelation-aware reserve) improves on.

## Files
- mechanism: `src/core/surprise.js` (`noveltyAmplitude`, opening guards)
- wiring: `src/perceiver/reading.js` (figure + proposition fields), `src/surfer/sequence.js` (the second sense)
- regression lock: `tests/novelty-reserve.test.js`
- this pressure: `experiments/exp-0002-novelty-reserve/{stimulus,measure,score}.mjs` + `key.json`
- the four-questions reading: `docs/novelty-reserve.md`
