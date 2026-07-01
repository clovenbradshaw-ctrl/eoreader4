# exp-0005 — the observed operates at multiple holon levels

## Pressure
exp-0003/0004 read every stream at **one** level: build one ρ, pick one reading count,
segment once. But the thing being observed is itself holonic — a register contains
sentence-scale structure contains token structure; boundaries live at several scales *at
once*. A probe of the exp-0003 battery confirmed those streams are single-level by
construction (`readingCount` abstains within every block — no sub-structure to find), so
the multi-level case was never tested. This experiment builds it.

Two failures stack when a single read meets a multi-level object:

1. **Sign-blindness.** The Born rule as used — `argmax |⟨u|lensₖ⟩|²` — squares the
   projection, so the two poles of a bipolar lens are indistinguishable. When a *balanced*
   split is centred, its two sides collapse onto **one axis** (the clusters become ±v of a
   single eigenvector) and read as the *same* reading — no boundary. (This is the true
   cause of `hard_two_balls` scoring 0 in exp-0003/0004, not "degeneracy.")
2. **Level collapse.** Even sign-aware, one global read segments only the *dominant*
   level; the finer boundaries are in the signal but unread.

## Claim (held in `key.json`)
- **Sign-aware assignment** (`bornAssign` signed — rank over the ± poles) resolves the
  balanced splits the squared rule collapses.
- A **recursive holon reader** — read at a scale, then descend into each segment with
  **local re-centering** (the segment's own family becomes the common mode, so the finer
  readings surface), re-deriving the void (`readingCount`) at each level and **halting where
  it abstains** ("this holon is whole") — recovers the finer levels a single read collapses.

## Stimulus (blind) · nested boundaries — `stimulus.mjs`, `battery/*.json`
Four streams carrying boundaries at 2–3 scales at once: coarse sections in orthogonal
family subspaces, each holding finer sub-readings (with recurrence); one genuine
three-level nest (family ⊃ mid ⊃ fine). The held key records the boundaries at *every*
level; the measure reads only `units`.

## Verdict (`node measure.mjs && node score.mjs`)
**CONFIRMED.** mean all-levels boundary F1: **squared-single 36 % → signed-single 52 % →
recursive-holon 65 %**. The finer level specifically: **signed-single 27 % → recursive-holon
51 %** — the descent nearly doubles it. All three key checks pass.

- `nested_2level_a`: squared 0 % (the balanced coarse split is invisible) → signed 29 %
  (coarse recovered) → holon 53 % (coarse F1 **100 %** at level 0, fine recovered under it).
- `nested_3level`: 25 % → 44 % → **67 %** — the recursion reaches all three levels.

Side effect worth noting: sign-aware assignment alone lifts `hard_two_balls` from 0 % →
**67 %** — the near-degenerate multiplicity exp-0004 needed atmosphere to rescue was a
sign-blindness artefact all along.

## The shape of the finding
The Born rule stays the one universal — but a *measurement has a sign*, and a *reading has
a scale*. "The high sets the probabilities for the low": the coarse reading defines the
frame (the common mode to remove, the sub-space to read within) in which the fine reading
is measured. Recursion done with a per-level void is that principle made mechanical; the
abstention (`readingCount` k=1) is the signal that a holon is whole and the descent stops.

## Honest limits
The recursive reader still over-reads inside a section (finer-level precision is the loss —
some spurious sub-cuts survive the median/NMS on short, noisy segments). Deeper nests
(≥3 levels) lose F1 as the per-level N shrinks and the void grows conservative — the honest
floor on how fine a holon can be resolved from how little of it is seen.

## Control (the parity gate)
`bornAssign`'s DEFAULT (squared) is byte-identical to the assignment every prior reader
used; the signed pole-split is opt-in. Every default engine path is byte-identical:
`node --test tests/*.test.js` green (+4 new). Regression lock: `tests/born-assign.test.js`.

## Files
- mechanism: `src/core/spectral.js` (`bornAssign`), re-exported from `src/core/index.js`
- regression lock: `tests/born-assign.test.js`
- this pressure: `stimulus.mjs` → `battery/*.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
