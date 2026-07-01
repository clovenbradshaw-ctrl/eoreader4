# amino ⇄ eoreader4 — technology cross-pollination

> Where **amino** (encrypted immigration-law CRM) can adopt tech from
> **[eoreader4](https://github.com/clovenbradshaw-ctrl/eoreader4)** (holonic
> document-chat with local LLMs), and where eoreader4 can adopt tech from amino.
>
> This is an analysis / map, not a change. Nothing here is wired yet. File paths
> are given on both sides so each seam can be picked up independently.

## The one fact that makes all of this cheap

Both apps are the **same machine cut at a different joint**: an append-only log
of the **identical nine operators**, reduced to a graph by a **pure fold**.

| | amino | eoreader4 |
|---|---|---|
| Operators | `src/operators.js` — `OP` (`NUL SIG INS SEG CON SYN DEF EVA REC`) | `src/core/operators.js` — `OPERATORS` (same nine, same modes × domains) |
| Log | Matrix room timeline → `src/store.js` (`EventStore`, OPFS) | `src/core/log.js` (`createLog`, in-memory) |
| Fold | `src/fold.js` — `fold(events)` → `{entities, connections, schema, frames, cursor}` | `src/core/project.js` — `projectGraph(log, frame)` → `{entities, edges, voids}` |
| Memo key | `stateFingerprint` = `cursor:connections.length` | `(log.length, canonicalFrame(frame))` |

The operator tables are byte-for-byte the same lattice (Differentiate/Relate/Generate
× Existence/Structure/Interpretation), with **CON** the central binding bond on both
sides. That means an event produced by one app's log is legible to the other's fold
with only an envelope translation — not a data-model rewrite. Every integration below
rides on that shared spine.

The asymmetry is just as clean:

- **eoreader4 built the reading intelligence** (ingest → retrieve → ground → veto →
  audit, over vendored in-browser LLMs) but keeps its log **ephemeral and single-user**.
- **amino built the durable substrate** (Matrix E2EE rooms, vault-encrypted store,
  outbox, recovery chain, membership-as-access, structured query) but **rents its
  reading engine remotely** — `public/data-chat.js` lazy-loads `EOEngine`/`EOLLM`
  from `https://clovenbradshaw-ctrl.github.io/eoreader3/` (`eoreaderBase()`, line ~1441).

Each has exactly what the other lacks.

---

## Part A — What amino gains from eoreader4

Ranked by value to a law firm handling privileged client data.

### A1. Replace the remote reading engine with eoreader4's local, vendored LLM stack ★ highest value

**Today:** amino's Ask-your-data query layer (`public/data-chat.js`) is pure/local for
structured turns, but its *prose* answers, arithmetic, and fuzzy matching are enhancers
loaded at runtime from a **third-party GitHub Pages origin** (`EOREADER_DEFAULT =
'https://clovenbradshaw-ctrl.github.io/eoreader3/'`), pulling `llm.js` plus CDN scripts
(compromise, mathjs, pyodide). Even though inference runs client-side, the *code that
does it* is fetched from an origin the firm does not control, cannot pin, cannot audit,
and which can change or vanish. For privileged legal data that is an availability and
supply-chain liability.

**Adopt:** eoreader4's `src/model/*` — a swappable, **vendored**, offline-capable backend
registry:
- `src/model/interface.js` — the `createModel(name)` factory + backend contract
  (`{ id, isLoaded, load, phrase, propose? }`).
- `src/model/onnx.js` (transformers.js, WebGPU/WASM), `src/model/webllm.js` (MLC/WebGPU),
  `src/model/wllama.js` (GGUF/WASM) — weights cached to OPFS / Cache Storage, downloaded
  once per profile, then fully offline.
- `src/model/embed.js` (MiniLM) + `src/model/embed-hash.js` (zero-warmup fallback).
- `src/model/stream.js` (`streamPhrase`) + `src/model/prompt.js` (grounded prompt builder).
- The **Pleias** default (`src/model/pleias.js`): the only small-model family trained
  exclusively on public-domain / permissively-licensed text and trained to *cite its
  sources* — a defensible provenance story a law firm can stand behind, and a natural
  fit for a "no figure at a void" answer discipline.

**Seam:** amino already isolates the engine behind `window.EOEngine` / `window.EOEmbed` /
`window.EOCompute` (see `data-chat.js` `ensureEngine()`). Vendoring eoreader4's
`createModel` + `streamPhrase` + embedders to satisfy those three globals *locally* is a
drop-in that deletes the remote dependency without touching the query layer's contract.

### A2. Grounded answers + citation binding + hallucination veto ★

Legal work lives or dies on **defensibility**. eoreader4 turns "the model said X" into
"claim X is bound to source span s3 at score 0.8; uncited claims are flagged, and
answers with no source contact are refused."

**Adopt:** `src/ground/bind.js` (`bindCitations` — IDF-weighted overlap, `MIN_OVERLAP`
gate), `src/ground/veto.js` (`runVetoes`, the `VETOES` battery: empty / declined / echo /
unbound / contradicted), `src/ground/provenance.js` (`classifyProvenance` →
`VERBATIM | GROUNDED | FABRICATED` per proposition), `src/factcheck/*` (edge-grounding).

**Payoff:** every prose answer over case data comes back with a citation trail a paralegal
can click through to the exact record/field it rests on, and confident-but-ungrounded
sentences get flagged instead of shipped. This composes with the `audit` field
`data-chat.js` already returns on `{kind:'answer'}`.

### A3. Auditable per-turn record (chain-of-custody) ★

**Adopt:** `src/audit/*` (`createAuditLog`, schema `eo-audit/1`). Every question over
client data emits one JSON record: route taken, spans retrieved (`idx` + `score`), the
**verbatim prompt**, the **verbatim raw model output**, claims bound, claims vetoed and
why, per-step timings, and superseded drafts (`revisions`) preserved beside the final
answer. One button exports JSONL.

**Payoff:** this is precisely the discovery/defensibility artifact a firm needs — a
reproducible record of *why the system said what it said* about a client's matter. It
slots directly onto amino's existing `EventStore` for durable retention (see B-side).

### A4. Document-ingestion adapters — bring case files into the fold ★

Immigration matters are documents: I-130/I-485 PDFs, scanned court notices, USCIS web
pages, interview recordings, spreadsheets. eoreader4's `src/organs/in/*` adapters each
**ingest an already-extracted structure and emit the same nine operators onto the same
log shape amino already folds**, via one span-assembler (`organs/in/document.js`,
`assembleDocument`) that records every unit's `[charStart,charEnd)` plus page + bounding
box.

**Adopt (in priority order for the domain):**
- `ingestPdf` (pdf.js text-items, geometry preserved) — forms & filings.
- `ingestOcr` (Tesseract word boxes) — scanned notices.
- `ingestAudio` (Whisper transcript, timed words) — client-interview recordings, "who
  said what, when."
- `ingestWebpage` (Readability + Turndown) — USCIS / court pages captured as evidence.
- `ingestTable` (Papaparse/SheetJS) — overlaps amino's own `public/import-rows.js` /
  `public/airtable-schema.js`; the two table paths could be unified on one adapter.

**Payoff:** a scanned court notice becomes queryable, citable case data inside a
workspace, with spans that point back to *a passage a reviewer can find on the page* —
not a flat blob. Because the adapters emit amino's operators, ingested documents live in
the very same encrypted room as the client's structured record.

### A5. Stronger local retrieval

**Adopt:** `src/retrieve/hybrid.js` (`retrieveHybrid` — noisy-OR fusion of lexical +
MiniLM semantic, `P = 1−(1−lex)(1−sem)`), gated to degrade to `retrieveLexical` when the
embedder is cold — the same graceful-degradation contract `data-chat.js` already relies
on. Upgrades amino's current lexical + optional `EOEmbed` fuzzy match.

### A6. Purity discipline for the projector (hardening)

eoreader4's README documents a real bug it fixed in the eoreader3 lineage: `projectGraph`
read `decay_gamma` from module scope, silently invalidating any memo not keyed on the
rules. eoreader4 routes rules through `frame.rules` and serializes the full frame into the
memo key. **Check** amino's `src/fold.js` memoization (`stateFingerprint` keys only on
`cursor:connections.length`) for any module-scope config that could serve a stale fold;
adopt the "rules travel in the frame, memo key covers the rules" discipline if so.

---

## Part B — What eoreader4 gains from amino

eoreader4's log is ephemeral and single-user. amino is the missing persistence, crypto,
sync, and collaboration substrate — and because both logs are append-only over the same
operators, the impedance is low.

### B1. Durable, encrypted, multi-device persistence + sync ★ highest value

**Today:** eoreader4's `createLog` (`src/core/log.js`) is in-memory; models cache to OPFS
but the *reading log and audit* evaporate with the tab. Reopen the document elsewhere and
the readings are gone.

**Adopt from amino:**
- `src/store.js` (`EventStore`) — vault-encrypted, append-only OPFS persistence with
  checkpointed cursor. eoreader4's log events serialize into it near-verbatim.
- `src/outbox.js` (`OutboxFlusher`) — offline-first optimistic dispatch with txn
  reconciliation and exponential backoff.
- `src/main.js` (`MatrixLive`) + `src/rooms.js` + `src/client.js` — Matrix E2EE rooms as
  the sync + sharing transport: open the same document and its readings on another device,
  because the log syncs through an encrypted room the homeserver cannot read.
- `src/blocks.js` + `src/crypto/blockcodec.js` — hash-linked recovery chain, independent
  of device keys.

**Payoff:** readings become durable, portable, and recoverable — without a database or an
app-managed API tier (amino's whole thesis: "rooms are tables, `fold(events)` is the query,
the server stores only ciphertext it cannot read").

### B2. Encryption-at-rest primitives ★

**Adopt:** `src/crypto/envelope.js` (standalone AES-GCM + ECDH-P256, **zero Matrix/DOM
dependencies** — the easiest possible port) and `src/vault.js` (PBKDF2 250k → AES-GCM,
password-unlock, tab-scoped session stash). eoreader4 reads sensitive documents but its
log/audit sit in the clear; wrapping them with `envelope`/`vault` gives password-gated
at-rest encryption with no server.

### B3. Multi-user collaboration + access model ★

**Adopt:** amino's **membership = access** model (`src/rooms.js` invite flow) +
`src/crypto/workspaceKey.js` grant flow (ECIES-wrapped workspace key per member). Turns
eoreader4 from single-reader into a shared corpus where multiple readers contribute
readings (each their own block chain, merged on read) — giving `organs/in/composite.js`'s
cross-document `SYN` a genuine multi-author dimension.

### B4. Tamper-evident, unbounded audit retention

eoreader4's `createAuditLog` is a ring buffer (capacity 300 — old turns drop). For a
legal-grade trail that is a liability. **Adopt** amino's `src/blocks.js` hash-linked chain
(each block SHA-256-points at the prior) + `src/pack.js` compact binary format
(~224 bytes/event) to persist the audit as a **tamper-evident, unbounded** log that can't
be silently rewritten — a stronger complement to eoreader4's live audit panel.

### B5. Structured query + formula layer

**Adopt:** amino's `public/data-chat.js` query engine (pure type/field/filter/aggregate/
sort/FK-traversal) and `public/formula.js` (Airtable-dialect formulas + rollups). Gives
eoreader4 a `{kind:'table'|'value'}` structured-answer path alongside its prose answers —
valuable exactly for the documents that *are* tables/records (its own `ingestTable` output).

### B6. Memory-pressure governor

**Adopt:** `src/memory.js` (heap-budget evictor registering closers for inactive working
sets). eoreader4 loads multi-GB models + embedding matrices; a budget-based evictor keeps
long sessions from ballooning.

---

## The convergence worth considering

Both repos maintain **parallel, already-drifting copies** of the nine-operator algebra —
amino's `src/operators.js` + `src/fold.js` (Matrix event types `io.matrix-events.<op>`,
content-addressed anchors) vs eoreader4's `src/core/operators.js` + `src/core/project.js`
(events `{op, site, res, prov, seq, eo}` with void/firm resolution bands). Same lattice,
diverging envelopes.

The highest-leverage long-term move is a **shared `core` package** — one operators + log +
project definition — with:
- **amino** contributing the *persistence organs* (store, outbox, vault, envelope, blocks,
  rooms, workspaceKey), and
- **eoreader4** contributing the *reading organs* (organs/in, model, retrieve, ground,
  audit, perceiver/parse).

That is the natural end state: amino stops renting intelligence, eoreader4 stops losing
state, and neither maintains a second copy of the algebra that drifts from the first.

## Suggested first steps (concrete, independently shippable)

1. **amino:** vendor `eoreader4/src/model/*` (+ `ground`, `audit`) behind the existing
   `window.EOEngine`/`EOEmbed` seam in `data-chat.js`, deleting the remote `eoreaderBase()`
   dependency. → local, grounded, cited, auditable answers over encrypted case data. (A1–A3)
2. **amino:** wire `eoreader4/src/organs/in/{pdf,ocr,audio}.js` to emit into a workspace
   room's timeline via `MatrixLive.emit`. → case documents become citable fold data. (A4)
3. **eoreader4:** back `createLog` with amino's `EventStore` + `vault`/`envelope`. →
   durable, encrypted, recoverable readings. (B1–B2)
