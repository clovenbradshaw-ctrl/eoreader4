# Born-rule edge weight — the projection stops inventing coefficients

> Why the researched-Dolphin read came out as hedging, not an essay. The reading was fine;
> the **projection** collapsed it. The generator hedged because the ground it was handed had
> effectively zero weight — and it honestly will not assert what has no weight. The fix is
> not another magic number. It is to derive the two coefficients the projection had invented.

## The failure, from a real export

A memory audit of two Wikipedia pages (1242 lines, 693 propositions): the raw reading
weights were healthy (`event.w ≈ 0.7`), but the **projected** edge weights had collapsed —
**640 of 693 below 1e-30, only one above 0.01** (max 1.12, median 1.4e-114, min 8e-193).
A field with one live edge and 692 dead ones is degenerate: retrieval has nothing to rank,
nothing clears the grounding floor, so the answer hedges everything. (Compounding it, the
propositions themselves were `svo-regex` cruft — "Archived", "Journal", taxonomy-infobox
entities — but even clean content would have collapsed under the projection.)

## The two invented coefficients

`projectGraph` weighted each edge `base · γ^dist`, gated by `edge_weight_floor`:

- **`decay_gamma = 0.7` per sentence.** A fixed recency rate. `0.7^40 ≈ 1e-6`, so anything
  ~40 sentences from the cursor was already negligible; over 1242 lines the far end reached
  `0.7^1200 ≈ 1e-193`. The rate was calibrated for a short read at a local cursor and does
  not survive a long document — it collapses it to a ~40-line window.
- **`edge_weight_floor`.** A constant keep/drop line. A number you invent and hope fits.

Both are exactly the "hardcoded coefficient" the rest of the engine already refuses to keep
(`voidnull.js`: "A constant is a number you invent. This module replaces it with a number
the signal computes for you.").

## The Born-rule replacement (both derived)

1. **The recency rate is the reading's own scale.** The kernel is `exp(−dist/τ)` where
   **τ is the mean edge-distance** of this projection — derived, not set. So the kernel spans
   *this* read whatever its length: on a short read τ is small and the decay is sharp; on a
   long read τ is large and the whole document contributes. `exp(−dist/τ)` is O(1) and never
   underflows. On the 1000-sentence test the far edge lands at 0.2× the nearest, not 1e-152.
   No `decay_gamma`.

2. **The keep line is the Born noise-null.** `edge_floor: 'born'` sets the line with
   `deriveNull` over the weight background — an edge is kept iff it beats what the field's own
   non-cohering background produces by chance (the same Born rule the void boundary already
   runs, `voidnull.js`). `alpha` (the tolerated false-positive rate) is the one *policy* input,
   not a salience constant, and a thin background makes `deriveNull` abstain → keep all
   (honest cold start). This is what drops the citation/markup cruft an ingest picks up. No
   invented floor.

The Born floor is **opt-in** (default keeps every edge, as `edge_weight_floor: 0` always did)
so the τ change stays ranking-safe and drops nothing on its own — the two are independent: τ
fixes the degeneracy, the Born floor removes cruft when asked.

## What it fixes, and what it does not

τ alone turns the degenerate one-live-edge field back into a usable weighted field — that is
the thing that was making the generator hedge, and it is fixed for every document length. It
does **not** clean up the `svo-regex` misparses or the Wikipedia infobox/reference leakage —
that is an ingestion concern (route researched pages through the real parser + the MiniLM
organ; strip references before reading). With `edge_floor: 'born'` the noise-null will drop
the lowest-weight cruft edges, but the real content fix is upstream.

## Files

- the projection: `src/core/project.js` (`computeProjection`, the edge-weight pass)
- the Born primitive reused: `src/core/voidnull.js` (`deriveNull`)
- the regression: `tests/born-edge-weight.test.js`
