# ρ on the genome — decomposing a locus into its competing readings

> Experiment spec. Written against `src/core/spectral.js` **unmodified**: the four
> functions `buildDensity(vectors, weights, signs)`, `eigenLenses(rho, {k})`,
> `vonNeumann(values)`, `relEntropy(rho, sigma)`, with `deriveNull` as the null.
> Status: Tests 0–2 BUILT AND RUN (`scripts/genome-rho.mjs`, `src/organs/in/locus.js`,
> `tests/genome-rho.test.js`); data pulled into `data/genome/` (E. coli MG1655, φX174,
> MS2). Test 3 needs an external gLM. Measured outcomes in **Results**, below —
> including where predictions did NOT hold and which results are calibration vs.
> discovery. Run it: `node scripts/genome-rho.mjs`.

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

### Test 1 — strand complementarity: TWO different questions, two different bases

This test splits in two, and they want opposite bases. Be explicit about which is
being answered (the run answers the first; the second is left open):

- **The calibration question** — *given a basis where complementation is a sign flip,
  does the interference build correctly cancel the redundant reading?* This needs a
  basis with the symmetry **built in** (each codon carried by its
  reverse-complement-canonical form + an orientation sign, `complementSignedReadings`
  in `src/organs/in/locus.js`). The answer is necessarily yes for `w ⊕ RC(w)` (that is
  the construction), so this is **Test 0 on real sequence with a biological sign** — it
  confirms the mechanism, it does *not* discover the symmetry. On top of the calibrated
  mechanism it *measures* a real, data-dependent quantity: the strand's violation of
  reverse-complement parity (Chargaff 2). See Results 1b.
- **The discovery question** — *can ρ find the strand symmetry it was NOT told about?*
  This needs a complementation-**agnostic** basis and the symmetry must *emerge*. Now
  answered, and the answer is **no, for a principled reason** (Results 1c): the
  mutual-nearest `SYN` merge — the one that discovered amino-acid families in the codon
  organ — fed codons described only by their genomic company surfaces the same
  shared-feature structure (first-two-base boxes), never reverse-complement pairs.
  Reverse complement is a **relabeling symmetry**, not a shared-feature one (position 2
  of an RC pair never matches; prefix-overlap ≤ 1 vs 2 for a box), so it cannot emerge
  from overlap clustering the way octave-equivalence and amino-acid families did. That
  is *why* 1b had to build it in.

**Data:** *E. coli* K-12 MG1655 `GCF_000005845.2` (the calibration + parity run).

### Test 2 — reading-frame opposition (the headline)

**Data:** φX174 `NC_001422` and MS2 `NC_001417` — two genomes with textbook
overlapping genes; multiple overlap loci, not one (n=1 is an anecdote).
**Question:** can ρ hold "this locus is read in several frames at once," which a
forced-single-parse tool cannot represent?
**Construction:** for each window, build the reading vectors for each of the (up to
six) frames as separate units; ρ mixes them. Overlap loci vs. single-coding controls,
each read against **its own genome's baseline openness** — because a compact genome
leaves extra frames stop-free, coding density is a confound and absolute open-frame
counts are not comparable across genomes (see Results 2).
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

## Results (`data/genome/`: E. coli MG1655 1–300 kb · φX174 NC_001422 · MS2 NC_001417)

Reported honestly, signed-vs-unsigned and against nulls. The negatives and the
confounds are kept — they are more informative than the passes.

**Test 0 — PASS.** The planted cancellation is recovered exactly. Unsigned spectrum
`[0.912, 0.088, …]`, S = 0.297 (two lenses); signed `[1, 0, …]`, S = 0.000 (one lens —
the defeated reading A annihilated). A unit test (`tests/genome-rho.test.js`), green
offline.

**Test 1a — the unsigned codon basis has NO discriminating power.** Not "weak signal,
better basis pending" — *no power*. At 300 bp, `‖ρ_fwd − ρ_rc‖_F = 0.192 ≈
‖ρ_h1 − ρ_h2‖_F = 0.191 ≈ ‖ρ_fwd − ρ_unrelated‖_F = 0.188`. Every window's
trace-normalised codon-count ρ is the *same* composition smear, so the basis cannot
tell a reverse complement from an unrelated window at all. The earlier "PASS" was an
artifact of a too-tight, composition-preserving shuffle null (0.156), and the
commutator carried a near-vacuous verdict. This is the system working — the
unrelated-window control caught it — but the honest status is *the instrument was
blind*, full stop.

**Test 1b — the signed complement basis: a CALIBRATION, plus a real regularity.** Two
distinct claims, kept separate:

- *Calibration (mechanism, by construction).* In a basis where complementation is a
  sign flip — each codon carried by its reverse-complement-canonical form with an
  orientation sign — the interference build cancels a strand against its own reverse
  complement: residual `‖ρ_signed‖/‖ρ_unsigned‖ = 0.000` for `w ⊕ RC(w)`. This is
  **Test 0 on real sequence with a biological sign**. It confirms the interference
  mechanism; it does **not** discover the symmetry, because the symmetry is built into
  the encoder. Calling this "ρ found that strands are one object" would be circular.
- *Measurement (on top of the calibrated mechanism).* The signed residual of a single
  strand is its violation of reverse-complement parity (Chargaff's 2nd rule), and that
  **is** data-dependent: real E. coli (40×3 kb) sits at **0.12**, unbiased random at
  **0.065**, a purine-biased strand at **0.78**. Real genomic strands sit near the
  parity floor — slightly above random, because genes and replication skew break parity
  a little — and an order of magnitude below a strand-biased control. A genuine,
  named, still-not-fully-explained genomic regularity, quantified through the signed ρ.

**Test 1c — the discovery question, answered: RC-pairing does NOT emerge unaided, and
there is a reason.** Fed the 64 codons described *only* by their genomic company (the
codon-bigram context, complementation-agnostic), the mutual-nearest `SYN` merge — the
exact machinery that discovered amino-acid families in the codon organ — produces:

| among the mutual-nearest pairs | count | chance | |
|--------------------------------|-------|--------|--|
| reverse-complement pairs | **0** | 0.21 | not enriched — does not emerge |
| same first-two-base box | **4** | 0.62 | ~6× enriched |
| same amino acid | 2 | 0.41 | enriched |

The merge surfaces the same **shared-feature** structure it always does (boxes,
composition) and never the strand symmetry. The reason is structural and is now a unit
test: a codon and its reverse complement share almost no raw features — **position 2 of
an RC pair never matches**, and prefix-overlap is ≤ 1 versus 2 for a same-box pair. So
reverse complement is a **relabeling symmetry**, categorically unlike octave-equivalence
or amino-acid degeneracy, which are **shared-feature** symmetries that emerge from
overlap. A relabeling symmetry cannot be clustered into existence; it must be *applied*
(1b's signed encoder) or *measured* (1b's parity residual). That is the deep reason the
discovery basis cannot exist as a mere re-coordinatisation — and it closes the strand
question across all three stances: blind (1a), calibrated (1b), and
un-discoverable-by-overlap (1c).

**Test 2 — reading-frame opposition across 3 overlap loci and 2 genomes.** Read each
locus against *its own* genome's baseline (the coding-density confound, below, forbids
cross-genome absolute comparison):

| genome | baseline openness (random windows) |
|--------|-----------------------------------|
| E. coli | open 1.15, S 0.463 |
| φX174 | **open 1.08** (compact: extra frames stop-free) |
| MS2 | open 0.78, S 0.312 |

| locus | open frames (Δ vs genome) | ρ S (Δ) |
|-------|---------------------------|---------|
| ▲ overlap φX174 D∩E | 3 (**+1.93**) | 0.564 (+0.01) |
| ▲ overlap φX174 A∩B | 2 (**+0.93**) | 0.559 (+0.00) |
| ▲ overlap MS2 lysis | 1 (+0.22) | 0.446 (**+0.13**) |
| · single MS2 replicase | 1 (+0.22) | 0.142 (−0.17) |
| · single E. coli aspK | 1 (−0.15) | 0.210 (−0.25) |
| · single E. coli thrC | 1 (−0.15) | 0.282 (−0.18) |
| ○ null (D∩E shuffled) | 0 | 0.252 |

**3/3 overlap loci sit above their genome's baseline; the clean single-coding controls
at or below it.** The ORF-run salience finds the real overlapping genes (φX174 D∩E:
frame +0 = gene E, frame +2 = gene D, two full ORFs at once). Two honest caveats:

- *The open-frame count is the strong readout; ρ von Neumann S is the weak one* — the
  frame reading-vectors are composition-similar, so the entropy Δ is near zero for the
  φX174 overlaps and only clearly positive for MS2. Where the two readouts disagree the
  count wins.
- *Coding density is a confound, not an annoyance.* φX174 is so compact that even a
  single-coding window (gene F) reads as 2 open frames — above its own baseline. So ORF
  salience and frame-entropy are **confounded by genome compactness**, and any
  cross-genome comparison must control for it (hence the per-genome baseline). This is
  invisible until a compressed genome forces it into view, and it is a real
  methodological constraint on Test 2.

**What the run establishes:** the interference build is real (Test 0) and runs
unmodified on genomic ρ; in a complementation-signed basis it correctly cancels
redundant strand structure (Test 1b calibration) and quantifies a real parity
regularity; the strand symmetry provably does *not* emerge from feature-overlap, with a
structural reason — it is a relabeling, not a shared-feature, symmetry (Test 1c); and
frame opposition shows up as above-baseline openness at true overlapping-gene loci
across two genomes (Test 2), modulo a coding-density confound. The strand question is
now closed across its three stances — blind unsigned basis (1a), calibrated signed
basis (1b), un-discoverable-by-overlap (1c). What is still *not* shown: a clean entropy
separation for frames (the count carries Test 2, not the entropy — frame vectors are
too composition-similar), and Test 3. The binding constraint throughout is the
**basis** — exactly as `spectral.js:28-32` warns.

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
