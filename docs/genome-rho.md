# ρ on the genome — decomposing a locus into its competing readings

> Experiment spec. Written against `src/core/spectral.js` **unmodified**: the four
> functions `buildDensity(vectors, weights, signs)`, `eigenLenses(rho, {k})`,
> `vonNeumann(values)`, `relEntropy(rho, sigma)`, with `deriveNull` as the null.
> Status: Tests 0–2 BUILT AND RUN (`scripts/genome-rho.mjs`, `src/organs/in/locus.js`,
> `tests/genome-rho.test.js`); data pulled into `data/genome/`. Test 3 needs an
> external gLM. Measured outcomes in **Results**, below — including where the
> predictions did NOT hold. Run it: `node scripts/genome-rho.mjs`.

## The point of view

Genomic language models read DNA with a single stance — the **predicting reader**:
one conditional probability per position, surprise = deviation from a context-trained
expectation. That stance wins on raw variant-effect prediction and it is already
native to this engine's Born rule (`voidnull.js`). It is not what this engine can do
that the big models cannot.

The thing they structurally cannot do is **separate two readings that a single
surprise score smears together**. The sharpest open problem in the field — gLMs
stumble on evolutionarily *implausible but functional* sequences — is exactly this
confusion: "rare because selection removed it" and "rare because evolution never
reached it" are two opposed readings collapsed into one likelihood. A single
next-token predictor has one scalar field; telling those apart needs two vector
fields that can **interfere**.

This engine has interference as its definition of ρ. `buildDensity` (`spectral.js:144`)
forms

```
ρ = Σₖ wₖ · sₖ · |vₖ⟩⟨vₖ| ,  trace-normalised
```

with a **signed** sₖ "so an asserting reading and a defeating one of the same content
INTERFERE rather than accumulate" (`spectral.js:9-10`). The experiment supplies three
columns and a null; the engine supplies the algebra:

| symbol | what the experiment provides | engine consumes it as |
|--------|------------------------------|-----------------------|
| **vₖ** | the reading vector for unit *k* (the basis is per-test, see each test) | `vectors[k]` |
| **wₖ** | salience — e.g. surprise magnitude. *A weight, never a lens.* | `weights[k]` |
| **sₖ** | ±1 stance: does this vantage assert or defeat the reading? | `signs[k]` |
| null | the chance spectrum a random ρ of this rank throws up | `deriveNull(spectrum, {alpha})` |

The readout is then three engine functions, no new math:

- **`eigenLenses(rho)`** (`spectral.js:179`) — the locus's readings, ranked, each weight
  a Born probability for a PSD build. *How many readings, and how much mass each.*
- **`vonNeumann(spectrum)`** (`spectral.js:194`) — S = −Σ λ ln λ, "the concentration of
  readings AND the predictive uncertainty of the next unit." **This is the
  smear detector.** One reading → pure state, S→0. Two competing readings → mixed
  state, S high. The number that says a single surprise score is doing two jobs.
- **`relEntropy(rho, σ)`** (`spectral.js:212`) — KL departure from a ground σ, for the
  selection-baseline comparison in Test 3.

## The load-bearing principle: signed vs. unsigned is the result

Every test is **run twice** — once with `signs` supplied, once with `signs = null`
(all-asserting, the PSD default) — and **the difference is the finding.** If the
signed and unsigned spectra match, the two vantages did not interfere: the point of
view is falsified for that locus, cheaply, with no outcome wasted. If they diverge,
the signed build has separated something the unsigned (and any single-stance gLM)
cannot. This is the same discipline the modality probes use (`docs/genetic-code.md`):
demonstrate *and* falsify against a control in the same run.

## Implementation caveats against the live API (verified, not assumed)

The signed build leaves the PSD cone, and three details of the real functions bite
there. The experiment code must handle them; `spectral.js` is correct but its
defaults assume the unsigned case.

1. **`eigenLenses` sorts by signed *value*, descending** (`spectral.js:183`,
   `b.weight - a.weight`) — not by magnitude, despite the header's wording. A strong
   *defeating* direction is a large-negative eigenvalue and sorts **last**, not first.
   Read lenses by `Math.abs(weight)` when `signs` are in play.
2. **`vonNeumann` drops non-positive eigenvalues** (`spectral.js:197`, the `λ > 1e-12`
   guard) — correct, entropy is a property of the probability spectrum, but it means
   you must filter to positive eigenvalues yourself before handing the spectrum in,
   and the entropy describes only the asserted mass.
3. **Trace can cancel to ~0.** `buildDensity` normalises by Tr = Σ wₖ sₖ |vₖ|²
   (`spectral.js:165`); when assertion and defeat fully annihilate, Tr→0 and the
   guard at `1e-300` leaves ρ near-degenerate. That is not a bug — a locus whose two
   vantages exactly cancel is a real readout (total interference) — but the test must
   detect it explicitly rather than read a renormalised ratio of two tiny numbers.

## The four tests, each gating the next

### Test 0 — synthetic positive control (no data, no network)

**Question:** can ρ recover a cancellation we plant by hand?
**Construction:** two overlapping reading directions A, B. Vantage 1 asserts both;
vantage 2 *defeats* A (same direction, opposite sign). `vecs=[A,B,A]`,
`signs=[+1,+1,−1]`.
**Prediction:** unsigned keeps two lenses (A and B both present); signed collapses A
out, leaving one lens along B, S→0.
**Verified against the live API:**

```
UNSIGNED spectrum: [0.912, 0.088, 0, 0]   S = 0.298   (two lenses)
SIGNED   spectrum: [1.000, 0,     0, 0]   S = 0.000   (one lens — A annihilated)
```

**Gate:** if ρ cannot recover structure you built by hand, **stop** — nothing
downstream is interpretable.

### Test 1 — strand complementarity (calibration gate)

**Data:** *E. coli* K-12 MG1655, `GCF_000005845.2` (NCBI Datasets, free).
**Question:** does the basis encode that a sequence and its reverse-complement are one
object? This is the field's validated load-bearing symmetry (Caduceus / JanusDNA
hard-code reverse-complement equivariance) — here we **measure** whether the
prefix-reading representation (`src/organs/in/codon.js`) already respects it.
**Construction:** build ρ over a window's codons and ρ over its reverse-complement.
Two routes to one verdict: (a) `vonNeumann` should be *lower* on the signed
forward⊕RC build than unsigned, if the two strands are read as one; (b)
`commutator(projectorFrom(forwardLenses), projectorFrom(rcLenses))` (`spectral.js:261`,
zero iff shared eigenbasis) measures the residual non-equivariance, gated against the
within-window baseline the Paradigm pass already builds (`surf.js:280-295`).
**Prediction:** known answer — the strands are one object, so a *correct* basis gives
signed S < unsigned S and a commutator at or below baseline.
**Gate:** if it fails, the basis does not encode complementarity. The commutator
residual *names the signed axis you would have to impose* (this is Caduceus's
hard-coding, but measured rather than assumed). Fix the basis before Test 2.

### Test 2 — reading-frame opposition (the headline)

**Data:** φX174, `NC_001422` — the textbook overlapping-genes genome (free).
**Question:** can ρ hold "this locus is read in several frames at once," which a
forced-single-parse tool cannot represent?
**Construction:** for each window, build the reading vectors for each of the (up to
six) frames as separate units; ρ mixes them. A single-frame coding region vs. a φX174
region where genes overlap in two frames.
**Prediction:** single-frame region → ρ collapses to **one** lens (S low, one frame
dominant). Overlapping region → ρ stays a **two-lens mixture** (S high, two frames
co-present, neither defeating the other). The contrast *one reading vs. several at
once* is the deliverable.
**Gate:** the entropy gap between single-frame and overlapping regions must clear the
permutation null (below). If it doesn't, ρ is not resolving frames.

### Test 3 — selection vs. accessibility (the field's open problem)

**Data:** EnteroBase population panel (segregating variation = what is *reachable*);
a COSMIC-style trinucleotide table (mutational *accessibility* / context shadow); one
off-the-shelf gLM for the selection likelihood. (Test 3 is the only test needing an
external model — not runnable offline in this repo.)
**Question:** decompose a locus's apparent constraint into real selection vs.
mutational shadow — the two improbabilities a gLM smears into one likelihood.
**Construction:** two vantages on the same content direction. Vantage S (selection):
gLM-improbability, **asserting** (sₖ=+1). Vantage A (accessibility): mutational
*un*reachability, **defeating** (sₖ=−1) — because "rare because unreachable" should
*subtract* from "rare because selected against," not add to it. Where they coincide
they interfere; the **residual eigenmass** after cancellation estimates how much
apparent constraint is genuine selection.
**Prediction:** a locus that is improbable-but-reachable keeps mass after signing (real
selection); a locus improbable-because-unreachable cancels toward zero (mutational
shadow, not constraint). No single-scalar predictor can produce this split.
**Gate:** the signed residual must predict held-out selection coefficients (or
dN/dS-style constraint) better than the unsigned likelihood alone, at the margin
below.

## Results (first run — `data/genome/`: E. coli MG1655 1–300 kb, φX174 NC_001422)

Reported honestly, signed-vs-unsigned and against nulls. One clean pass, one
inconclusive-with-diagnosis, one directional-but-muted. The negatives are kept.

**Test 0 — PASS.** The planted cancellation is recovered exactly. Unsigned spectrum
`[0.912, 0.088, …]`, S = 0.297 (two lenses); signed `[1, 0, …]`, S = 0.000 (one lens —
the defeated reading A annihilated). The interference build does what it claims, and
this is a unit test (`tests/genome-rho.test.js`), green offline.

**Test 1 — INCONCLUSIVE, with a clear diagnosis.** A strand and its reverse complement
*do* read as one object: ‖ρ_fwd − ρ_rc‖_F = 0.192 ≈ the within-strand baseline
‖ρ_h1 − ρ_h2‖_F = 0.191, and the lens-projector commutator (0.795) ≈ baseline (0.827).
**But the instrument cannot isolate RC-specific equivariance**, because ρ in the
prefix/position basis is *composition-dominated*: the distance to an unrelated window
(0.188) is also ≈ 0.19, and its commutator (0.765) is no worse than fwd↔rc. With
E. coli's intra-strand Chargaff parity (#A≈#T, #C≈#G), a reverse complement has almost
the same composition as everything else, so a composition-dominated ρ sees no
contrast. The composition-matched shuffle null (0.156) is *tighter* than any real
comparison — confirming the diagnosis. **Verdict:** consistent with RC-equivariance,
unproven by this basis. The fix is the basis the spec's own argument points to — a
signed purine/pyrimidine encoding where complementation *is* a sign flip — not more
windows.

**Test 2 — directional, muted by φX174's own biology.** The headline ordering holds in
both readouts: the dual-coding D∩E overlap is the most mixed state, the shuffled null
the most pure.

| window | open ORF frames (run ≥ 0.9) | ρ von Neumann S |
|--------|----------------------------|------------------|
| single-coding (gene F, 600 bp) | 2 | 0.413 |
| **DUAL-coding (D ∩ E, 276 bp)** | **3** | **0.564** |
| null (D∩E shuffled) | 0 | 0.271 |

The ORF-run salience cleanly finds the two real overlapping genes — frame +0 (gene E)
at 0.99 and frame +2 (gene D) at 1.00, two full-length ORFs in one window — and the
dual region's ρ entropy is the highest, exactly the "several readings at once" the
headline wants. The mute: φX174 is a *compressed* genome under multi-frame selection,
so even single-coding windows leave extra frames stop-free (gene F's reverse frame 0
runs 0.94) — real biology that shrinks the single-vs-dual gap. A clean single-coding
contrast needs an annotated non-overlapping genome (E. coli with its GFF), not φX174.

**What the run establishes:** the interference build is real (Test 0), the spectral
instruments run unmodified on genomic ρ (Tests 1–2), and the binding constraint is the
**basis** — exactly as `spectral.js:28-32` warns. A composition-dominated codon basis
cannot carry strand or selection contrasts; the next build is the signed
purine/pyrimidine encoding for Test 1 and an annotated genome for Test 2.

## Validation protocol (same shape the ρ-formalisation cleared)

- **Permutation null.** For each test's headline scalar (entropy gap, commutator
  residual, signed eigenmass), shuffle the labels that carry the claim (strand
  assignment, frame assignment, the S/A vantage tags) and rebuild ρ. The real value
  must beat the permuted distribution at **p < 0.05**.
- **Held-out margin.** Fit any threshold on one chromosome arm / gene set, report on a
  disjoint one. No threshold chosen on the test data.
- **Spectral null on every lens.** A lens counts as a real reading only when its weight
  clears `deriveNull(spectrum, {alpha: 0.05, leaveOut: weight})` — the same gate
  `surf.js:233-240` already applies. A two-lens mixture is only "two readings" if both
  clear it.
- **Signed vs. unsigned, always reported together.** Per the principle above: a null
  result (signed ≈ unsigned) is a published falsification, not a failure.

## What this adds to the codebase

Minimal, and it reuses `spectral.js` untouched:

- `src/organs/in/locus.js` — the per-test basis: a window of sequence → reading
  vectors (vₖ), with weights (wₖ) and stance signs (sₖ). The one piece of real design;
  everything downstream is the existing spectral pipeline.
- `scripts/genome-rho.mjs` — runs Tests 0–2 (offline; Test 1–2 fetch the two accessions
  once), printing the signed-vs-unsigned spectra and the permutation-null verdicts.
- `tests/genome-rho.test.js` — Test 0 as a unit test (no network), asserting the
  cancellation the live API already confirms.

Test 3 is specced but gated on an external gLM and a population panel; it is the
target the first three build toward, not the first build.

## Data appendix

| handle | accession / source | role |
|--------|--------------------|------|
| *E. coli* K-12 MG1655 | `GCF_000005845.2` (NCBI Datasets) | Test 1 strand calibration |
| φX174 | `NC_001422` (NCBI) | Test 2 overlapping genes |
| Enterobacteriaceae panel | EnteroBase | Test 3 reachable variation |
| trinucleotide spectrum | COSMIC SBS table | Test 3 accessibility |
| genomic LM | any off-the-shelf gLM | Test 3 selection likelihood |
