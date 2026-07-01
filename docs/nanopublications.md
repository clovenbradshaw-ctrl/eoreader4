# Nanopublications — the claim model you already hand-rolled

> A nanopublication is the smallest content-addressed unit of *assertion + provenance +
> publication-info*, carried as three named graphs tied by a head graph and named by a
> Trusty URI whose hash lives in the identifier itself. That is — almost exactly — the
> shape the ingestion organs already reach for: an EVA event pointing at an archived
> passage, a WARC record hashed into its own id, a receipt card that states a claim and
> carries its provenance. We have hand-rolled ~80% of a decade-old spec by convention.

This note is a **bet, unbundled**. Adopting nanopublications is not one decision; it is
three, with very different cost and value, and they should not be committed to as a
bundle. Two are worth taking locally now; one is worth deferring with eyes open.

The reason this is worth writing down rather than the VSA bet (`docs/…` — a nominal fit,
operator names rhyming with op names) is that this fit is **semantic**, not nominal. A
nanopub *is* the claim model. The standard formalizes precisely what
`src/organs/in/warc.js` (the frozen, hashable source), `src/organs/in/document.js` (the
`[charStart,charEnd)` passage span an EVA event points at), and `src/organs/out/publish/`
(the pdf-lib plan that embeds the source WARC + passage hashes, the Satori receipt card)
already build by hand. The strongest argument for adopting the standard is that we are
otherwise reinventing one that has an existing network, signing infrastructure, and
FAIR-commons legitimacy — which is, incidentally, the exact vocabulary a "commons
infrastructure" framing already wants.

## The three decisions, unbundled

### 1. The nanopub data model + Trusty URIs — take this outright

It formalizes what we built by convention, and it *composes* with our addressing rather
than competing with it.

- A nanopub is TriG — four named graphs, i.e. quads — which Oxigraph (and any RDF quad
  store) represents natively.
- Trusty URIs nest cleanly under our existing content addressing. **Two layers, cleanly
  nested:** the *provenance* graph references our WARC / passage hash as the source
  (`src/ingest/websource.js` `webContentHash`, the `sourceId` minted in
  `readWarc`); the *Trusty URI* hashes the nanopub as a whole. The inner hash pins *what
  was seen*; the outer hash pins *the assertion made about it*. Neither displaces the
  other.
- The head graph tying assertion → provenance → publication-info is the same move our
  publish plan already makes when it staples the EVA chain and passage hashes to an
  artifact (`src/organs/out/publish/pdf.js`, `pdfPlan`).

This decision is low-cost and high-legitimacy: it renames our conventions into an
interoperable standard without changing the system-of-record.

### 2. Oxigraph as a query view — yes, but know exactly what it is

The JS/WASM Oxigraph build is a **simple in-memory store** with SPARQL 1.1 Query and
Update. The RocksDB persistent backend is disabled when compiling to WASM, leaving only
the in-memory fallback. So it is **not a store — it is a SPARQL index** you rebuild by
projecting the EO event log into quads, then dump/reload through OPFS.

Do not fight that; it is exactly the **"OPFS as materialized view"** shape already in
use. The discipline that keeps the system honest:

- **The event log stays system-of-record.** Oxigraph is a *derived read-model* — a
  projection of the append-only log, the same way `projectGraph` is a fold of the log
  (`src/core/project.js`). The moment the triple store is treated as primary, the
  append-only provenance — the entire point of the system — is lost.
- **Rebuild, don't mutate.** Project log → quads → load; snapshot via OPFS; reload on
  cold start. SPARQL Update is for shaping the view, not for authoring truth.

Flags to hold in view, not showstoppers:

- **Memory-bound.** Large in-memory datasets can hit a maximum-memory-size ceiling. The
  projection is a windowed/scoped view, not the whole corpus at once.
- **JS binding is self-described work-in-progress.** Pin a version; treat API drift as
  expected.
- **OPFS sync-access-handle persistence wants COOP/COEP headers.** Check this against the
  hosting (`docs/internet-native.md` is where the hosting stance lives) — the same
  cross-origin-isolation requirement the WASM ML runtime already needs, so it may be
  paid for already.

### 3. Publishing into the actual nanopub network — defer, decide deliberately

Signing keys, a registry, federation. The upside is real: permanence, discoverability,
joining a genuine knowledge graph. But nanopubs are **immutable and non-repudiable by
design**, and that cuts hard for an investigative beat.

- You "retract" by publishing a *superseding* nanopub, but the original **persists
  forever**, cryptographically attributed to the signer.
- Broadcasting signed assertions **about named living people** into a permanent federated
  graph has a retraction profile that is double-edged: the correction is discoverable, and
  so, permanently, is the error.

Adopt (1) + (2) locally now. Treat (3) as a later, eyes-open step, gated on an explicit
editorial decision about what may be signed and published — not a technical default that
slips in with the library.

## The one genuine modeling tax

Nanopub wants the assertion graph to be a **tiny, crisp** RDF graph. The split this forces
is worth naming up front, because it decides what the query topology actually covers.

- **Hard facts reduce beautifully.** *"board member X → donated \$Y → PAC Z, on date D"*
  is native triples. Multi-hop *"which board member connects to which PAC through which
  document"* is exactly what SPARQL is good at — and exactly the NDP-investigation shape.
  These become **real, queryable assertions**.
- **Interpretive claims do not reduce cleanly.** *"the timing suggests coordination"* does
  not become clean triples without either losing the hedge or stuffing prose into a
  literal that is opaque to SPARQL. These stay as **provenance-bearing literals** — first
  class as *claims*, but not part of the queryable skeleton.

So expect a **hybrid**: factual triples as queryable assertions, narrative claims as
provenance-bearing literals. **The queryable topology is the factual skeleton, not the
whole newsroom.** That is a feature — it keeps the graph honest about which relationships
are asserted facts and which are editorial reading — provided it is stated, not
discovered.

And budget for **vocabulary work**: PROV-O (which nanopubs already use), an EO-operator
vocab (INS / CON / SIG / SYN / DEF as RDF terms, so the event log projects into named
predicates rather than opaque ids), and civic-domain terms (donations, filings, bodies,
offices). That is real labor — a sustained mapping effort, not a few lines.

## Verdict

Of the adoption bets floated, **this is the one to build** — provided the two invariants
hold:

1. **Oxigraph stays a projection.** The EO event log is system-of-record; the triple
   store is a rebuildable read-model. Never the reverse.
2. **The network stays optional.** The local data model + Trusty URIs + SPARQL view are
   adopted now; federated publishing is a separate, deliberate, editorially-gated step.

Take (1) and (2); defer (3). The fit is semantic, the spec is a decade old with a real
commons behind it, and most of the work is already done by hand — the remaining tax is
vocabulary and the discipline of keeping the projection derived.
