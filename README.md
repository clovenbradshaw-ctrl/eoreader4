# eoreader4

> A holonic redesign of the document-chat app described in the
> [eoreader3 text-chat-mechanics map](https://github.com/clovenbradshaw-ctrl/eoreader3/blob/main/docs/text-chat-mechanics-map.md).
> Same goal — ingest a text document, chat with it against a local LLM,
> audit every decision. Different shape: the code is now a nest of
> independent, swappable sub-assemblies over a single durable spine.

## Three principles

**The low sets the possibility for the high.**
A turn can only retrieve what parse admitted. A model can only phrase what
retrieval surfaced. A citation can only bind to a span that exists. Each
lower holon constrains what a higher one is allowed to do.

**The high sets the probabilities for the low.**
The grounding envelope re-weights retrieval. The conversation field biases
entity admission. The audit's history shapes which routes the next turn
will try. Higher holons influence lower ones — without violating their
contracts, only by changing the priors they operate under.

**Each holon is whole at its own scale.**
Open `src/core/`, run its tests, replace it — without touching `parse/`,
`retrieve/`, or the UI. The boundaries are real. If a change to attribution
risks the projector, or a change to retrieval risks the grounder, we have
a watch that collapses when the bench is jogged — not a nest of holons.
(See Koestler's parable in `docs/holons.md`.)

## Grounded in source, not just in the map

The shapes here were initially derived from the eoreader3 mechanics map,
then verified by reading the live `engine.js`. The source-level findings
are recorded in eoreader3's
[`docs/engine-extraction-notes.md`](https://github.com/clovenbradshaw-ctrl/eoreader3/blob/claude/friendly-edison-abaret/docs/engine-extraction-notes.md)
and baked into the code here:

- **`projectGraph` is genuinely pure on `(log, frame)`.** The eoreader3
  projector reads `READING_RULES.decay_gamma` from module scope at
  `engine.js:7052` — a silent impurity that would invalidate any memo not
  keyed on the rules. In [`src/core/project.js`](src/core/project.js) the
  rules arrive through `frame.rules` (with `DEFAULT_PROJECTION_RULES` as
  fallback); the memo key serializes the full frame including rules.
  Same key, same result.
- **`createParser` owns the parse-time state.** The eoreader3
  `extractEoGraph` mutates `TRANSCRIPT_ACTIVE` and `LANGUAGE_MODULES`
  from module-scoped lets at `engine.js:4228–4249`. Here
  [`createParser`](src/parse/pipeline.js) returns an instance that owns
  that state on itself; `parseText` is the one-shot convenience for
  cases that don't need a long-lived parser.
- **The turn is a literal `stages.reduce(...)`.**
  [`src/turn/pipeline.js`](src/turn/pipeline.js) folds the named-stages
  list with one `onStep` callback that becomes the audit step entry. The
  audit stops being parallel bookkeeping and becomes a projection of the
  fold — same spine, two levels.
- **CON is the ninth operator** (confirmed at `engine.js:6855, 6924`),
  not the eight the eoreader3 README listed. CON and SIG are both
  relation edges in the projection; SYN is for identity joins only.

## The spine

```
any modality ─adapter─▶ append-only event log ─project─▶ graph
   (text · image)            │  (nine operators)
                             ├─▶ retrieve ─▶ fold ─▶ prompt ─▶ llm ─▶ bind ─▶ veto ─▶ answer
                             │        (the fold = the consciousness)            │
                             └─▶ audit ── (projection of the stages.reduce fold) ┘
```

The append-only log is the single source of truth. The graph is a fold of
the log; you can lose it at any moment and rebuild it by replay.
`projectGraph` is memoized on `(events.length, frameSig)` — safe because
the log is append-only and the frame (including its rules) is fully in
the key.

**Modality-universal.** `parse` is the *text adapter*; `ingestImage` is the
*image adapter* (a vision model's detections, injected). Both emit the same
nine operators onto the same log, so the graph, the reading cursor, the three
reading levels and the fold all work unchanged whether the units are sentences
or image regions. New modalities are new adapters, not a new spine.

## Three levels of reading — three kinds of math

Reading happens at three levels, the three domains of the EO cube read top to
bottom. Each is a genuinely different mathematics, and each is a *surface* a
mechanical "consciousness" queries behind the scenes to ground the talker.

| Level | Domain | Operators | Math |
|-------|--------|-----------|------|
| **1 · existence** | Existence | NUL SIG INS | **counting measure** — cardinality of presence; token-set overlap (`hits/qLen`). |
| **2 · structure** | Structure | SEG CON SYN | **graph linear algebra** — a union-find quotient over a weighted adjacency; edge weight bilinear in endpoint log-mass under a γ-decay kernel along the reading line. |
| **3 · significance** | Interpretation | DEF EVA REC | **probability + information** — a prior over "who acts next" (the integral fold of γ-mass), an expectation (prediction), and a **surprisal** (−log₂p) when the next line lands (its differential). |

The **integral fold** accumulates (∫) the reading up to the cursor; **surprise**
is its differential — the residual between what the fold predicted and the
increment the next line actually delivered. The `read` holon exposes all three
surfaces and the `consciousness` that folds them into the note the model reads.

## It is all physics, not decisions

The reader never makes an irreversible choice; it accumulates weight that
asymptotically approaches truth.

- **Coreference is a field, not a decision.** A pronoun does not *pick* an
  antecedent — each entity leaves a decaying mass-trace, and the pronoun induces
  a weighted distribution over candidates. The strongest weight becomes the
  bond's **coupling**, so the uncertainty rides along; as evidence concentrates
  the weight → 1. A model collapses referents the same way: not by returning a
  choice but by emitting meta-content that *weights* candidates (`reinforce`).
- **The graph is a field.** Entities carry **mass** (γ-accumulated sightings),
  bonds carry **coupling**; edge weight is a *measurement* of that field under a
  frame (the cursor), never a stored fact. The force layout reflects it — a
  heavier bond is a stiffer, shorter spring.
- **NUL is non-transformation**, not clearing. A held line is simply not turned
  into structure. Voiding a fact would be a **DEF to VOID** — an assertion — never
  a NUL.

## Conventions — the document teaches the reader (REC)

Before the per-sentence loop reads a word, **Pass 0** induces how *this*
document marks speech (a sci-fi text whose dialogue runs on "pinged" instead of
"said"). Each induced verb is a **REC** ("learn a rule") entry in the
conventions ledger — eoreader3's `conventions.jsonl` / `RULES_LEDGER` — written
into the log and unioned with the seed set. The high (a learned rule) sets the
probabilities for the low (how the next thousand sentences classify). Nothing is
hard-coded true; a convention is whatever the text keeps doing.

## The sub-assemblies (each a holon)

| Holon         | Public interface                                            | Depends on |
|---------------|-------------------------------------------------------------|------------|
| `core`        | log · address · operators · project (memoized, rules in frame) | nothing  |
| `conventions` | `createConventions()` (REC ledger) · `induceAttributionVerbs` | nothing  |
| `parse`       | `createParser(opts)` · `parseText(text, opts)` → doc (text adapter) | `core`, `conventions` |
| `read`        | `existence/structure/significance` surfaces · `consciousness` · `readingAt` | nothing |
| `enact`       | `createEnactedLoop` · `enactedReadingTo` · `replayFrames` · `loopStats` (the enacted DEF·EVA·REC loop) | `read` |
| `retrieve`    | `retrieveHybrid(doc, q, embedder)`                            | `core`, `parse` |
| `fold`        | `foldNote(spans, {doc, cursor})` · `impressionQuery`         | `read`     |
| `ground`      | `bindCitations(draft, spans)` · `runVetoes`                   | `core`, `parse` |
| `answer`      | `tryMechanical(doc, q)`                                       | `core`, `parse` |
| `model`       | `createModel(name)` · `createMiniLMEmbedder()`                | nothing (DI) |
| `classify`    | `createPhasepostClassifier({cells, centroids, embedder})`     | `core`     |
| `boot`        | `bootGeometricReader(root, {embedder})` · `createInstaller`   | `classify`, `model` |
| `converse`    | `conversationalEvent` · `depositConversational` · `commitSurvives` · `corefPerception` | nothing |
| `factcheck`   | `factCheck({prose, doc, graph, classifier})` · `corroborateCoref` (edge-grounding veto) | `core`, `parse`, `classify`, `converse` |
| `audit`       | `createAuditLog()`                                            | nothing    |
| `turn`        | `runTurn({question, doc, model, embedder, auditLog})` (reduce)| all above  |
| `ingest`      | `ingestText(file)` · `ingestImage(detections)` → doc          | `parse`, `core` |
| `ui`          | DOM presentation + graph view / reading cursor               | `turn`, `read`, `audit` |

Each holon's `index.js` is its only entrance. No file imports the internals
of another. The rule is a discipline enforced by inspection, not by tooling.

## Phasepost perception — the geometric reader

A proposition fills three grain positions at once — **Ground / Figure /
Pattern** — and the cell each fills is *measured*, not chosen: the `classify`
holon scores the proposition against the 27 cell centroids partitioned into
three bands and reads off the address. Measurement is real only in the
centroids' space, so the embedder carries a `measuresMeaning` guard — true on
MiniLM, false on the hash organ — and under hash the classifier **holds every
position at no-commit** rather than let spelling masquerade as meaning. The
`boot` holon installs the instrument (idempotent, cached, non-blocking,
degrading) behind an initialization animation that resolves to the *true* state
of the reader — live, or unavailable and holding at no-commit. See
[`docs/phasepost.md`](docs/phasepost.md); the animation runs in isolation at
[`boot-animation.html`](boot-animation.html).

The talker is wired as the **weakest reader**: its turns enter the activation
field as conversational-provenance depositions (tagged, capped, decaying),
witnessed by the talker, so they warm the field and orient the next turn but can
never be cited as document provenance, originate a committed reading, or type a
relation. A fold-time subtract-and-check refuses any reading that leans on that
warmth. See [`docs/conversational-provenance.md`](docs/conversational-provenance.md).

On the way back, the **edge-grounding veto** (`factcheck`) holds the talker to
the graph it spoke from. It parses the talker's prose with the same SVO parser
the page uses, resolves the endpoints through the **document** referent table
(never the talker's own coreference), types each relation to its cell, and
compares each claimed edge to the document reading — yielding one of four
verdicts: *corroborated* (and earns the document edge's citation), *unsupported*
(flag), *contradicted* by a VOID or opposing edge (refuse), or *indeterminate*
(held). `unbound` catches a claim with no node-witness; this catches a claimed
*relation* with no edge-witness — the shape the invented-location lie wore. The
talker's coref strength returns as a **proposal**: it may tip a merge, but a
grounding reader must second it before the merge commits. See
[`docs/edge-grounding.md`](docs/edge-grounding.md).

Those arrows are also what the talker is **handed**. The prompt feeds the fold —
the document **notes** (plain-language arrows over the folded graph) *plus* the
verbatim **excerpts** — never raw spans alone, the discard that let the model fill
the gaps between sentences with invented tokens. The surface discipline runs the
whole prompt: the notes are arrows in words (`sister --tends--> Gregor`), never
operator codes, cell names, sentence indices, or citation tokens, and orientation
is the *filename*, type, and length — never a title, author, or genre, because
recognition replaces reading. The notes register feeds the prompt on the way out
and the edge-grounding veto reads it on the way back: one object, two directions.
See [`docs/prompt-assembly.md`](docs/prompt-assembly.md).

## The significance loop — the enacted DEF · EVA · REC

The phasepost is the **depicted** loop: a perception of what a clause *reports*,
timeless and recomputable. Beside it runs the **enacted** loop (`enact/`) — the
reading's *own* act of establishing its terms, testing its particulars, and
restructuring its frame, in read time. This is the significance engine, the thing
eoreader3 had in feel; the two loops are tagged apart and never conflated in the
log (`kind:'phasepost'` vs `register:'enacted'`).

A **frame** is the terms the reading holds at a layer, carrying a **strain**
accumulator and a **REC threshold**. **DEF** sets the frame; **EVA** tests each
particular against it (verdict *confirm* or *strain*, the surprise its magnitude);
**REC** restructures the frame when accumulated strain breaks the threshold —
never on a single anomaly. Surprise is the throttle: a confirming EVA holds, a
straining EVA accumulates, the frame RECs at threshold.

The layers are a system, not a stack. A proposition particular can **cross
layers** to test the document frame; lower particulars accumulate as EVAs against
the higher frame until it breaks, and only the higher layer's *own* REC
restructures it. The **arrow of time** keeps this from being circular: every EVA
tests the frame *as of the cursor*, never a future frame — cross-layer influence is
legal because it is cross-layer **and backward in time**. The **fold**
(`replayFrames`) replays the enacted events to a cursor and reconstitutes the
reader's frames as of that cursor; the same referent under a frame at two ages is
two readings. `loopStats` surfaces the REC rate so a stable reading, a turbulent
one, and a thrash are distinguishable.

Two reads, one loop. The **skeleton** runs on the cheap γ-mass surprise over the
whole document; the **meaning reader** (`enactedReadingMeaning`) drives the *same*
loop with prediction error in the centroids' space, so frames restructure on
sense-turns the γ-mass reader is blind to — and falls back to the skeleton under
the hash organ. The loop never changed; only `read` got deeper, exactly as the
design promised. See [`docs/significance-loop.md`](docs/significance-loop.md); it
surfaces as a fourth strip in reading mode that deepens to *semantic surprise* when
the geometric reader is live.

## The nine operators

The vocabulary the whole system speaks (the ACT face of the EO cube):

|              | Existence           | Structure          | Interpretation   |
|--------------|---------------------|--------------------|------------------|
| Differentiate| **NUL** hold¹       | **SEG** resplit    | **DEF** assert²  |
| Relate       | **SIG** attribute   | **CON** bond       | **EVA** evaluate |
| Generate     | **INS** instantiate | **SYN** synthesize | **REC** learn    |

¹ NUL is **non-transformation** — a thing held as-is — *not* clearing.
² Clearing/voiding is a **DEF to VOID** (an assertion), never a NUL.

**CON** — the binding bond at Relate × Structure — is the central
operator. It is what makes a citation hold a claim to a source. See
[`docs/operators.md`](docs/operators.md) for the full address derivation
(ACT, SITE, RESOLUTION).

## Turn as fold — same spine, two levels

```js
// src/turn/pipeline.js (excerpt)
const ctx = await GROUNDED_PIPELINE.reduce(
  async (accPromise, name) => {
    const acc = await accPromise;
    if (acc.terminate) return acc;
    const next = await stages[name](acc);
    onStep(name, next, nowMs() - t0);   // ← audit step IS the projection
    return next;
  },
  Promise.resolve(ctx0)
);
```

- The document is a fold of its event log (`projectGraph`).
- The turn is a fold of its stage list (`stages.reduce`).
- The audit is the projection of the turn fold, same shape as the
  projection of the document log.

Mechanical paths (math, who, confirm) short-circuit by returning
`{ terminate: true }` from the `route` stage. The model never warms for
those questions.

## Smooth load, fast response

- **No bundler, no React.** Vanilla ES modules served byte-for-byte.
  Open `index.html` and the pipeline is already alive against the
  deterministic `echo` backend.
- **Model loads on first message, not on page open.** Page-open cost: 0.
  When the user sends their first message, the chosen local backend
  (`wllama` SmolLM2-135M on CPU, ~30 s cold; or `webllm` Llama-3.2-3B on
  WebGPU, ~2 min cold) is fetched.
- **Memoized `projectGraph` with the full frame in the key.** The
  largest single perf win called out in the eoreader3 map — with the
  rules-in-frame discipline that makes it actually safe.
- **One query embedding per turn**, shared across retrieval / fold / score.
- **Mechanical paths first.** Math, who-is, simple confirm — answered
  without loading the model at all.

## Auditable

Every turn produces a single record (`docs/audit-schema.md`):

- the route taken
- spans retrieved (`idx` + `score`)
- the **verbatim prompt** sent to the model
- the **verbatim raw output** from the model
- claims bound, claims vetoed and why
- per-step timings

The audit panel shows it live; one button exports JSONL.
Tune the system against the trail, not the symptoms.

## What was kept, what was cut

From the eoreader3 selection (`text-chat-mechanics-map.md` §6):

**Kept (load-bearing):** the log+projection spine, the 9-operator
vocabulary, citation binding + veto battery, audit + verbatim LLM step,
mechanical math, the integral fold.

**Cut (dead weight in eoreader3):** `eoscore.js`, `enrich.js`, the dead
shape pass with no live caller, the second `EOFormLibrary` with no genres,
three overlapping table detectors, vestigial `referencesDoc`,
computed-and-dropped layout `seedEvents`, the false "OFF by default"
comments on gates that were on.

**Enhanced (against the source-level findings):**
- Memoized `projectGraph` with rules-in-frame (eoreader3 silently reads
  `READING_RULES.decay_gamma` from module scope).
- `createParser` factory owning parse state (eoreader3 mutates
  module-scoped `TRANSCRIPT_ACTIVE` and `LANGUAGE_MODULES`).
- Turn as literal `stages.reduce(...)` with onStep callback (eoreader3
  records turn steps in parallel bookkeeping rather than as a projection
  of the fold).

**Rebuilt to match what worked (this branch):**
- **Graph extraction** — coreference as a weighted field, speech→SIG /
  copular→DEF / transitive→CON classification, kinship apposition, multi-word
  names, name-containment SYN, `INS`-per-sighting so mass is real.
- **Proposition addressing** — the SVO parse logs its **argument spans** as a
  `SEG kind:'argspan'` event *before* the bond, with offsets back into the
  sentence, so a CON walks back to the text its endpoints were read from (the
  witness chain no longer stops at the bond). `positionElements` fills Ground /
  Figure / Pattern structurally — subject·object → Ground, verb → Figure,
  relation → Pattern — holding the cells at no-commit until the meaning reader
  names them. See [`docs/proposition-addressing.md`](docs/proposition-addressing.md).
- **The fold is the consciousness** — existence + structure + significance
  folded into the reading the model receives (was a verbatim span dump the
  `prompt` stage didn't even use).
- **The grounded prompt** — the fold's **notes** (plain-language arrows over the
  graph) *plus* the verbatim **excerpts**, under a recognition-free orientation
  (filename, type, length), question first for the small-model exchange. Notes and
  excerpts from the same cursor; no codes, indices, or citation tokens reach the
  talker. See [`docs/prompt-assembly.md`](docs/prompt-assembly.md).
- **Reading mode** — predict (REC) / evaluate (EVA) / surprise (surprisal in
  bits), EO-tagged, surfaced as you step a cursor through the document.
- **The graph view** — see and explore the graph with a cursor; nodes are
  masses, edges are couplings, the reading cursor re-projects with γ-decay.
- **Conventions ledger (REC)** and a **modality-universal** spine with text and
  image adapters.
- **Intent routing** — a greeting routes to *smalltalk* (never grounded, no
  model warmed); `who is …` is answered mechanically (alias-aware); math
  short-circuits. The model is warmed only for real document questions.
- **Chrome is a semantic role, not a list.** Parse holds only the genuinely
  *degenerate* (a bare number, a roman numeral, a separator). Everything else's
  role is read semantically: a unit off the document's distribution that anchors
  no figure is DEF'd as a **site** (`read/site.js`), and retrieval skips it. A
  mini-LLM nudges the borderline; nothing is matched against a pattern list.
- **Predictive surprise.** Beyond the mechanical surprisal baseline, reading
  mode runs predictive coding (`read/predict.js`): the LLM reads the passage,
  predicts the next line, and surprise is the **embedding distance** to what the
  document actually says next.
- **The Log tab** shows the append-only event log the graph is a fold of,
  grouped into the recursive levels of reading — each pass reads what the one
  below admitted, approaching the meaning in passes rather than one verdict.

## Run

    # tests
    npm test            # node --test tests/*.test.js

    # the app
    python3 -m http.server 8000
    # then visit http://localhost:8000

## License

MIT.
