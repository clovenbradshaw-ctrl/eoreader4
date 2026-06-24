# The resolution spectrum — where a coref/identity decision needs the witness

> A reader should know its own ceiling. This is the axis it reads itself against:
> for any coreference/identity situation, **does resolving it need the witness
> channel to read meaning?** `src/core/resolution-spectrum.js` is the classifier;
> `conformance.html` renders it live.

## The axis is the witness channel — not hand-coded vs learned

The tempting cut is *hand-written rules vs learned model*. It is the wrong axis, and
naming it that way reintroduces the conflation it was meant to remove. The engine's
middle tier already contains a **corpus-learned statistical layer**:

- the **Fellegi-Sunter** agreement weights (`m/u` per attribute — how strongly a
  field's agreement implies identity),
- **discriminativeness** (inverse value-frequency — "born 1961-08-04" pins identity;
  "American" barely does),
- the **REC ledger**'s support/strain over defeasible conventions.

These are *learned from the corpus*, not written by hand — and they are **emphatically
not the model**. So the real boundary is **meaning**: a witness reads open-domain
meaning (world-knowledge, physical reasoning, a trigger word's sense) and deposits
defeasible weight into the field; it never decides (`coref.js`: "a witness observes, it
does not decide"). Everything reachable *without* reading meaning — deterministic rules
**plus** corpus-learned statistics — is one correctly-large region. Only meaning crosses
the line.

## The tiers

| tier | needs the witness? | what resolves it |
|---|---|---|
| **resolved** | no | structure already settled it (a name alias, a clear field winner) |
| **engine** | no | deterministic rules **+ corpus-learned statistics** (the large middle) |
| **mixed** | on a tail / sub-case | a learned/rule core with a witness-needing tail |
| **model** | **yes** | open-domain meaning no field salience or symbolic table covers |

`engineKind` on each type names *which* no-witness machinery applies — `rule` or
`learned` — so the middle is never mistaken for hand-coding *or* for the model.

## The straddle is the evidence — render it, don't flatten it

Some situations sit across the boundary, and the straddle is exactly what proves the
axis is real, so the classifier carries sub-cases rather than rounding to one bucket:

- **same-name-split (B3)** — two people under one identical string. A conflicting
  **functional key** (two birth dates / EINs) splits them deterministically — that is
  literally the D4 orthogonality, **engine**. Distinguishing them by **soft role**
  ("a senator who is not a plumber", both holdable by one person) needs world-knowledge
  — **model**. One row, two sub-cases.
- **casing-detection (A4)** — clean lowercased text is reachable by the source-class
  gate + S1–S4 (**engine**); genuine ASR/OCR **noise** leans on the witness.
- **held-near-identity (B6.5)** — **detecting** that "Tom Turner, runs NDP" and
  "Mr. Turner, runs NDP" are candidate-coreferent (surname + a shared discriminator) is
  corpus statistics, **engine** — and now built (it surfaces as a contested
  near-identity instead of two strangers). **Resolving** the dispute when their birth
  dates conflict — one person with a bad record, or two — is the witness's.

## What this change also fixed (the engine side, not the model)

- **B6.5 near-identity is surfaced.** Distinct multi-word names sharing a surname *and*
  a discriminator, with a conflicting functional key, now emit a held
  `near-identity-contested` (`INDETERMINATE`) instead of sitting as two unrelated
  entities. **Guard-first**: it is surfaced, never auto-merged — merging corroborated
  same-surname names is the dangerous half, deliberately deferred. Construction-gated
  three ways (surname ∧ shared discriminator ∧ functional conflict); it fires **zero**
  times on Metamorphosis and pg5200.
- **The functional-key extractor is title-aware.** `Mr. Turner was born in 1979` now
  attaches `bornOn` to the `Mr Turner` referent, so the B5 veto and the B6 contested
  zone work on titled names, not just bare ones.

## What this is honest about

Running the frontier through the real core today, of the five hardest cases **one**
strictly needs the witness (the Winograd pronoun — open-domain physical reasoning);
the rest are **engine** or **mixed** — the deterministic roadmap, not the model. The
prior framing ("pass these and you have needed an LLM") over-claimed by collapsing the
learned-statistical middle into the model side; this axis is the correction.
