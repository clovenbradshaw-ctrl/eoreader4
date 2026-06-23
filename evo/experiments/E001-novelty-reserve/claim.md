# E001 — the novelty reserve should track the recent novelty rate

**Source.** Inside-out draw (the constant hunt), landing on the fixed number in the
predictive path: `src/core/surprise.js` `NOVELTY_RESERVE = 1.0` (and its copy
`NOVELTY = 1.0` in `src/perceiver/reading.js`). This is the campaign's named
exemplar: a reserve set as a constant is blind to whether newcomers have been
arriving.

**Capability claimed.** The reader's surprise at a newcomer should track its own
recent novelty rate. After a *burst* of newcomers the reader should expect another
(a newcomer is less surprising); through a *plateau* of pure confirmation it should
not (a newcomer is more surprising). With a fixed reserve the reader is equally
certain that nothing new will come whether it just saw three newcomers or none.

**Dissociation predicted.** Two contexts are built with **identical surface**:
the same number of distinct figures, the same raw newcomer count, and the same
total γ-mass at the probe. They differ only in the *recency* of the newcomers —
early-burst (newcomers early, then a confirmation plateau) vs late-burst (a
plateau, then newcomers arriving just before the probe). A newcomer probe then
arrives.

- Under the **fixed** reserve the two contexts give the *same* surprise on the
  newcomer (the gap: the engine is blind to its own novelty rate).
- Under the **signal-derived** reserve (the γ-decayed newcomer count) the
  late-burst context gives *lower* surprise on the newcomer than the early-burst
  context (the fix: the engine tracks its novelty rate).

**Control (loud surface).** Distinct-figure count, raw-newcomer count, and total
γ-mass are matched across the two contexts by construction. Any method that wins
by reading those surfaces is therefore *flat* across the pair — only the
recency-weighted (γ-decayed) novelty rate dissociates them. A fix that fires on
the matched surface is hollow and is caught here.

**Control (mechanistic, newcomer-specific).** The reserve reweights the
*newcomer's* probability. The signal-vs-fixed change on a **returning**-figure
probe must be far smaller than on a **newcomer** probe — otherwise the effect is a
global rescale, not a novelty reserve.

**Omnimodal gate.** The fix is in the interior (`surprise.js`), so it must help a
second sense. The same contexts are run through (1) the bare-membrane unit stream
(the interior reading raw units, perfect surface matching) and (2) the **music**
organ (`ingestMusic`, pitch class as the recurring entity) — one shared reader
(`readingAt` → `surpriseAt` → `noveltyReserve`), no per-sense code. The direction
of the dissociation must replicate in both.

**Mechanism tag.** `reserve = Σ_{newcomers} γ^(at-1-firstSeen)` — the γ-decayed
count of newcomers (the recent novelty rate as an amplitude), carried through the
unchanged Born step (`surpriseAt`/`forwardDist`). Context enters at the amplitude;
the law stays put.
