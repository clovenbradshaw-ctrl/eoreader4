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

## The spine

```
text ─parse─▶ append-only event log ─project─▶ graph
                  │
                  ├─▶ retrieve ─▶ fold ─▶ prompt ─▶ llm ─▶ bind ─▶ veto ─▶ answer
                  │
                  └─▶ audit (every step, verbatim)
```

The append-only log is the single source of truth. The graph is a fold of
the log; you can lose it at any moment and rebuild it by replay.
`projectGraph` is **memoized** on `(events.length, frameSig)` — safe because
the log is append-only.

## The sub-assemblies (each a holon)

| Holon       | Public interface                                       | Depends on |
|-------------|--------------------------------------------------------|------------|
| `core`      | log · address · operators · project                    | nothing    |
| `parse`     | `parseText(text)` → doc                                | `core`     |
| `retrieve`  | `retrieveHybrid(doc, q, embedder)`                     | `core`, `parse` |
| `fold`      | `foldNote(spans)` · `impressionQuery`                  | `core`     |
| `ground`    | `bindCitations(draft, spans)` · `runVetoes`            | `core`, `parse` |
| `answer`    | `tryMechanical(doc, q)`                                | `core`, `parse` |
| `model`     | `createModel(name)` · `createMiniLMEmbedder()`         | nothing (DI) |
| `audit`     | `createAuditLog()`                                     | nothing    |
| `turn`      | `runTurn({question, doc, model, embedder, auditLog})`  | all above  |
| `ingest`    | `ingestText(file)` → doc                               | `parse`    |
| `ui`        | DOM presentation, no logic                             | `turn`, `audit` |

Each holon's `index.js` is its only entrance. No file imports the internals
of another. The rule is a discipline enforced by inspection, not by tooling.

## The nine operators

The vocabulary the whole system speaks (the ACT face of the EO cube):

|              | Existence           | Structure          | Interpretation   |
|--------------|---------------------|--------------------|------------------|
| Differentiate| **NUL** hold        | **SEG** resplit    | **DEF** assert   |
| Relate       | **SIG** attribute   | **CON** bond       | **EVA** evaluate |
| Generate     | **INS** instantiate | **SYN** synthesize | **REC** learn    |

The eoreader3 README listed eight. The ninth — **CON**, the binding bond —
is the central one. See [`docs/operators.md`](docs/operators.md) for the
full address derivation (ACT, SITE, RESOLUTION).

## Smooth load, fast response

- **No bundler, no React.** Vanilla ES modules served byte-for-byte.
  Open `index.html` and the pipeline is already alive against the
  deterministic `echo` backend.
- **Model loads on first message, not on page open.** Page-open cost: 0.
  When the user sends their first message, the chosen local backend
  (`wllama` SmolLM2-135M on CPU, ~30 s cold; or `webllm` Llama-3.2-3B on
  WebGPU, ~2 min cold) is fetched.
- **Memoized `projectGraph`.** The largest single perf win called out in
  the eoreader3 map — `(events.length, frameSig)` is the cache key, safe
  because the log is append-only.
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

**Enhanced:** memoized `projectGraph`; shared query embedding; trimmed
stable grounded prompt (prefix-cacheable); lazy form measurement; cheapest
mechanical paths first in routing.

## Run

    # tests
    node --test tests/

    # the app
    python3 -m http.server 8000
    # then visit http://localhost:8000

## License

MIT.
