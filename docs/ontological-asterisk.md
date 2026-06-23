# The ontological asterisk — identity held open as a question

> The fact-checker makes the talker faithful to the graph (`edge-grounding.md` §10),
> so the graph had better be honest about what it knows. It already carries a VOID as
> a first-class event — it is honest about *absence*. It was not yet honest about
> *identity*. The asterisk is the missing object.

## The diagnosis

`projectGraph` has one identity primitive and it is binary. `find()`
(`src/core/project.js`) puts two ids in the same cluster or it does not, and a
`SYN kind:'merge'` collapses them at projection time — `parent.set(find(from), find(to))`
— with no record that the collapse was earned, attested, or merely guessed. There is
no object for the state a reader is in most of the time: *these two names look like one
person and nothing has established that they are.*

The cross-source binder made it worse. `proposeCrossDocSyn`
(`src/organs/in/composite.js`) took **the same admitted label in two documents** and
emitted a hard `SYN kind:'merge'`. So when two distinct "Tom Turner" clusters exist,
the graph that was right to keep them namespaced apart was overruled by surface-string
echo — the conflation the namespacing exists to refuse. The binder rewarded verbatim
label match over relational correspondence, and it only knew how to *merge*: it could
never produce the **split** that two same-named-but-distinct people require.

## What the asterisk is

It is the Pattern marker `*` applied to identity. A resolved individual is a Figure,
`tom-turner.1`. A name shared across sources with no licensing edge between them is not
a Figure — it is `tom-turner*`, the relational space across instances bearing that
label, identity **unestablished**. Disambiguation is the move from `*` toward Figure,
and it has **two** legal outcomes: resolve to one Figure (merge earned) or fork into
two (split earned). Both are resolutions; the absence of either is a third, honest
state the web cannot represent — *no source establishes whether these are the same
person.*

The asterisk earns its place from the provenance split the engine already runs
(`src/core/provenance.js`):

- **Within a source, coreference is EXAFFERENCE.** The author wrote "Tom Turner", then
  "he", then "the chief executive" — the author asserts one referent. That binding is
  attested and enters `find()` exactly as it does today. **`find()` is not touched.**
- **Across two unlinked sources, coreference is REAFFERENCE.** The *reader* is
  proposing the two are one. A REAFFERENCE identity claim must never enter union-find
  as a hard union. It enters as a held `SYN kind:'same_as?'`, and the type law itself
  (`canWitness`) bars the reader's own proposal from witnessing the merge it asks for.

## The loop: DEF · EVA · REC on identity

This is the significance triad (`docs/significance-loop.md`) pointed at identity instead
of at a fact, and it lives in `src/core/asterisk.js`.

- **DEF** sets the terms: *what would make these two clusters the same person.* Not the
  name — the name is the thing in question and cannot also be the evidence. The terms
  are **discriminators** that travel with a person: employer, geography, tenure, a
  co-attesting third source, a spouse, a role one holds and the other cannot.
- **EVA** tests the two clusters against the terms (`evaluateSameAs`). Each shared
  discriminator is a `CON` edge; the merge is licensed by **convergence** of CON edges
  (`discriminatorIndex`), never by the label, which is excluded. Conflicting
  discriminators — a *functional* relation (employer, spouse) filled by disjoint
  targets — are positive evidence of **two** people, not merely the absence of evidence
  for one.
- **REC** restructures on the outcome, at projection time:
  - **convergence** → collapse `*` to one Figure (`parent` is unioned), recorded in
    `graph.idMerges` with the discriminators that licensed it — auditable.
  - **conflict** → fork `*` into two Figures, recorded in `graph.splits`. Not folded
    even speculatively: the split is confirmed.
  - **neither** → do nothing. The asterisk stays in `graph.sameAs`, and the **identity
    void** stands as a finding in `graph.voids` — node-anchored to both roots, reusing
    the first-class absence primitive, no new machinery.

`representative()` stays binary by default — `representative(id)` returns the firm
cluster as today. `representative(id, { speculative:true })` additionally folds the
**open** candidates, for display only, never for storage. The firm graph is unchanged;
the asterisk lives beside it.

## Measure before building

Directive #1 was to count the latent population before writing a line of mechanism.
`latentAsterisks(log)` is the read-only pass; `scripts/asterisk-measure.mjs` runs it
over a master log built from the corpus (the Metamorphosis cut into six pages, each a
source, plus the two stories in `data/` — "four pages over two weeks"):

```
$ node scripts/asterisk-measure.mjs
sources:            8
INS events:         414
LATENT ASTERISKS:   9   (names borne by ≥2 ids the firm union-find leaves apart)
  ↳ candidate pairs: 15
```

`Gregor*` ×5, `Mr Samsa*` ×4, `Grete*` ×3 — the protagonist and his family, named
across pages and held apart by accidental separation. The number is real, so the build
rests on a finding, not a hunch. `ASTERISK_DEBUG=1` prints the per-name groups.

## What ships, and behind what flag

Everything is gated by `RULES_REV` (the same revision flag the rest of the system ships
experiments behind) and defaults **OFF**. With it off, `proposeCrossDocSyn` emits the
legacy `kind:'merge'` and the projection is byte-identical — the 700-test golden suite
is untouched. With it on (`RULES_REV=1`, or `createCompositeDoc(docs, { heldIdentity:true })`):

| Piece | Where | Note |
|---|---|---|
| held relation | `composite.js` → `SYN kind:'same_as?'` | REAFFERENCE; never a union |
| side structure | `project.js` `sameAsRaw` | read beside `parent`, not into it |
| earned merge / split | `asterisk.js` `evaluateSameAs` | `same_as_min_convergence` in `DEFAULT_PROJECTION_RULES` |
| identity void | `project.js` → `graph.voids` | the reused absence primitive |
| speculative rep | `project.js` `representative(id,{speculative})` | display-only fold |
| the frontier | `asterisk.js` `identityFrontier` | `kind:'identity'`, scored by expected surprise |
| the paint | `ui/graph-view.js` | dotted ring, `label*`, "identity unestablished" |

## Bounds

A discriminator the frame cannot type (an employer relation outside the relation
ontology) is invisible to the conflict test unless declared in
`rules.same_as_functional_vias`; two people who share *every* attested discriminator are
outside what a relational test can split; and the asterisk only forms where two sources
use the **same** norm2 label — "Gregor" and "Gregor Samsa" across sources are distinct
norm2 forms and distinct asterisks, exactly as the surface measure intends. The fix
raises the floor on a confident false merge and gives the reader a third thing to say —
`tom-turner*`, two candidates, identity unestablished, here is what would settle it. It
does not claim to resolve identity in general.
