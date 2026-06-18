# Proposition addressing — the logged argument-span SEG

> Extract the proposition and its elements; embed the whole proposition once for
> its phasepost; then position the elements into Ground, Figure, Pattern. Three
> steps. This doc is the parse-time half — steps A (extract + log) and C
> (structural positioning) — built to run today without the meaning reader.

## Two senses of span

The word *span* names two different things, and keeping them apart is the
precondition for finding the parse in the log.

| | Retrieval span | Argument span |
|---|---|---|
| What | a whole sentence pulled by the retriever | the subject- or object-stretch inside a clause |
| When | question time | parse time |
| Direction | downstream (lookup) | upstream (feeds the structure) |
| In the log | `spans retrieved · s40 s57 s82` | a `SEG kind:'argspan'` event |

The log used to show retrieval spans and CON edges with **nothing in between** —
the emitter computed the argument spans internally and threw them away, emitting
only the bond. That gap is what this closes.

## The witness chain

```
raw text ──[sentence cut]──▶ sentence (sentIdx)
                                  │
                                  ├─[argument-span cut]──▶ SEG kind:'argspan'   ← new
                                  │     subject "Inspector Reed" [0,14) → inspector-reed
                                  │     verb    "questioned"     [15,25)
                                  │     object  "Mara Voss"      [26,35) → mara-voss
                                  │
                                  └──────────────────────▶ CON inspector-reed
                                        { …, argspan: <seg.seq> }   --questioned--> mara-voss
```

Each event references the one below it, so a **CON edge walks back** through the
argument spans, to the clause, to the verbatim text its endpoints were read from.
`argumentSpansHold(seg, sentence)` proves the walk: every recorded span still
slices to its stored text. Before this, the walk stopped at the CON.

The argument-span SEG is a **reading, not a fact** (the same move as putting the
raw import in the log). The clause has no true subject-span in the world; it has
the verbatim text (Given) and the spans a reader cut from it (Meant). So the event
is tagged a perception — `reader` is the extractor that produced it, `sentIdx` is
the cursor, `confidence` is the extractor's — defeasible and re-perceivable.

## The order: proposition, then phasepost, then positioning

- **Step A — extract + log.** The SVO parse (`relations.js`) reads subject, verb,
  object with offsets; the pipeline writes the `SEG kind:'argspan'` *before* the
  bond and stamps the bond with the SEG's seq. (This doc's primary deliverable.)
- **Step B — phasepost.** The whole proposition is embedded once and scored
  against the three grain bands for its three cells. Unchanged; it lives in
  `classify/` and holds at no-commit until MiniLM is live.
- **Step C — element positioning.** `positionElements(args)` assigns the elements
  to Ground / Figure / Pattern **structurally**: subject and object are the
  grounded existents (Ground), the verb is the act foregrounded (Figure), the
  S-V-O relation is the bond (Pattern). The **cell** within each position is named
  by geometry (centroid argmax in the band) — meaning-only, held at no-commit
  today.

## The discipline — position is structure, cell is measurement

> Structure (and, when present, the tagger's labels) **assign** the position.
> Geometry only **names** the cell and breaks ties. Geometry never reassigns a
> position that the grammar set.

If the grammar says the verb is the figure, the embedder names *which* figure; it
does not decide the verb is the ground because it scored higher there.
`positionElements` cannot cross the lane — it contains no geometry to overrule the
grammar; it delivers the positions filled by elements and leaves every cell
`null`. Under a dark embedder the layer therefore still delivers the three
positions and the spans logged and walkable, holding the cells at no-commit. The
structural and logging half is payable today.

## Honest seams

- **The accurate span-tagging layer is research-gated.** The spec's redundancy
  principle wants a second, accurate extractor (a GLiNER-style span tagger)
  correcting the cheap regex sweep, with the fold discounting votes that share
  evidence. eoreader4 ships **only the cheap layer** (`reader: 'svo-regex'`,
  confidence 0.6): a browser-runnable tagger is a thin, shifting niche to be
  searched, tested (try the zero-shot GLiNER on the loaded stack first), and
  size/latency-measured on the lowest target device **before committing**. Until
  then there is one witness, and the correlated-vote discount has nothing to
  discount — building a fake second layer would be dishonest.
- **Cell-naming needs the meaning reader.** Every cell is a cosine in MiniLM
  space; under the hash organ it is no-commit. The positioning and the logging run
  without it.
- **Scope: SVO bonds.** The argument-span SEG is emitted for the subject-verb-object
  bonds (CON / SIG) — the shape the spec is about. A copular DEF is node-shaped
  (subject + predicate, not S-V-O) and keeps its property line; a kinship
  apposition bond is a different cut and is left as a bare CON. Widening the cut is
  future work, not a silent over-claim.
- **The Pattern-cell embedding grain** (the verb in its arguments vs. the whole
  S-V-O) is the open construction-grain question from the phasepost spec; the
  unit-is-the-proposition principle pushes toward the relation in context. Verify
  against the centroid exemplars when the reader is live.
