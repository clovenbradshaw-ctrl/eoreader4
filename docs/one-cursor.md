# One cursor — reading and writing on one line

> The capstone of three follow-ups. **Reference-by-reading** put the conversation on
> the document's reading line. **Rich notes** made the notes the reader's readout,
> projected from that line. This spec finishes the move: the answer is on the line
> too. There are not a reading cursor and a writing cursor — there is one cursor that
> reads the document, reads the conversation, reaches the question, and does not stop.
> **Generation is reading continued past the last unit that exists.**

The single claim, stated mechanically: the reader already predicts the next unit
(the γ-prior and `predicted.figures`/`pNext`). While units keep arriving the
prediction is checked against them and the gap is surprise. When the units run out the
prediction is all there is, and the system writes it. **Generation is committing the
prediction to the line and reading on.**

Today there are two cursors. `readingAt` (`src/perceiver/reading.js`) reads at a cursor
in the document. The write loop (`src/write/answer.js`) writes at a cursor in the
answer — building cells up front (`surfToPlan`), keeping its own fold
(`src/write/fold.js`), driving its own per-beat prompt (`src/write/cursor.js`). Two
cursors, two folds, two loops, joined by a handoff. This spec merges them: one line,
one cursor, one fold, one forward model; the witness becomes the reafferent branch of
one `step`, not a separate auditor.

The build order is `P0 → P4`, and the spec is emphatic: **"Each step ships behind
`RULES_REV` with golden parity, and each is preceded by a measurement that can come
back negative."** This document records `P0` — the gate — and what it measured.

## P0 — the gate (this is what landed)

P0 is two measurements. Both are runnable, both can come back negative, and both gate
later phases. They touch no production code (read-only), so the suite is byte-identical
(`node --test tests/*.test.js`, 637 pass).

| measurement | script | gates |
|---|---|---|
| two-fold equivalence | `scripts/two-fold-equivalence.mjs` | P4 (the fold collapse) |
| frontier predictor | `scripts/frontier-predictor.mjs` | P3 (generation as reading) |

The findings are pinned as regression locks in `tests/one-cursor-p0.test.js`, written
to **fail the day the precondition is fixed** — which is the signal to advance the gate.

### P0.1 — are the two folds the same standing state? **No, not as shipped.**

§4 claims the reader's γ-dossier and `write/fold.js`'s integral are "the same standing
state computed twice," and P4 proposes to delete the second and read the dossier off the
reader. The measurement feeds the same arrival to both standing-weight kernels:

```
reading.js:93   w = γ^(at − 1 − sentIdx),  sentIdx <  at    γ = 0.7   (prior EXCLUDES the cursor line)
fold.js:102     w = γ^(t  −      e.t   ),  e.t     <= t     γ = 0.8   (integral INCLUDES it)
```

They diverge on two axes — and only two:

```
arrival at k=5, read at cursor c=8:
  as shipped (γ 0.7 vs 0.8, clock off) ... reading 0.4900  fold 0.5120  → diverge
  unify γ only (0.75 / 0.75) ............. reading 0.5625  fold 0.4219  → diverge   (clock remains)
  align clock only (fold t := at−1) ...... reading 0.4900  fold 0.6400  → diverge   (γ remains)
  unify γ AND align clock ................ reading 0.5625  fold 0.5625  → EQUAL
```

So the divergence is **exactly (γ, clock)**:

1. **γ** — `0.7` (reader) vs `0.8` (integral). One decay constant must win.
2. **clock** — the reader's prior excludes the cursor line (`at−1−sentIdx`); the
   integral includes it (`t−e.t`). A one-step offset. The integral read at `t := at−1`
   (the reader's clock) closes it for any γ.

A third axis is structural, not a kernel bug: the reader holds **presence** (who acts
next) while the integral holds **descriptors** (what is established about each referent),
with voids held apart. That is the view P4 itself reconciles — read the dossier off the
reader's state — and it only becomes sound once axes 1–2 are reconciled first.

**VERDICT: P4 is unsound as written.** Reconcile γ and the decay clock before any
collapse. Once reconciled, the standing readout is byte-identical, so the collapse *is*
sound after the reconciliation. This is the measurement coming back negative, exactly as
P0 anticipates.

### P0.2 — does the frontier predictor carry a move? **Yes on recency; dead on entity.**

§2: "generation = read past the frontier," and §9: the loop "only walks if the frontier
predictor carries a move." The measurement reads one index past the last unit (over a
sentinel, so the prior is every real unit) and asks two things: is the prediction *flat*
(all mass on the unseen reserve), and does it carry a *move* (a proposition `p:` or
predicate `d:` atom, not only a figure `f:`)?

```
metamorphosis.txt, frontier at index 40:
  recency:  reserve 0.142  →  Grete, Gregor Samsa;  p:grete|grown|woman, p:gregor-samsa|retreated|room   ⇒ PASS
  entity:   reserve 1.000  →  (nothing)                                                                  ⇒ FAIL
esker.txt, frontier at index 32:
  recency:  reserve 0.094  →  Felix, Liesl, Esker;  p:felix|kept|house, p:liesl|took|room                ⇒ PASS
  entity:   reserve 1.000  →  (nothing)                                                                  ⇒ FAIL
```

- **Recency PASS.** The core claim of §2 holds: at the frontier the prior is alive and
  carries a move. `realize()` has a *what*, not only a *who*. Generation has something
  to read off.
- **Entity FAIL — and this is the actionable part.** The §2 loop *literally specifies*
  `{ horizon: 'entity' }`. But the entity horizon seeds its actor-set from events **at
  the cursor line** (`reading.js:68-76`), and at the frontier the cursor line is the
  not-yet-generated one — so the seed is empty and the prior is filtered to nothing.

**VERDICT: P3 is licensed, but the horizon in §2's loop must be fixed first.** Re-seed
the frontier's entity horizon from the DEF target / the recency top figures (§6, "read
toward the referent under DEF") — which the recency prior already carries live — rather
than the empty current line. Do this before P3.

## The gate status, by phase

- **P0 — measure two things.** ✅ Done (this document, the two scripts, the test).
- **P1 — one line, one log, with provenance** (`src/perceiver/parse/pipeline.js`).
  *Not blocked by P0.* The provenance type already exists
  (`src/core/provenance.js`: `EXAFFERENCE`/`REAFFERENCE`, `canWitness`, `classify`); the
  work is to tag each appended unit and carry `prov` on `readingAt` events. Document-only
  line stays byte-identical with the flag off.
- **P2 — the unified `step`** (`§3`). Builds on P1; not blocked by P0.
- **P3 — generation as reading past the frontier** (`§2`). **Licensed by P0.2**, with the
  precondition: re-seed the frontier's entity horizon (above) before the loop is built,
  or run it on the recency horizon that already carries a move.
- **P4 — collapse the folds** (`§4`). **Blocked by P0.1** until γ and the decay clock are
  reconciled. The reconciliation target is proven exact: unify γ, align the integral's
  clock to the reader's (`t := at−1`), and the standing readout collapses byte-identically.

## Acceptance (the spec's own bar)

> One cursor, one line, one fold, one forward model. Reading is the exafferent branch of
> one step; generation is the reafferent branch plus a forward `realize`. The
> document-only case and the no-answer case are byte-identical with the flag off.
> Suppress-never-erase holds because the line is append-only and nothing unwrites. A
> factual claim in an emitted unit grounds only against exafferent units, because the
> source veto is now the reader checking a reafferent unit against the sensed prior, and
> the type law falls out of `prov`.

P0 establishes the two preconditions that bar shipping that acceptance today: the folds
are not yet one (reconcile γ + clock), and the frontier horizon the loop names is dead as
seeded (re-seed it). Both are small, both are measured, and both come before a line of
P3/P4 is written — which is the discipline the spec asks for.
