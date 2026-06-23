# The novelty reserve, read through Tinbergen's four questions

A swarm of ~10 parallel agent PRs (#90, 92, 93, 94, 95, 97, 98, 103, 104, and the outlier #91)
all proposed the **same** evolution to the engine's genome: stop hand-rolling the reserve mass
held open for an as-yet-unseen atom, and **derive it from the signal**. This document consolidates
that population into one coherent change, and explains it the way E.O. Wilson taught us to explain
any trait — through Niko Tinbergen's **four questions**. A complete account answers all four; they
are not rival explanations but four levels of one thing, two *proximate* (how it works, how it
develops) and two *ultimate* (what it is for, how it came to be).

> The trait: `experiments/exp-0002`. The mechanism lives in `src/core/surprise.js`; the wiring in
> `src/perceiver/reading.js` and `src/surfer/sequence.js`; the lock in `tests/novelty-reserve.test.js`.

---

## 1 · Mechanism — *how does it work, right now?* (the proximate cause)

The novelty reserve is the prior probability mass the reading holds open for an atom it has not
seen yet. It does two jobs: it keeps the KL surprise of a newcomer **finite** (absolute continuity
— no infinite "name-snow" shock), and it keeps the forward distribution `p(next)` **proper** over
an open basis (`Σ p + reserve = 1`). The reserve **share** is `novelty / (Σmass + novelty)`.

Before: a constant. `NOVELTY_RESERVE = 1.0`. The share then moves only as accumulated mass grows
— it is blind to how *fast* genuine newcomers are arriving.

After: a signal-derived amplitude (the consensus formula across the variant PRs):

```
noveltyAmplitude(firstSeen, at, γ) = Σ_{f < at} γ^(at−1−f)
```

the γ-decayed count of recent **first-appearances**. A flurry of newcomers lifts the reserve (the
unseen is plausible); a long recurrence drought lets it decay (a newcomer becomes a shock). The
amplitude then flows through the **unchanged** Born step `novelty/(Σmass+novelty)` — only its
magnitude becomes plastic, not the arithmetic around it. Two opening guards make a zero reserve
well-defined (`surpriseAt` returns 0 bits, `forwardDist` returns an empty distribution) rather than
dividing by zero, and a cold start (no prior first-appearances) falls back to the constant as a
**seed**. The constant did not die; it became the seed the plastic layer grows from.

## 2 · Ontogeny — *how does it develop within one reading?* (the proximate cause, in time)

A trait is not just its adult form; it is how that form is built over a lifetime. Here the lifetime
is a single reading, and the reserve **develops causally at the cursor**. Each atom's first
appearance is recorded as it is read (`firstProp` in `reading.js`, `firstSeen` in `sequence.js`);
only first-appearances strictly before the cursor `at` contribute. A reading never uses its own
future to set its present — the same causal discipline as the streaming noise floor in
`voidnull.js`. This is the **protention** named in `docs/bayesian-surprise.md` finally learning its
own amplitude instead of being told it: early, with a sparse field, the unseen is half-expected and
KL stays low; late, into a committed cast after a drought, a newcomer violates a confident
expectation and KL spikes — and now that calibration is grown from the signal, not fixed at 1.0.

The reserve is a property of the **shared interior**, so it develops in every organ that reads
through the core. The perceiver's significance channel (`surpriseAt`/`forwardDist` over the
proposition field) and the surfer's learned-sequence reader (`foldBefore`/`distribution`, the
n-gram melody/word-order reader) both inherit it from the same helper — one interior, two senses.

## 3 · Function — *what is it for? does it raise fitness?* (the ultimate cause: adaptation)

Function is not assumed; it is **measured against a control**. The blind, falsifiable experiment
(`experiments/exp-0002-novelty-reserve/`) reads two streams that differ only in the *time-structure*
of novelty, with the reserve OFF then ON, and reports the change in predictive surprise:

| stream | novelty structure | Δ surprisal (on − off) | verdict |
|---|---|---|---|
| stream-01 | positively autocorrelated (burst / drought) | **−0.20 bits** | signal **helps** |
| stream-02 | anti-correlated (newcomers maximally spaced) | **+0.24 bits** | signal **regresses** |

The function is a **dissociation**, not a blanket win: the same mechanism predicts *better* when
novelty clusters and *worse* when it is anti-correlated, because it tracks the *rate* of newcomers
but is blind to their *autocorrelation*. Its fitness over any real corpus is therefore set by that
corpus's novelty autocorrelation — which a rate-only reserve cannot see. This is exactly the gap
PR #98 named from inside the population.

### The promotion decision — pros and cons

Should the signal-derived reserve become the **default** (promote on), or ship **opt-in** behind
`opts.signalReserve` (gated off)?

**Gated off (what shipped):**
- ✅ Honors the parity gate — the 202 text goldens stay byte-identical, all 676 tests green. This
  is the cardinal rule of the substrate: existing paths byte-identical, then earn the change.
- ✅ Faithful to the evidence — the experiment measured a dissociation, not a confirmed adaptation;
  promoting a trait that regresses an unknown fraction of signals is exactly what the
  blind-experiment-plus-control discipline exists to prevent.
- ✅ Keeps the variant alive, locked, and measurable for the next selection cycle.
- ❌ The genuine improvement on autocorrelated material is dormant by default.

**Promote on:**
- ✅ Ships the real win on bursty / sustained-novelty signals; the reserve self-calibrates per
  modality, per reading.
- ❌ Breaks byte-identical parity — ~6 goldens diverge (e.g. `bayes #33` reverses) — the cardinal sin.
- ❌ Promotes a trait that fails its fitness test on anti-correlated streams.
- ❌ Couples a recognition-core change to output churn before the generator (Part II) is built.

**Disposition: NOT PROMOTED.** Selection keeps what survives the control *and* the gate, not what
looks plausible. The next cycle's target is an **autocorrelation-aware reserve** — one that closes
the dissociation rather than splitting it.

## 4 · Phylogeny — *how did it come to be?* (the ultimate cause: evolutionary history)

The trait has a lineage, and the substrate (`experiments/`) is its fossil record. This change is
not one author's idea; it is the **selection event** over a population of ~10 variants that
independently mutated the same locus:

- **The consensus body** (#90, 92, 93, 97, 98, 104) — the γ-decayed first-appearance amplitude.
  The dominant phenotype; adopted as the core form.
- **Equivalent computations** (#95, #103) — the same limit as a streaming recurrence
  (`decayed = γ·decayed + newcomers`); a cheaper internal shape of the same trait.
- **#94** — the explicit *seed* cold-start fallback instead of a magic floor. **Adopted.**
- **#95 / #97** — the opening guards on `surpriseAt` / `forwardDist`. **Adopted.**
- **#104** — the deterministic `opts.signalReserve` boolean gate (locks stay reproducible
  regardless of any env flag). **Adopted.**
- **#93** — wiring the surfer's `sequence.js` so the n-gram reader shares the interior. **Adopted**
  (the strongest "this is the genome, not one reader's quirk" evidence).
- **#98** — the central scientific finding: a rate is not enough; the reserve needs autocorrelation
  structure. **The verdict of record.**
- **#91 — the outlier branch.** A genuinely *different theory*: the reserve as a γ-weighted
  *fraction* of recent steps that delivered any newcomer, clamped to `[alpha, 1−alpha]` (Born-rule /
  alpha-tied), wired only into the forward channel. Recorded in the archive as the rival hypothesis,
  not folded into the core. It also carried an **unrelated** cycle-002 parser fix (adjunct /
  referent-only bonds) — left out of this consolidation as its own future experiment, so the reserve
  lineage stays clean.

What survives is recorded in `experiments/ledger.jsonl` (`exp-0002`); the drawn pressure and its
seed-of-record in `experiments/archive.jsonl`; and the day-the-precondition-changes guard in
`tests/novelty-reserve.test.js`. That is the phylogeny made durable: the next variant reads this
record, inherits the seed and the guards, and is selected against the same control.
