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

## The neighbors — which standard owns which corner

A nanopub *bundles* four concerns: a **minimal assertion unit**, **provenance**, **publication /
attribution metadata**, and **content-addressed immutable identity**. That bundling is its
appeal and its limit. "Things like nanopub" are standards that nail one or more of those
corners — often *better* than nanopub does, because they were built for that corner alone.

So the real move is not finding a single replacement. It is knowing **which neighbor owns
which corner**, so the stack can be assembled from best-in-class rather than adopting one
monolith. Every one below formalizes something already hand-built here; none forces the
system off its event-sourced spine.

### The ones to actually look at

- **C2PA / Content Credentials — owns the *output* corner.** The industry standard for
  content provenance: a cryptographically signed manifest binding assertions (source,
  author, tool, edit history) to a media artifact, tamper-evident, designed against
  deepfakes. The publish organ — the pdf-lib plan that embeds the source WARC, passage
  hashes and the EVA chain into the artifact's own metadata
  (`src/organs/out/publish/pdf.js`) — is a **bespoke C2PA**. C2PA has real adoption (camera
  makers, Adobe, major platforms), so an NPJ receipt card or PDF carrying a C2PA manifest is
  verifiable by tools readers may already have. **Highest priority on the output side.**

- **Robust Links + Memento (RFC 7089) — owns the *citation* corner.** This is *exactly* the
  claim-to-archived-passage citation, already standardized for scholarship and journalism.
  Robust Links bundle original URL + archived snapshot + version datetime so a citation
  survives link rot; Memento is the protocol for "this URL as of datetime T," which
  archive.org already speaks. Composes directly with the WARC chain (`src/organs/in/warc.js`,
  where the record is already the frozen, dated, hashable source). **Cheap to adopt, high
  fit — highest priority on the citation side.**

- **Verifiable Credentials + DIDs (W3C) — the living signed-attestation cousin.** From the
  identity world rather than the scientific-assertion world: a VC is "issuer asserts claims
  about a subject, signed, independently verifiable." Model a journalistic claim as
  *issuer = NPJ, subject = the civic entity, claim = the assertion, evidence = the archived
  passage*. Strong on **attributable signed claims**; weaker on "smallest node in a global
  graph." Pairs with DIDs for portable outlet identity.

- **Transparency logs (Certificate Transparency / Sigstore's Rekor / Merkle discipline) —
  owns the *immutability* corner as proof, not promise.** These formalize what the
  append-only event log currently holds only by *convention*. A Merkle-hash-chained log with
  inclusion and consistency proofs turns "we didn't rewrite history" into a **proof**. Rekor
  is an append-only log for signed attestations with inclusion proofs — "prove this claim
  existed and was signed at time T." Worth adopting the **discipline** (Merkle chaining over
  the event log) even without the infrastructure.

- **IPLD / CID + Hashlink — Trusty URIs, generalized.** CIDs are self-describing content
  hashes over Merkle DAGs; Hashlink (W3C-CCG) embeds an integrity hash into any URL. The
  IPFS *network* is not required to use the *addressing*. This is the principled version of
  the passage-hashing in `src/ingest/websource.js` (`webContentHash`) — a self-describing
  hash rather than a bespoke `fnv:` prefix.

- **Micropublications (Clark / Ciccarese) — the argument-structure cousin.** Built for
  *claim + evidence + support/challenge chains* rather than a flat assertion. An
  investigative claim *is* an argument with evidence and rebuttals, and span-level reader
  edits already arrive as EVA events — so micropublications may model the **contribution
  graph** better than flat nanopubs. Underused, but conceptually closest to the shape here.

### Adjacent — know they exist

- **PROV-O** — used regardless; entity / activity / agent is the semantic backbone for how a
  claim derives from a source. EO derivation events map onto PROV activities (already flagged
  as vocabulary work above).
- **RDF-star / RDF 1.2** — statement-level provenance without heavy reification; in draft,
  and Oxigraph has preliminary support — relevant to decision (2)'s projection.
- **Web Annotation (W3C)** — "this comment targets that passage span" is *literally* the EVA
  target model (`src/organs/in/document.js` spans as annotation targets).

Three architectural cousins to the Matrix/event-sourcing choice, noted **for comparison, not
adoption**: **Nostr** (every event signed + hashed + typed — structurally near-identical to
EO events), **AT Protocol** (signed, content-addressed record repos as Merkle trees with
portable identity), and **Solid** (user-owned RDF pods — the "sources as first-class
linked-data nodes" vision).

### The two highest-leverage adoptions, for where the system actually is

**C2PA on the publish side, Robust Links + Memento on the citation side.** Both formalize
things already hand-built (the embedded-provenance artifact; the archived-passage citation),
both have ecosystems, and neither forces the system off its event-sourced spine. Everything
else on this list is a corner to reach for deliberately once those two are in place — the
same unbundling discipline this note opened with: adopt by corner, not by monolith.

### These are toggles, not a fork

Each standard is a **capability toggle**, one per corner, **all OFF by default**
(`src/organs/out/publish/standards.js`, `PROVENANCE_STANDARDS`). This is the repo's opt-in
discipline (the `RULES_REV` pattern, `src/organs/out/speech`): with every flag off, the
emitters produce exactly what they produce today — the bespoke provenance already hand-built
— so the default path stays **byte-identical**. Adopting a standard is flipping its flag, not
maintaining a fork.

Resolution is *default ← env var ← per-call override*, so a corner can be switched on for one
publish (`provenanceFlags({ c2pa: true })`) or globally (`EO_PROV_C2PA=on`). Each registry
entry carries an honest `status` (`planned` / `partial` / `wired`), so a flag flipped on while
still `planned` reads as a **request for that work**, not a silent no-op — the flag is the
seam the standard lands behind, adopted corner by corner as each is actually built.
