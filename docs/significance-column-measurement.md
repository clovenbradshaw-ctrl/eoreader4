# Significance column — the measurement-first gates

The significance-column spec ships each pass behind a falsifiable gate: a pass goes live
only if it *measurably* separates a labelled contrast above its null; otherwise it ships
dark and the basis improves. This is the record of running those gates against real
labelled data.

## Corpus

`clovenbradshaw-ctrl/eo-lexical-analysis-2.0`, run `2026-03-15_122636` — the same corpus
the shipped 27-cell centroids (`data/centroids-27.json`) were built from. Its
`embeddings.npz` is a Google-Drive pointer to a 193 MB `.npz`:

- **19,764** multilingual clauses (41 languages), each LABELLED with its cube cell
  (operator + the q1/q2/q3 axes → operator, site, resolution).
- a real **3072-d embedding** per clause (`vectors.npy`).

No huggingface fetch is needed — the vectors ship in the file. The harness builds the
27-cell significance basis *from the corpus itself* (each cell's centroid = the
normalised mean of its clause vectors), projects every clause onto it, and runs the
three gates with real within-cell variance.

Reproduce:

```
# embeddings.npz contains a Google-Drive URL; download + unzip it, then:
node scripts/measure-significance.mjs --npz <dir-of-extracted-npy>
# or, with zero network, the archetype-grain instrument check on the 27 centroids:
node scripts/measure-significance.mjs
```

## Results (per-exemplar, 19,764 clauses)

| gate | metric | result | verdict |
|---|---|---|---|
| **Atmosphere — tone** | does each Atmosphere cell recover its own Ground-grain tone? | 3/3 | **PASS** |
| **Atmosphere — departure** | loaded (Interpretation) vs factual (Existence) KL from σ | 0.482 vs 0.399 | **PASS** (loaded departs further) |
| **Lens — separation** | frame margin (within−cross cell), projected vs raw embedding | 0.103 vs 0.024 | **PASS** (4× over raw) |
| **Paradigm — incommensurability** | cross-row ‖[Π,Π]‖ vs within-row null (α=0.05) | 3/3 beat null 0.230 | **PASS** |
| **Stance — confab guard** | Figure moves spectrally sharpest (Figure−Ground top-eigenvalue gap vs permutation null) | gap 0.055, p≈0.01 | **PASS** |

Cross-row commutators: Existence×Structure 0.345, Existence×Interpretation 0.232,
Structure×Interpretation 0.383 — all above the within-row baseline null (0.230).

## Held-out and permutation: the PASS is not in-sample fitting

A fix that is *correct* and one that merely *turned the verdict green* look identical at
the moment the number flips. Two checks separate them (both in the harness, `--npz`):

- **Held-out Lens.** Fit the cell centroids AND the centering mean on one half of the
  19,764 clauses; score the frame margin on the other half the mean never saw. Centered
  margin out-of-sample: **0.111** (vs raw 0.025) — it *holds*, slightly above the
  in-sample 0.103. So the win is real frame structure the projection exposes, not the
  projection memorising the corpus it was fit on.
- **Permutation null for the Atmosphere ordering.** The spec's own gate language refuses
  "three numbers in order" as a pass; it asks for separation above a null. Shuffling the
  loaded/factual/structure labels 300× (deterministic PRNG), the observed loaded−factual
  departure gap (0.083) is never reached by chance (max shuffled 0.041), **p ≈ 0.003**.
  The ordering clears the null.

This matters because the gates' credibility is that they *can* come back negative — and
the Atmosphere and Lens gates **did** come back negative first, on the uncentered
projection. The PASS is only as trustworthy as that FAIL was because it now also holds on
data the centering never touched, above a permutation null.

## The load-bearing finding: the projection must be mean-centered

The naive measurement — project onto the 27 centroids by cosine, build ρ — **fails** the
Atmosphere-departure and Lens gates:

- every activation reads ~0.95 against every centroid, so a large **common offset**
  dominates the projected vectors;
- the KL departure then collapses to ≈0 for *every* document, and the projected frame
  margin (0.005) is *smaller* than the raw-embedding margin (0.024) — the projection
  appears to destroy structure.

Subtracting the **basis mean activation** (the corpus prior's own mean reading —
basis-derived, fixed, available without the document) exposes the deviation that
actually carries the frame:

| | raw embedding | projected, uncentered | projected, **centered** |
|---|---|---|---|
| Lens frame margin | 0.024 | 0.005 | **0.103** |
| loaded−factual departure | — | 0.000 | **+0.083** |

So the SPREAD reads (departure, frame separation) are taken on the **centered**
activations; the MASS reads (tone, and the von-Neumann/Born spectrum used for the
prediction-novelty reserve) stay on the **uncentered** ρ, where the diagonal is a
genuine Born mass and the simplex/prediction story holds. This is now wired for the
Atmosphere departure (`src/surfer/atmosphere.js`, `corpusSigmaCentered`).

Because departure and tone now live in **different frames** (centered vs uncentered ρ),
the atmosphere result carries a `frame` field (`{ departure:'centered',
tone:'uncentered-mass' }`) and the audit (`fold.surf.atmosphere.frame`) records it — so a
later reader does not mistake the two numbers for co-spatial.

## Track F — the Stance face (how the surfer MOVES ρ)

Tracks A–E read the Horizon; Track F is the commit. `applyStance` (`core/spectral.js`)
is the nine cube stances as four real-symmetric primitives — floor-shift, project,
rank-1 update, rotate — sorted by Mode (Differentiate sharpens, Relate preserves the
spectrum, Generate produces). `updateStance` (`surfer/stance.js`) reads the move off the
field at the peak and is the **confabulation guard, quantified**: a Making only when a
rank-1 lens clears its spectral null; otherwise a Ground-grain Cultivating (flat field →
reserve) or Clearing (a surprise with no clean lens → dephase), each routed through
`cellAt` so a Figure commit at a Ground site is refused. The diagnostic-asymmetry the
corpus shows (Figure moves are the sharpest, Ground the most diffuse) is then a theorem,
not a statistic — a Figure move is a rank-1 change, the most detectable event that can
happen to ρ; a Ground move is a featureless floor-shift with no signature direction.
Off unless `opts.stance` is set; the live fold path turns it on only behind the meaning
embedder, so the goldens are byte-identical.

### The guard's own measured gate (GATE F)

The guard rests on the **diagnostic-asymmetry theorem**: a Figure move is a rank-1 change
to ρ (the most detectable event), a Ground move a featureless floor-shift — so `Making`
must leave a sharper spectral signature than `Cultivating`/`Clearing`, or the basis is
not carrying stance and the guard is decorative. Bucketing the 19,764 clauses by their
labelled grain and sampling small documents of each:

| grain | top eigenvalue | von Neumann entropy |
|---|---|---|
| Figure | **0.846** | **0.627** (sharpest) |
| Ground | 0.791 | 0.777 |
| Pattern | 0.767 | 0.816 (most diffuse) |

The Figure−Ground top-eigenvalue gap (0.055) clears a label-shuffle permutation null at
**p ≈ 0.01** — Figure moves *are* the spectrally sharpest, so the guard's Making-vs-reserve
discriminator reads real stance. Two honest wrinkles: (1) the binary Making *test* (top
eigenvalue clears its spectral null) saturates at this document size — every sampled doc
fires it, so the discriminating signal is eigenvalue *magnitude*, not the fire/no-fire;
(2) the full gradient came out Figure > Ground > Pattern, not cube.md's stated
Figure > Pattern > Ground — Pattern is the *most* diffuse on this corpus, a mild departure
from the corpus statistic worth recording rather than smoothing over.

### The helix turns: the Paradigm REC now emits

The Paradigm pass is no longer report-only. When the document's basis is defeated past
its within-document baseline (by the hysteresis margin), `surf.js` emits an append-only
`REC(Paradigm, Composing)` — `REC_Composing_Paradigm`, routed through `cellAt` — carrying
its **surprise-delta** (the margin by which the basis was defeated, which is also the cost
to clear to move back) and `reground: true` (the helix turning — REC re-admits what counts
as ground, handing the next read a bare NUL in the competing frame). The fold records it
as `note.reframed` (a reframe, not a deeper read) and the audit as `fold.surf.paradigmRec`.
Hysteresis is the margin factor within a call; a caller threading `opts.paradigmPrior` can
additionally require the defeat to have been *sustained* across reaches — the temporal
hysteresis a stateless surf cannot enforce alone. Off unless `opts.paradigm` is set.

## The helix-aware predictor (`surfer/helix-predict.js`)

The Bayesian sequence predictor (`sequence.js`) is single-rung: a flat n-gram over the
absolute INS stream (the Existence rung). It reads a *reframe* — a melody's key change, a
register shift — as novelty forever: TV-snow at the meaning layer, high surprise on a
signal that is not random, only re-based. `helixPredict` climbs a rung. It runs the same
n-gram at two rungs at once — **Existence** (the absolute unit) and **Structure** (the
*move* between units, frame-relative by construction) — and reads the difference as the
helix's own diagnosis:

| absolute rung | move rung | diagnosis | action |
|---|---|---|---|
| high | **low** | **mis-framed** — the frame moved, the pattern held | fire `REC(Paradigm,…)`, re-ground the absolute rung |
| high | high | genuine novelty / noise | reserve; there is no frame to find |
| low | — | the frame still fits | predict, no REC |

The thresholds are **measured**: "high" beats the `deriveNull` of a rung's own surprise
history (the Born rule on the surprise distribution), "holding" sits below the move rung's
running median — witness does not decide. On a motif stated in C then transposed to G, the
absolute rung's mean surprise rises across the seam (0.96 → 1.83 bits) while the move
rung's *falls* (1.19 → 0.74) — the mis-framed signature — and a `REC_Composing_Paradigm`
fires a few beats after the seam (hysteresis: sustained absolute-rot while the move holds,
not a one-off spike), re-grounding the absolute rung in the new key. `helixGenerate` then
draws the move rung to generate *through* a frame it never trained on — the learned shape,
transposed onto a new root. Demo: `npm run helix-predict`. The Significance rung
(lens-conditioned prediction, the σ cold-start prior, the `noveltyFromLensEntropy` reserve)
is the next rung up and waits on the meaning embedder; the Existence↔Structure climb and
the REC-relocation are embedder-free and shown here.

## What changed in the code, and what is still gated

- **Applied (validated):** the Atmosphere departure + per-window null now run on the
  centered activations. Tone stays on the uncentered mass-ρ.
- **Recommended next (validated in the harness, not yet in the live surf):** the Lens
  *conditioning* should use centered activations + centered eigen-lens vectors, since
  the uncentered projection does not separate frames. This is held back from the live
  fold path only because it cannot be exercised end-to-end without a meaning embedder in
  the turn (huggingface.co is egress-blocked this session); the harness proves the
  principle (margin 0.103 vs 0.024).
- **Unchanged:** `lensEntropy` and the Born weights feed the prediction-novelty reserve
  off the uncentered simplex — the right object for "what reading does the next unit
  fall under."

## Honest limits

- The basis here is built from the corpus's own 3072-d embedder, not the shipped 384-d
  MiniLM. That makes basis and queries co-spatial (cleaner), but means these numbers
  validate the *mechanism*, not the shipped MiniLM bundle specifically. Re-running the
  full gates against MiniLM embeddings of the same clauses needs huggingface.co (blocked
  this session) or a pre-embedded MiniLM file.
- The Paradigm within-row baseline has high variance (max 0.71 vs mean 0.27); the
  deriveNull robust bulk-fit handles the outlier, but the cross-row margins are modest
  (Existence×Interpretation clears the null by only 0.002). The pass is real but not
  comfortable — hysteresis on the live ascent is not optional.
