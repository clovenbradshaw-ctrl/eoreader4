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

Cross-row commutators: Existence×Structure 0.345, Existence×Interpretation 0.232,
Structure×Interpretation 0.383 — all above the within-row baseline null (0.230).

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
