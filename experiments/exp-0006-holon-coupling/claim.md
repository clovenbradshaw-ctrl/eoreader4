# exp-0006 — the two-way holon coupling (the stick figure)

## Pressure
exp-0005 detected the *levels* of a nested object. But a holon is not just nested — it is
*coupled* to its whole two ways at once (the user's stick figure): an arm

- **can do arm-things** (whole at its own scale), yet
- **much of its movement is tied to the body** — *the movement of the whole sets the
  probability of what the arm does* (downward regulation), and
- **the arm is what gives the figure the possibility of being a recognizable stick
  figure** — *the low sets the possibility of the high* (upward constitution).

Are these two arrows the *same* coupling or *different* ones? Can we measure them?

## Claim (held in `key.json`)
They are **distinct** couplings, both measurable:

- **Dynamic pull** (downward): `coupling(part, whole).pull` — the fraction of the part's
  motion the whole's shared mode sets. Varies across parts.
- **Structural constitution** (upward): the **rigidity** of the part's bond (a constant
  bone length) — invariant even when the part moves on its own. The most-invariant partner
  *recovers the skeleton*.

They dissociate on a **waver** limb (off-gait, dynamically autonomous) — low pull, full
constitution — and on a **ghost** (a floating point) — constitution below every real limb,
rejected as a non-part.

## Mechanism (`src/core/spectral.js` → `coupling`)
`coupling(part, whole)` returns `{ pull, k, residual }` with `part = k·whole + residual`.
`pull = cos² = R²` is the downward regulation; `residual` is the part's own motion — *and
the input to the next holon level down*. The whole's shared mode is the top eigenlens of
the node-velocity density; structural constitution is `1 − min bond CV` (the rigidity of
the most invariant bond); the skeleton is each node's `argmin`-CV partner.

## Stimulus (blind) · a walking stick figure — `stimulus.mjs`, `battery/*.json`
A kinematic tree (torso ⊃ limbs ⊃ sub-limbs) walking, three gaits/seeds. Each stream plants
a **waver** limb (off-gait 2.7 Hz swing — autonomous but rigidly attached) and a **ghost**
(a point floating to random positions — no bond). Per-node positions + velocities are the
units; the tree, waver, and ghost are the held key.

## Verdict (`node stimulus.mjs && node measure.mjs && node score.mjs`)
**CONFIRMED**, all four checks, three streams:

- **The whole dominates**: mean limb pull **65 %** — most of each part's motion is set by the
  whole it belongs to.
- **The skeleton is recovered from invariance alone**: **13/13 bones** (100 %) as the
  most-invariant partner — the structure is *discovered*, not given.
- **The arrows dissociate on the waver**: pull ≈ **44 %** (moves on its own) vs constitution
  **100 %** (still a rigid arm) — a 56-point gap on every stream.
- **The ghost is rejected**: constitution **62 %** < every real limb's **100 %** — the
  invariance test refuses it as a limb of the figure.

## The shape of the finding
For a *shared mode*, "the high sets the probability of the low" and "the low sets the
possibility of the high" are one coefficient read two directions — but the object is not
only a shared mode. **Motion** carries the dynamic pull; **structure** (the rigid bond)
carries the constitution; and the waver is the case that proves they are separate — an arm
whose motion has left the body's rhythm but whose *bond* has not. The residual of the pull
is the part's autonomy, and it is exactly what the next level down reads — so coupling and
the recursive holon reader (exp-0005) are the same descent seen from the coupling side.

## Honest limits
The dynamic pull shows a proximal→distal gradient (extremities are more their own); the
root (torso) reads ~0 pull because nothing above it pulls it — it *is* the whole's frame,
which the shared-mode measure cannot distinguish from "decoupled." Structural constitution
saturates at 1 for every rigid limb, so it separates part-from-nonpart cleanly but does not
rank among parts — a finer constitution scale (how much the whole's *recognisability*
depends on each part) is the next pressure.

## Control (the parity gate)
`coupling` is a **new pure export** (no state, no mutation); every default engine path is
byte-identical. `node --test tests/*.test.js` green (+4 new). Regression lock:
`tests/coupling.test.js`. The measure reads only `nodes/pos/vel`.

## Files
- mechanism: `src/core/spectral.js` (`coupling`), re-exported from `src/core/index.js`
- regression lock: `tests/coupling.test.js`
- this pressure: `stimulus.mjs` → `battery/*.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
