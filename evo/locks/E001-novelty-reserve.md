# Lock E001 — the novelty reserve tracks the recent novelty rate

**Runnable lock:** `tests/evo-novelty-reserve.test.js` (runs in `node --test tests/*.test.js`).

**Capability locked.** A reader's surprise at a newcomer tracks its own γ-decayed
novelty rate: less surprised by a newcomer right after a burst of newcomers, more
surprised after a confirmation plateau. A hand-set constant reserve was blind to
this.

**Preconditions the lock fails on if changed:**

- **Control (loud surface).** The two contexts are matched on distinct-figure
  count, raw-newcomer count, and total γ-mass. If a future change unbalances them,
  the surface control test fails — a surface method could otherwise win hollow.
- **The gap.** With the fixed reserve, the bare stream is *flat* across recency.
  If that stops holding, the gap is no longer cleanly established.
- **The fix.** With `signalReserve`, the bare stream dissociates by > 0.1 bits in
  the predicted direction. Revert the reserve to a constant and this fails.
- **Newcomer-specific.** The reserve change concentrates on a newcomer, not a
  returner (> 2×). A global rescale would fail this.
- **Omnimodal.** The direction replicates in the music organ through the one shared
  reader. A text-only fix would fail this.
- **Parity / opening.** The flag-off path is the constant; the opening with a zero
  signal reserve is finite (the absolute-continuity guard), not NaN.

**Layer of the fix.** Interior — `src/core/surprise.js` (`noveltyReserve` + the
opening guard), threaded through `src/perceiver/reading.js` behind `opts.signalReserve`
(default off → byte-identical). Modality-agnostic; the membrane stays the line.
