# The task creator — "write an essay" becomes a shaped, budgeted plan

> `src/tasks/spec.js` · `tests/task-creator.test.js`. The fixed-plan face of the
> [tasks holon](nested-task-levels.md): a generative request is read for its
> **kind**, **length**, and **subject**, matched to an artifact **shape**, and
> handed to `runTaskGraph` as a decomposition whose every leaf is sized for a
> small model.

## The one fact

The tasks holon drives a goal down to leaves and generates each one, but it
**imports no model and chooses no shape** — `decompose` and `generate` arrive
injected. The runner's own doc names the gap: `decompose` *"may be a small LLM, or
a heuristic, or a fixed plan."* The task creator is the **fixed-plan face for
generative artifacts**.

When the request is *"write an essay"*, an essay is not a shapeless reach. It has

- a **length** — sized, not left to run on;
- a **format** — prose, or markdown headings, or bullets;
- a **structure** — open with a thesis, develop it in ordered paragraphs, close
  without a new claim.

The creator reads the kind off the request, looks up that shape, and hands the
runner a decomposition that already embodies it.

```
"write a long essay about the sea"
        │  classifyArtifact → essay   subjectOf → "the sea"   readLength → ×1.8
        ▼
  spec { kind: essay, format: prose, tokens: 1260, sections: [
          introduction · body 1 · body 2 · body 3 · conclusion ] }
        │  planArtifact → { decompose, generate-budgets }
        ▼
  runTaskGraph(goal, decompose, generate)  ── the existing holon, unchanged
```

## Why this is not the anti-canon `longgen/shape.js` forbids

`longgen/shape.js` refuses a canon of response shapes, and is right to: there the
system answers a question **from a document**, and a fixed schema is a lie — it
supplies a balance the evidence cannot earn (McKeown's schemata, *"a void gate run
backwards"*). That argument is about a **grounded reading**: the shape must fall
out of what the field offers.

This is the opposite case — a **generative artifact the user asked for by name**.
*"Write an essay"* **is** a request for the essay shape; supplying it honors the
ask, it does not impose a frame on evidence. The grounding discipline still rides
underneath: each leaf the runner generates is grounded on **its own spans**
(`nested-task-levels.md`), so the spec chooses the **skeleton** while the evidence
still fills each bone.

## The small-model constraint is the whole point

A small model can be handed only so much context and can emit only so much output
in one reach. So every section carries a **token budget**, and the budget drives
the grain — the same stopping rule the [cube](cube.md) already names:

| section budget | grain | what the runner does |
| --- | --- | --- |
| `tokens ≤ LEAF_MAX_TOKENS` | **Figure** | a leaf — one small-model reach writes it whole |
| `tokens >  LEAF_MAX_TOKENS` | **Pattern** | too big for one bite — split into leaf-sized parts |

*Keep decomposing while a goal is Pattern-grained; make a leaf only once it is
Figure-grained* — here read off a **real budget**, not guessed. A normal essay's
sections all fit the ceiling, so the plan is flat. Ask for a **long** essay and the
body paragraphs overflow the ceiling and nest **one level deeper**, each part still
a one-reach generation. Length scales the budget; the budget scales the tree; the
tree keeps every generation inside what a small model can actually produce. The
runner's grain-coherence backstop confirms it: a section that overflowed and was
**split** stays coherent; one the depth guard had to **jam** into a single leaf is
flagged in `result.incoherent` — the honest "this was too big for the room left."

Each leaf is also handed its **context width** (`contextSpans`) — how wide the
caller should retrieve for that one generation — so a leaf's *input* stays inside
the model's window the same way its *output* stays inside the ceiling.

## Three sources of a shape

`createTaskSpec` resolves the shape in priority order:

1. **A learned definition** — one the caller defined previously (the library cache).
2. **A built-in template** — the shapes shipped here: `essay`, `report`, `story`,
   `review`, `letter`, `list`, `summary`, and the degenerate `answer`.
3. **Nothing** — `needsResearch(kind)` is true. The caller may propose a web search
   for the *"good elements of a `<kind>`"* (`researchQuery`), parse the result with
   `deriveSpecFromDefinition`, and `define` it into the library so the next request
   reuses it.

> *"you could have it do a websearch to determine what the good elements of an essay
> are, or if that's been defined previously."*

The library is the **"defined previously"** half; `deriveSpecFromDefinition` plus a
caller's web fetch is the **"websearch"** half. The fetch is the caller's
(proposer-only, the [web-search](web-search.md) discipline) — this module **never
touches the network**, exactly as the runner never imports a model. A definition
parsed once is cached, so the cost is paid at most once per kind.

`deriveSpecFromDefinition` is guarded the way `formulateSearchQuery` is: a
definition it cannot parse into at least two section roles returns `null`, and the
built-in stands — behaviour only improves, never regresses.

## The API

```js
import {
  classifyArtifact, subjectOf, readLength,   // the three reads off the request
  createTaskSpec, planArtifact, withBudgets,  // request → spec → runTaskGraph faces
  runArtifact,                                // the convenience: create + run
  createSpecLibrary, deriveSpecFromDefinition, needsResearch, researchQuery,  // the learned/web path
} from '../tasks/index.js';
```

Wiring a small model to it is a few lines — `generate` is the only injected face
that touches a model:

```js
const lib = createSpecLibrary();

// if the kind has no shape yet, fetch one and cache it (proposer-only):
if (needsResearch(kind, lib)) {
  const pages = await webSearch(researchQuery(kind));     // the caller's fetch
  lib.defineFromDefinition(kind, pages.map(p => p.text).join('\n'));
}

const res = await runArtifact({
  request: 'write a long essay about the sea',
  library: lib,
  generate: async (view) => {                              // run ONCE PER LEAF
    const spans = retrieveFor(view.goal, { k: view.contextSpans });   // this leaf's evidence only
    const messages = buildGroundedMessages({ question: view.goal, spans, format: view.format });
    const output = await model.phrase(messages, { maxTokens: view.maxTokens });  // the leaf's ceiling
    return { output, sources: spans.map(s => s.idx) };
  },
  onUpdate: (graph) => render(graph),                       // the live tree, after every event
});

res.spec;     // the structure it planned — kind, sections, budgets
res.output;   // the assembled artifact
res.progress; // leaves done / total
```

The view each leaf receives is the runner's Figure-maker identity **plus the
small-model contract** the creator adds: `role` (where it sits in the artifact),
`format` (how to render), `maxTokens` (this leaf's output ceiling), `contextSpans`
(how wide to retrieve), and `spec` (the whole plan, for context).

## What does not change

`spec.js` is additive. The runner, the projection, the events, the grain machinery
— untouched. A request that names no artifact classifies as `answer`, a
single-section plan whose **root is the leaf** — byte-identical to one small-model
call, the degenerate task graph the tasks holon already promised. The shape is a
plan over the existing holon, the same way the arc is a plan over the turn.
