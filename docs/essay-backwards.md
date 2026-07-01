# Working backwards from a Claude essay — what the small model would actually need

> An investigation, not a merged design. We keep failing to get multi-prompt
> small-model generation to produce anything *essay-shaped*. Rather than push the
> loop forward another notch, this doc runs the decisive control in reverse. Take
> one compelling essay of the kind Claude writes about this program — the kind
> that makes the philosophy legible — and decompose it into the loop's own
> vocabulary (`spec-generation.md`'s **generate-then-read parity**, run by hand).
> The decomposition is the target trace. What it exposes is not a weakness in the
> model. It is a category error in the resolver: **the loop walks the nodes of a
> graph, and an essay walks the edges.**

## 1. The essay (the target)

Sentences are numbered so the decomposition in §2 maps one-to-one. This is one
atom per sentence — the grain the planner deposits at.

> **1** A small language model is not stupid; it is fluent past its knowledge.
> **2** Hand it a gap and it will fill the gap, because filling gaps is the only
> thing it was ever trained to do. **3** The fill comes out grammatical and
> confident and often wrong, and its confidence when it is wrong is
> indistinguishable from its confidence when it is right. **4** So the problem was
> never the model's competence — it was the open slot we kept handing it.
>
> **5** This program's wager is that you can close the slot without reaching for a
> bigger model. **6** You close it by never asking the model to decide anything
> that could instead be decided somewhere it can be checked. **7** A separate
> engine — the planner — makes every structural decision before the model is
> called at all. **8** It chooses what comes next, resolves that choice to one
> concrete proposition, and hands the model a single sentence's worth of work.
> **9** The model's job shrinks to the one thing it is genuinely good at: turning a
> fixed proposition into a fluent sentence. **10** Nothing is left open, so there
> is nothing to confabulate into.
>
> **11** The deeper move is where the planner gets its decisions from. **12** It
> reads the source the way the model would, but it keeps the reading instead of the
> prose. **13** Every claim it plans is a claim it can point at — a span of the
> source, an edge on a graph. **14** A sentence it cannot ground, it does not plan.
> **15** And when the model's rendering drifts off the span it was handed, a floor
> catches the drift, truncates the sentence to the part that held, or drops it.
> **16** Grounding stops being a property you hope the output has and becomes a gate
> every sentence has to pass through.
>
> **17** The elegant part is what happens when there is no source left to read —
> when the thing being generated is long, and each sentence has only the last one to
> follow from. **18** Then the planner switches the thing it reads from the document
> to the generation's own output so far. **19** It reads what it has already said the
> way it read the source, and plans the next sentence as the most natural
> continuation of that reading. **20** But it reads its own sentences with the
> floor's verdict still attached — the judged claim, never the bare one — so it can
> never mistake its own guess for the world. **21** A sentence that drifted raises
> the strain the next decision reads, and a run that starts to confabulate turns
> itself toward stopping.
>
> **22** So length is not a target the program pads out to; it is a consequence of
> how much it can still ground, and the writing stops when it honestly cannot ground
> more. **23** The whole design is one idea held at two scales: the low can only say
> what the high admits, and the high can only want what the low can ground.

Read it once as a reader. It opens by setting terms (what a small model is), turns
on a reframe (the problem is the slot, not the model), develops the mechanism
(planner plans, model renders, floor checks), turns again to the hard case (long
generation, the source-switch), and lands on a principle. That is the significance
arc `shape.js` is trying to bias toward: **open → develop → turn → land**. The
question is whether our loop could ever *walk* it.

## 2. The decomposition — the same essay as a move-log

Each atom typed with the real operator alphabet (`predict/movelog.js`:
`NUL SEG DEF SIG CON EVA INS SYN REC VOID`). The columns that matter are the last
two: **against what** the atom resolves, and **whether it consumes a fresh span of
external ground**. "EXT" = a node/edge drawn from the subject; "SELF-k" = it
operates on the proposition already deposited at atom k.

| # | move | stance | resolves against | fresh external span? |
|---|------|--------|------------------|----------------------|
| 1 | DEF | set terms | EXT: *small model / fluency* | **yes** (open) |
| 2 | CON | assert mechanism | SELF-1 (+ EXT: *training objective*) | partial |
| 3 | EVA | test | SELF-2 (the fill, against *right/wrong*) | no |
| 4 | REC | reframe | SELF-1,2,3 → *the slot, not the model* | no |
| 5 | DEF | set terms | EXT: *the wager* | **yes** (new frame) |
| 6 | CON | assert mechanism | SELF-5 | no |
| 7 | INS | mint a figure | EXT: *the planner* | **yes** |
| 8 | CON | elaborate | SELF-7 | no |
| 9 | EVA | test | SELF-8 against EXT: *what the model is good at* | partial |
| 10 | REC | draw the payoff | SELF-6,8 → *nothing to confabulate into* | no |
| 11 | DEF | deepen | EXT: *where decisions come from* | **yes** (sub-frame) |
| 12 | CON | assert mechanism | SELF-11 (+ EXT: *reading vs prose*) | partial |
| 13 | SIG | attribute | SELF-12 (*a claim it can point at*) | no |
| 14 | EVA | test / the floor | SELF-13 (*cannot ground → does not plan*) | no |
| 15 | REC | consequence | SELF-14 (drift → truncate/drop) | no |
| 16 | SYN | close the middle | SELF-12,13,14,15 → *grounding is a gate* | no |
| 17 | DEF | turn to the hard case | EXT: *long generation* | **yes** (new frame) |
| 18 | CON | the source-switch | SELF-17 (+ EXT: *doc → self*) | partial |
| 19 | EVA | elaborate | SELF-18 | no |
| 20 | REC | the weld / firewall | SELF-18,19 (+ EXT: *judged vs bare*) | partial |
| 21 | EVA | consequence | SELF-20 | no |
| 22 | SYN | land | SELF-17..21 → *length is a consequence* | no |
| 23 | SYN | close the whole | SELF-4,16,22 → *the two-scale principle* | no |

**Count the last column.** Fresh external spans, unambiguous: atoms 1, 5, 7, 11,
17 — **five** of twenty-three. Add the five "partial" atoms (each leans on one
external concept but its *content* is a relation to a prior atom) and you reach ten
that touch the world at all. **Thirteen of twenty-three atoms consume no external
ground whatsoever.** They operate on what the essay has already said.

That is the whole finding, and it is quantitative: **a compelling essay is ~75%
self-operation.** The sentences that make it read as thought — 3, 4, 10, 15, 16,
20, 22, 23 — introduce no new fact. They *turn on the previous sentences*.

## 3. Why the loop we have cannot walk this

The loop resolves every drawn move against the ground pool and, on an empty pool,
stops. Two lines decide the whole failure.

**`resolve.js` launders the operator into "assert the next span."** Read the
`switch` (`src/longgen/resolve.js:64`). `SYN` closes over fired spans; `VOID`
asserts an absence; `EVA` grabs the next uncovered span and carries a prior span as
`against`; **everything else — `CON SIG INS REC DEF SEG NUL` — falls through to
`assertProposition(ranked[0])`** (`resolve.js:87`). So seven of the ten operators
resolve to *the same act*: take the strongest unspent span and assert it. The
predictor can draw a beautiful `DEF → CON → EVA → REC → SYN` rhythm, and the
resolver flattens it into "assert span, assert span, assert span." The docstring in
that file already confesses the earlier version of this bug; the current version is
subtler but the same shape — **the operator changes the framing verb, not the
content.** Our essay's atoms 4, 10, 15, 16, 20, 22, 23 have *no fresh span* to
assert. Under this resolver they cannot be produced. They resolve to `null`.

**`continuation.js` reads that `null` as "the essay is over."** When `resolveProposition`
returns nothing, the loop stops with `ground-exhausted` (`continuation.js:112`). An
essay empties the uncovered-span pool in about three atoms — because it barely
*consumes* the pool, it *develops* it — so the loop's honest, calibrated,
grounded behavior is to write three sentences and quit. Everything the saturation
and quiesce machinery does is correct *for a summary*. It is exactly wrong for an
essay, because it measures remaining ground as remaining spans, and an essay's
material is not spans.

**The self move-log goes flat, so the arc never cycles.** `direction.js`
(`selfMoveLog`, line 28) builds the predictor's input from `u.move` per accepted
unit. If the resolver launders every move into an assert, the realized move-log the
predictor reads is a near-constant stream, `p(next)` predicts more of the same, and
`shape.js`'s phase bias is left shoving a `DEF` in at the front and a `SYN` in at the
end of a body that is otherwise undifferentiated. The **rhythm** — the thing that
distinguishes atoms 3, 4, 10 from a list — cannot emerge, because the resolver
erased the operator distinctions before the predictor could ever see them realized.

**The prompt carries one idea; an essay atom needs two.** `propositionInstruction`
(`prompt.js:58`) hands the model one `subClaim` and one source line. That is right
for a node ("say that Goriot was a pasta-maker"). It is insufficient for an edge:
atom 4 is *the relation between* "the model is fluent" and "we handed it a slot" —
two referents and a verb (*reframe A as really-about B*). The model can render an
edge as easily as a node. It is never handed one.

And note the tell one level up: `answerable.js:30` can type a question as
`route / procedure / comparison / definition / judgment / list / summary / fact`.
The richest shape it knows is **summary**. There is no `essay`, no `argument`. The
whole pipeline's ceiling of ambition is *arrange the salient facts well*. That is a
fine ceiling. It is just not the thing we keep asking it to do.

## 4. The reframe that makes it click

**A summary is a walk over the nodes of a graph. An essay is a walk over the
edges.** Our loop walks nodes — it deposits the next-most-salient span each step —
which is why its output is meaningful-but-flat and never turns. Working backwards
from *any* essay you like will show the same profile: a handful of node-atoms that
introduce the terms, and a majority of edge-atoms that invert, qualify, name a
mechanism, draw a consequence, or fold priors into a principle. The small model is
not the bottleneck. **The resolver never hands it an edge. It hands it the next node,
every time, and calls the essay finished when it runs out of nodes.**

The good news is that everything needed to fix this is already half-built and named
as a seam. The reader already runs a *two-register* move-log
(`movelog.js`): **CONTENT** (what it perceives in the text — nodes) and **ENACTED**
(its own cognition testing the frame — `DEF → EVA → REC`, edges). The generator
collapsed both registers into one span-pool. The fix is to un-collapse them.

## 5. What generating this essay iteratively would concretely require

Four changes, each pointed at a line that already exists. None of them is a bigger
model.

1. **Two ground registers, honored by the resolver.** External ground (the subject's
   concept-and-relation graph — the nodes and edges) *and* self-ground (the accepted
   atoms, each carrying its floor verdict). Route the operators by register, the way
   the reader's two-register move-log already splits them:
   - node moves — `DEF INS CON SIG` — resolve against **external** ground (introduce
     a term, mint a figure, assert a relation from the subject graph);
   - edge moves — `EVA REC SYN NUL` — resolve against **self** ground (operate on
     prior atoms), consuming **no** external span.

2. **Edge moves consume no external ground, so `ground-exhausted` stops meaning
   "essay over."** Today `EVA` still requires `ranked[0]` (`resolve.js:84`); an `EVA`
   should be able to test *a prior atom* against the frame with no fresh span at all.
   Once edge moves are free of the span pool, the loop stops by saturation of *ideas
   developed*, not spans consumed — which is what the essay's own stopping point (atom
   23, a `SYN` that closes over 4/16/22) actually is.

3. **The proposition for an edge move is a relation, not a span.** `resolveProposition`
   returns `{ subClaim, spans, against }` — extend it so an edge move returns
   `{ leftRef, relation, rightRef }` drawn from `{prior atoms} × {frame}`. Then
   `propositionInstruction` (`prompt.js:58`) hands the model *two* referents and the
   relation verb ("write one sentence recasting *A* as really being about *B*"),
   which is exactly the shape of atoms 4, 10, 16, 20, 23.

4. **Build the external graph once and run generate-then-read parity against this
   trace.** For *this subject* — the program's own philosophy — we do not have to mine
   the graph from a corpus; it is authored, it is in these docs. The node set of the
   essay above is roughly fourteen concepts (*small model, fluency, open slot,
   confabulation, planner, proposition, render-division, grounding, span, floor,
   source-switch, self-reading, weld/strain, two-scale principle*) and the essay is a
   walk over the edges among them. Hand that graph as `ground` + `graph`, run
   `runContinuation`, feed the output back through the reader, and check per atom that
   the move it reads matches the move in the table in §2 (`spec-planner.md:§13`, the
   parity control). **The decomposition in §2 is the target the parity test scores
   against.** The machine-readable form of it lives at
   `eoreader4-eval/essay-backwards.trace.json`.

The order to try them in is 1 → 2 → 3, because each is inert without the one before
it, and 4 is the measurement that tells you whether it worked. If after (3) the loop
reads the essay back as `DEF · CON · EVA · REC · … · SYN · SYN` and not as a flat
`CON · CON · CON`, the resolver is finally realizing the operator the predictor drew
— and the planner, as the docs put it, is the surfer admitting it was always also
the writer.

## 6. The one-line version

We were tuning the renderer and the stop-threshold. The essay says the bug is
upstream of both: **the resolver only knows how to spend ground, and an essay is
mostly made of moves that spend none.** Give the edge-operators a self-register to
work on, hand the model two referents and a relation instead of one span, and stop
counting the essay's life in spans it was never going to consume.
