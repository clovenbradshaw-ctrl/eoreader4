# Findings — the map of what the engine can and cannot predict, and why

A running map produced by the selection campaign. Each line is the surfaced result
of a blind experiment; the full record is `ledger.jsonl`, the population is
`archive.jsonl`, the guards are `locks/` (and `tests/evo-*.test.js`).

## Confirmed capabilities (with mechanism)

### C1 — newcomer-surprise tracks the reader's own γ-decayed novelty rate
*(E001, interior, omnimodal-gated, locked)*

A reader fresh off a burst of newcomers is **less** surprised by another newcomer;
a reader in a confirmation plateau is **more** surprised. Before this campaign the
reserve held for the as-yet-unseen was a hand-set constant (`NOVELTY_RESERVE = 1.0`),
so the reader was **equally certain that nothing new would come whether it had just
seen three newcomers or none** — the named exemplar of a constant standing in for
something the signal should teach.

- **Mechanism.** `reserve = Σ_newcomers γ^(at-1-firstSeen)` — the γ-decayed count of
  newcomers (the recent novelty *rate* as an amplitude), carried through the
  **unchanged** Born step (`surpriseAt`/`forwardDist`). Context enters at the
  amplitude; the law stays put.
- **Layer.** Interior — `src/core/surprise.js` (`noveltyReserve` + an
  absolute-continuity opening guard), threaded through `src/perceiver/reading.js`
  behind `opts.signalReserve`, **off by default** (the 649-test suite stays
  byte-identical — the parity gate).
- **Evidence.** Two surface-matched contexts (identical distinct-figure count,
  raw-newcomer count, and total γ-mass — so any surface method is provably flat):
  fixed reserve dissociates **0.00** bits (the gap), signal reserve dissociates
  **+0.46** bits (the fix), and the effect is newcomer-specific (×13 the
  returning-probe change).
- **Omnimodal.** Replicates through one shared reader (`readingAt`) in a second,
  different organ — **music** (`ingestMusic`, +0.71 bits, dominating the structural
  baseline ~9×) — with no per-sense code. Confirmed in two senses ⇒ interior.

### C2 — the signal reserve is a better predictive model of real content
*(E002, generalization of C1, locked)*

On a random Wikipedia article (*IC Bus*, 1201 content tokens) reduced to its
entity-arrival stream, the signal reserve **lowers mean held-out predictive
surprisal by 0.24 bits/step** (a proper scoring rule, scored causally) — and the
edge is **recency-specific**: it beats its own seeded shuffle (ordered +0.24 vs
shuffled +0.15). The fix is not a patch for one planted set; it improves an
independent pressure of a different shape.

## Located scope and limits

- **Structural organs carry more than the reserve.** In music the belief field also
  holds CON/interval propositions, which dissociate on their *own* recency (~0.08
  bits). The reserve fix dominates this but does not remove it — the confound-free
  flatness test is only clean in the bare stream.
- **Part of C2's gain is a better average *level*, not recency.** ~0.15 of the 0.24
  bits/step survives shuffling; only ~0.09 is recency tracking. The recency edge
  lives in the full article's reuse plateaus, not the high-novelty intro (a prefix
  can hide it).
- **An unlocked dimension (E003).** Every structure-preserving perturbation of the
  reserve law breaks C1 — *except* an off-by-one in the exponent (`γ^(at-f)` vs
  `γ^(at-1-f)`), a near-equivalent law the lock cannot distinguish. The decay's
  **presence and direction** are load-bearing and locked; the exact offset is not.

## Cold regions (pressures waiting to be drawn)

Interior sites no current experiment would catch under perturbation — each is a
missing pressure:

- `src/core/voidnull.js#deriveNull`, `#extremeValueZ` — the Born-rule VOID boundary.
- `src/predict/predictor.js#FLAT_CONCENTRATION` — the predictor's-VOID threshold (a
  hand-set `0.33`, a constant-hunt candidate).
- `src/perceiver/reading.js#GAMMA` and `DEFAULT_PROJECTION_RULES.decay_gamma` — the
  horizon constant.
