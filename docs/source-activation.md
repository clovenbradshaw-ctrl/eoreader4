# Sources as activated things — one ingestion, kept provenance, measured salience

> A source is not a container the answer is poured from. It is itself a thing the reader
> attends to, with an activation that rises and falls — so that across a growing universe of
> sources the machine can judge which ones matter *for this question* and let their findings
> be heard, instead of the loudest source drowning the rest.

This is the sourcing counterpart to the surfer (`docs/bayesian-surprise.md`,
`docs/surfing-next.md`). The surfer gives *figures* an activation and rides the surprise
gradient to the one the reading is about. The same move, one level up: give *sources* an
activation and let retrieval ride it, so the source a question is about is the one the reader
reads from.

## The defect this answers

The audits showed a loaded document (Kafka's *Metamorphosis*, 884 sentences) and four
freshly-fetched web pages folded into one composite scope. Asked "what movies have been made
based on this?", the answer was confabulated from the book's prose — **every retrieved span
was a `pg5200.txt` sentence; not one web span surfaced**, even though the pages fetched to
answer the question were sitting in scope. The findings the search brought back never reached
the talker.

The mechanism: `retrieveHybrid` ranks every unit in the composite by a flat global score and
keeps the top-k. A long local document out-scores four short web pages span-for-span, so the
web pages are buried before `selectExcerpts` ever sees them. The scope contained the answer;
the reader's attention never reached it.

## The principle: a source has activation

A source's **activation for a query** is the strength of its strongest evidence — its best
span's fused retrieval score. A source is *activated* when that clears a floor: it has
something genuinely relevant to say, not merely a presence in scope. Activation is per-query
and transient, exactly like a figure's surprise — a source loud for one question is silent for
the next.

Retrieval then **reserves** representation for activated sources rather than ranking flat:
every activated salient source is guaranteed its single best span in the excerpts, evicting
the weakest non-salient span, capped so the loaded document is never fully displaced. The
search's findings are heard; an irrelevant fetched page (below the floor) claims nothing.

## What is built (stage 1)

`src/retrieve/hybrid.js` — `reserveBySource(spans, originOf, isSalient, { k, activationFloor,
maxReserve })`. Pure and embedder-free: given the composite's `origin(idx)` back-map and a
salience predicate, it computes each salient source's activation (best span) and reserves a
slot for each activated one, capped at `ceil(k/2)`. Returns the plain global top-k unchanged
when no salient source is activated, so a single-source retrieve is byte-identical.

Wired in `src/turn/stages.js` `retrieve`: it retrieves a wider pool, then applies
`reserveBySource` **only when the composite holds a web source** (`doc.web` /
`sourceKind:'web-source'`). A single document, or a document-only composite, takes the plain
top-6 exactly as before — the change is dark on every turn that has no fetched source to
surface. Verified in `tests/source-activation.test.js` (the buried-web-page case, the
below-floor case, the no-salient-source identity, the displacement cap).

Because the reserved web spans now enter the span set, they also flow into the fold and (when
the reading concentrates) the meaning graph — the search's findings reach the talker through
the same channels every other source does.

## The wider architecture this sits in

Stage 1 makes a salient source *heard*. The rest of the vision, in the system's own
vocabulary:

- **One ingestion, kept provenance.** A web page and an uploaded file should run the SAME
  parse and land in ONE content log, each carrying its provenance (`docId`, url, fetched-at,
  content hash). The admission core already parses a web source through `parseText` like any
  document (`src/ingest/websource.js`, `docs/web-search.md`), and the composite retains
  per-source provenance (`origin`, `docIds`, namespaced `A␟…` holon addresses). What is
  missing is the single, visible **content log** — every admitted source, upload or web, in
  one provenance-preserving record the user can inspect. (Stage 2.)

- **Sources as a traversable universe.** Once a source carries activation, a *set* of sources
  is a field to surf, not a list to concatenate: the machine attends to the activated few and
  can reach past them to fetch more where the activation is thin. Source activation is the
  unit that makes "a whole universe of things to traverse" tractable — the same active-
  inference move (read where expected information gain is highest) applied to sources. (Stage
  3 — couples to the web-search proposer in `docs/web-search.md`.)

- **Landing on the referent (the cast cycle).** *(Built — `src/converse/cast.js`.)* The fold
  runs a DEF→EVA→REC cycle over the *conversation cast*: **DEF** the referents under discussion
  as a persisted set, **EVA** which one a turn concerns (the live read wins; only a NULL read
  carries forward a settled referent the conversation is still holding, instead of degrading to
  the loudest span), **REC** commit a referent as settled only when the fold *concentrated* on
  it, so a wandering read never poisons the carried state. Threaded through the session like the
  Horizon (`runTurn`'s `cast`, `STATE.cast`); null → byte-identical. The fold audit step reports
  the cast ("the things we're talking about"). Conservative by design — it never overrides a
  resolved live read — and the seam for richer EVA later. See the operator algebra, Interpretation
  column (`docs/operators.md`).

- **Checking the answer in EOT (the edge-grounding gap).** *(Built — `src/factcheck/correspond.js`,
  `src/core/relation-types.js`.)* The factcheck translates the talker's prose to EOT edges and
  compares them against the document graph — but an *equative copula* ("Gregor's sister is Grete")
  flattened to a node-shaped DEF and never became an edge, so a correct, graph-supported kinship
  answer read as unbound. Closed in three parts: `equativeKinEdges` recovers the equative as a
  `CON` edge on the talker-claim side (document parse untouched); `checkRelationAgree` is a
  symbolic kinship-*corroboration* axiom (the algebra fired only for contradictions before) that
  holds under the hash organ; and the earned citation is fed back into the lexical `bind` so
  `unbound-contact` / `low-coverage` actually clear on a witnessed answer.

## Already shipped alongside this

- The web-search query no longer echoes the talker's own prior (possibly hallucinated) answer;
  it anchors on the user's turns and keeps the running subject (`src/turn/web.js`).
- Short utility generations (the search-query call) opt out of the reasoning-token floor
  (`opts.minPredict: 0`), so an auto turn no longer pays a second full-length decode
  (`src/model/pleias.js`, `src/model/onnx.js`).
- The meaning graph is withheld when the fold diffused (`referential.concentrated === false`),
  so a graph read off the wrong figure is never fed (`src/turn/stages.js`).
