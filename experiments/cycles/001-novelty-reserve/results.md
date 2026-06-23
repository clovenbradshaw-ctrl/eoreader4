# Cycle 001 — results

**Verdict: CONFIRMED.** A gap under the live engine, fixed in the interior, omnimodal-confirmed,
regression-locked. Parity held throughout (`npm test`: 644 → 650 green, default path byte-identical).

## The gap (live engine, blind measurement)

`pNext.reserve` — the forward object's probability mass for an unseen atom — is
`novelty/(sum+novelty)` with a fixed `novelty` constant, so it decays with accumulated mass
alone. Three equal-length streams at true recent-novelty rates **0.41 / 0.01 / 0.11** all land at
reserve **≈ 0.058**. The reserve tracks step-count, not the novelty regime: the reader grows
equally certain "nothing new will come" whether newcomers arrive every other line or never.

## The fix (interior, Born-rule, contextual)

`src/core/surprise.js :: bornNoveltyReserve` — novelty tied to the same Born rule the engine
derives for every other boundary (`voidnull.js`): the **recurrence void gives the odds**, alpha
is the only policy. The reserve is the **γ-weighted (contextual) rate of becoming-something**
against that void, bounded to `[alpha, 1-alpha]`.

A real finding fell out of tying it to the Born rule: **the void here is exact, not a quantile.**
voidnull's extreme-value quantile exists for *noisy* scores (overlaps, pixel extents) where
chance fakes structure. Basis-novelty is exact set membership — "an atom outside the basis
arrived" has no chance spread — so the void is exactly magnitude 0. Forcing `deriveNull` here in
fact **misfires** once novelty is common: at ~0.5 novel steps the novel magnitudes are a *mode*,
not a handful of outliers, so the robust bulk-fit swallows them and θ rejects everything. The
Born rule contributes its **policy** (alpha) and **discipline** (causal, contextual, cold-start
humility), with the void taken exact. (The quantile path returns the moment the magnitude is a
noisy score — left as scope.)

Wired in `src/perceiver/reading.js` behind `opts.calibrateReserve` (default off → byte-identical;
the RULES_REV promotion path). The text front-end only builds the per-step proposition-basis
deposits; the calibration core is modality-agnostic.

## Scores

| check | result |
|---|---|
| CONTROL (regime shift) | born falls 0.95 → 0.151; fixed flat 0.067 → 0.058; cheap cumulative stays 0.50. **PASS** |
| SPLIT (steady vs recurrence) | born Δ = 0.542; fixed Δ = 0.000. **PASS** |
| FITNESS (forward novelty log-loss) | fixed 0.792 → born 0.638 (gain 0.154). **PASS** |
| OMNIMODAL (music) | born high 0.950 vs low 0.064 (Δ 0.886); control falls 0.95 → 0.225; fixed Δ 0.000. **PASS** |

Confirmed in **two** modalities (text + music) through the same `readingAt` interior → it is the
interior, not a text leak.

## Files

`claim.md` · `stimulus.json` (blind) · `key.json` (held) · `measure.mjs` (read-only) ·
`score.mjs` (blind) · `omnimodal.mjs` · `out.json` (measurement). Lock:
`tests/lock-novelty-reserve.test.js`.

## A note kept separate (cycle 002)

The streams use verbatim recurrence on purpose: the parser lifts adjuncts ("at dawn", "north")
into figures, which would inflate the per-step novelty. That is a **front-end (organ) fault**,
not the interior reserve gap — kept out of this measurement so neither change moves the other's
number. Characterised and addressed in cycle 002.
