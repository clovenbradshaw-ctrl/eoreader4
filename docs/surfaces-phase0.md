# Surfaces · Dials · Holons — Phase 0

> "no step is built before a cheap read-only measurement on a corpus you can verify
> by hand has shown the step is real. The construction earned a correction last round
> because it skipped the measurement. This spec does not."

This is that measurement. It builds nothing and stores nothing; it folds the existing
corpus into one master log, projects the graph the system already projects, and reports
the four numbers the spec's Phase 0 gate asks for. `scripts/surfaces-measure.mjs` is the
runnable read-only pass; `tests/surfaces-phase0.test.js` pins the hermetic findings as
regression locks, in the spirit of `tests/one-cursor-p0.test.js`.

## The spec is written against eoreader3; the names map onto eoreader4

The integration spec names `content.js`, `profile.js`, `buildMaster`, `buildIndices`,
`neighborsOf`, `annotate`. eoreader4 cut that monolith into holons (`docs/holons.md`).
The mapping the rest of this work assumes:

| Spec (eoreader3) | eoreader4 |
|---|---|
| `projectGraph`, `find()`, `representative` | `src/core/project.js` |
| `buildMaster` (master log across sources) | `createCompositeDoc` — `src/organs/in/composite.js` |
| `graph.voids`, the void primitive | `project.js` `voids` (carved + identity) |
| `relType` (closed type) vs `via` (surface verb) | `typeOf(via).type` — `src/core/relation-types.js` |
| `bandOf`, `BAND_NAME` (Lens split) | `bandOf`, `BANDS` — `src/classify/bands.js` |
| the nine surfaces | the nine **TERRAINS** — `src/core/cube.js` |
| the holon containment chain | `src/core/holon.js` (path/nest) |
| the asterisk (`same_as?`, speculative `representative`) | **already shipped** — `project.js` + `src/core/asterisk.js` |

The nine surfaces are not new geometry. They are the cube's nine terrains, already
defined: Existence{**Void**, **Entity**, **Kind**} · Structure{**Field**, **Link**,
**Network**} · Interpretation{**Atmosphere**, **Lens**, **Paradigm**}. "The Ground row"
is the Ground column (Void/Field/Atmosphere); "the Significance corner" is Paradigm
(Interpretation × Pattern). Phase 4 — the asterisk — is **already in the tree**, so this
measurement also tells the still-unbuilt phases (the pivot/dials, the holon-lattice)
what they have to stand on.

## What was measured

Corpus: the same "four pages over two weeks" `asterisk-measure.mjs` uses — the
*Metamorphosis* body cut into six contiguous pages, plus the two `data/` short stories;
eight sources. Projected at the whole-document cursor (no γ-fade), referents namespaced
apart (`crossDocSyn` off) for the raw vocabulary, and folded (`heldIdentity` on) for the
identity-void census.

### §1 — edge vocabulary (`relType` / `via` / `kind`)

```
kind:      con 412 · sig 11
relType:   12/423 edges typed (2.8%); 411 untyped — parent:8  sibling:4
via:       255 distinct surface verbs; top → all, no, he, became, sat, tried, wanted…
SYN kinds: merge 5 · alias 2 · same_as? 17
channels:  24 negated · 46 hedged edges
```

**The relType channel is nearly empty — 2.8% of edges type to a primitive.** The closed
relation algebra (`relation-types.js`) was built for kinship/social/spatial nouns; a
narrative produces overwhelmingly open verbs (`became`, `sat`, `tried`) the algebra
leaves untyped, by design. Any surface that leans on `relType` (Kind's cluster centres,
Link's relType-group filter) has a sparse signal here; the polarity/modality channels
(24 negated, 46 hedged) are comparatively rich and are already carried through the
projection verbatim.

### §2 — voids

```
total: 34 — all same_as? (identity); 0 carved
```

**The only voids this corpus carves are identity voids** — the open `same_as?`
candidates the asterisk holds. There are no explicit `A -> [void] : rel` absences in the
text. So the Void surface and Paradigm (the "void shape across the corpus") render, on
this corpus, the asterisk's held identities and nothing else.

### §3 — latent asterisks

```
firm: 9 (15 candidate pairs)   +speculative: 9
```

Real and matching `asterisk-measure.mjs`: nine names borne by ≥2 ids the firm union-find
leaves apart. Phase 4 was right to build; it has shipped.

### §4 — the falsification: tree or lattice?

The spec's holon-lattice (Phase 3) hinges on one falsifiable claim — that containment
edges **split four ways** (membership / condition / grounding / aboutness) and that a
node has **several parents**, so a geodesic through a lattice is the right object. The
rider: *"If most nodes turn out to have one parent the lattice was a tree and the
original nest was closer to true, and you build the simpler thing."* Measured on both the
raw graph and the held graph (cross-source identities folded — the lattice's best case,
since only a merge can give a referent parents from two contexts):

```
containment edges: 8 (of 423)        by class: membership:8 · condition:0 · grounding:0 · aboutness:0
classes present:   1 → UNIFORM       by primitive: parent:8
contained nodes:   5;  with ≥2 parents: 0 (0.0%)     parents/node: 1p×5
```

**Verdict: TREE, single-class.** Containment is uniformly `membership` (the Samsa family
`parent` edges); the four-way split does not appear; **every contained node has exactly
one parent, even after folding.** The deeper reason is in the ontology, not the corpus:
`relation-types.js` has **no primitive for grounding or aboutness** — two of the four
bins have nothing to hold and cannot, until a primitive is added (pinned in `P0.A`).

## The gate verdicts, per phase

- **Phase 0 — done.** Numbers above; locks in `tests/surfaces-phase0.test.js`.
- **Phase 1 (pivot + Link) — green to build,** but read it as a renderer over the nine
  cube terrains (`cube.js`), not a new store. Link leans on `relType` groups, which §1
  shows are sparse on narrative — drive it off `via` + polarity/modality, with `relType`
  as a bonus when present.
- **Phase 2 (Network, Kind, Lens) — green,** with the §1 caveat for Kind (relType-thin).
  Lens's `bandOf` already exists (`classify/bands.js`).
- **Phase 3 (holon-lattice) — STOP. The measurement came back negative.** Do not build
  `projectContainment` / `projectHolonPath`; the containment is a single-parent,
  single-class tree, and the existing nest (`core/holon.js`) is that tree, unfalsified.
  Re-open only when `P0.A`/`P0.B` trip — the ontology grows a grounding/aboutness
  primitive, or the address model gains a second parent.
- **Phase 4 (asterisk) — shipped** (`project.js`, `asterisk.js`).
- **Phase 5 (Field, Atmosphere, Paradigm) — sparsest, as the spec predicted.** §2 shows
  the only voids are identity voids, so Paradigm's "void shape" is, here, the asterisk's.

## Reproduce

```
node scripts/surfaces-measure.mjs              # the headline numbers
SURFACES_DEBUG=1 node scripts/surfaces-measure.mjs   # + per-value listings
node --test tests/surfaces-phase0.test.js      # the hermetic locks
```
