# The Planner: generation as one act in three faces

> The intuition, stated as an inversion. Stop treating the length of a response
> as the thing to grow and the number of model calls as a cost to hold down.
> Flip it. The number of atoms is the free variable, and the size of each atom is
> driven to the floor. Length stops being a target and becomes a consequence of
> how much ground was covered. Multi-prompt is the norm, even where the model
> could one-shot it, because the easy single-shot answer is exactly where a small
> model uses fluency to paper a gap, and a paper-over is a confabulation. A
> one-sentence answer is a composition that halts after one atom. The base case
> and the general case are the same code.

This spec depends on `spec-generation.md` (the source switch, world to self),
`spec-one-surprise.md` (p(next) as a first-class output), `answerability.md` (the
question-type test), the lens-port spec (the surface port), and the arc
(`generateSection`, `bindAndVeto`, `ceilingFor`). It replaces the loose "two
grains" / "two clocks" picture with the right one, makes one naming correction
the code carries as a conflation (`§2`), and puts a gate in front of the walk that
the system is currently missing (`§3`).

## §1: The planner is the surfer, turned to write

There is no second engine to build. The reader navigates the 27-cell space by
surprise and arrests where the field was rewritten. The planner navigates the
SAME space by the SAME nine operators and arrests where the next deposit should
land. One walks the document. The other walks the answer. Reading is the cursor
scored against the world; writing is the cursor drawn from the self. That is the
`spec-generation.md` source switch, and it means the planner is the surfer with
the supply switched from retrieval to a fold of the conversation plus a ground
pool. `runContinuation` (`longgen/continuation.js`) is already half of this. The
planner is the other half, named and made recursive.

The model is not the generator. It is a rendering coprocessor the planner calls
once per atom, a pure function over a resolved proposition. The planner is the
program. The model is a service it invokes for surface only.

## §2: VOID is a site, not a stop. The correction.

The code carries one symbol doing two jobs, and they are opposites.

**VOID-the-site** is an empty address in the field. The reading carved an
absence: a figure that appeared as an object but never acts, a term with no
filler, a gap the document holds open. It is a real cell-space address, and any
of the nine operators can fire on it. INS on a void mints a figure where the
field had a hole (the gap gets a name). CON on a void bonds toward an absence.
DEF on a void sets terms over what is missing. EVA on a void judges the absence
against the frame ("the document holds this open rather than fixes it"). A
void-site deposit carries Resolution band = void, which propagates through the
scheduler, so a synthesis over it hedges by construction. The move-alphabet's
`VOID` symbol (`movelog.js`, `kind:'void'`) is shorthand for an operator working
the void site. It is a DEPOSIT, not a refusal.

**The flat stop** is a property of the navigation, not an operator. When the
predictor's posterior over moves goes flat (`predictor.js`, `concentration <
FLAT_CONCENTRATION`), there is no grounded expectation of what comes next, so the
navigation declines to deposit. This is the field gone flat, the saturation
stop. It is NOT a move on the cell space. It is the absence of a next move.

The code called both "the predictor's VOID" and stopped with `void:no-expectation`.
Renamed. The site stays VOID. The stop is **quiesce** (the term `think.js` already
uses for the inner-speech train running out of fresh ground). VOID is something
the operators range over. Quiesce is the operators declining to range. Keeping
them separate is the difference between rendering a hedge and rendering nothing.
The loop now stops with `quiesce` (`longgen/continuation.js`).

## §3: The answerability gate (the walk is licensed, not assumed)

A grounded system can still lie, and the lie it tells is not a false fact. It is a
false shape. This is the failure the gate exists to stop, so name it first.

**The worked failure.** A directions question against a corpus that holds an
address, a sentence that the place is seven miles out and reachable by a trail,
and a map link, but no route. The honest answer is one atom: the sources do not
contain the directions, here is the address and the link. What a shapeless walk
produces instead is the three thin spans inflated into sections, "Getting there,"
"Transportation Options," each sentence grounded, the whole thing a procedure that
does not exist, closed by an offer to go deeper on three regions the ground does
not hold either. Every word is real. The shape is invented. The void gate cannot
catch this, because the lie is not at the token grain. It is the gap between what
the question asked for and what the ground can give, papered with grounded filler.

**The gate.** Before the walk, read the question the way a document is read and
TYPE what it wants: a fact, a procedure, a route, a comparison, a definition, a
judgment. Then ask whether the ground can supply THAT TYPE, not whether the ground
holds anything at all. A procedure wants an ordered sequence of steps; does the
field hold one. A comparison wants two figures with an edge between them; does it.
If the type the question wants is not a type the ground can supply, the walk does
not run. The response is the refusal atom and nothing more: the sources do not
contain this, here is what they do hold. `answerability.md` is the home for the
type test, and it stands in FRONT of the navigate face, not beside it. The
system before asked "what is in the ground." It never asked "does the ground answer
the question that was asked." Those are different questions, and the second is the
one that licenses the walk. (`longgen/answerable.js`, `classifyWantedType` /
`groundSupplies` / `answerabilityGate`.)

**The same gate runs on the follow-up offer.** "Want me to go deeper on X" is an
offer to walk again next turn, so it is licensed by the same test. Offer to
develop only the uncovered regions the field can develop. If the ground
holds one sentence about the trail, offering to go deeper on the trail is an
invitation to confabulate next turn, and the gate forbids it. The follow-up
suggestions are drawn from regions the field can support, or none are offered
(`developableRegions`).

The gate is one of three guards on the inflation failure, at three grains: it
stops an unanswerable question from walking at all (`§3`), the saturation
threshold stops a licensed walk from running past its ground (`§10`), and the
significance arc stops a thinly-answerable walk from inflating its shape (`§8`).

## §4: One act in three faces (not three stages)

The grains are not scales on a ladder. They are a ground-figure pattern, which is
to say they are the three faces of the structure, turned on the act of
generating. A face is two of the three positions held against each other, one as
ground and one as figure. There are exactly three pairings of three positions, so
there are exactly three faces, always, and what looks like "more grains under
zoom" is each face opening into its own three positions and pairing them again.

A single deposit is one act seen three ways. Not three steps passed through once.

| face | the pairing | the question | figure / ground | where it lives |
|---|---|---|---|---|
| **Act** (Navigate) | Mode × Domain | *where to go* | the operator firing / the 27-cell space | `surfer`, `predictor`, `structuralPrior`, `direction.js` |
| **Site** (Resolve) | Domain × Object | *which edge* | the specific referents-and-relation / the arrested region | `resolve.js` (the hollow turtle) |
| **Stance** (Render) | Mode × Object | *how it landed* | the surface / the proposition that determines it | `lens-port`, `spurt`, the model |

Read the same deposit three ways. Ask *where* and it is its Act face. Ask *which
edge* and it is its Site face. Ask *how it landed* and it is its Stance face. The
three-face notation already names this: `operator(Site, Stance)`. The spec is to
build the act so that all three faces are real and checkable, not a pipeline that
runs Navigate then Resolve then Render in a line.

### §4.1 Act face: Navigate

The decision: which hole, at which level, by which operator. This is a surfer
arrest, and its physics exists. The reader arrests on Bayesian surprise, the
divergence between what the reading expected and what the world delivered. The
writer arrests on the same divergence pointed at the self: the strain, fed back
through the weld (`§7`). The `structuralPrior` (`predict/structure.js`) already
reads the frame and bends the move distribution. A new figure on the frontier
leans SIG and CON. A term just asserted leans EVA. Strain near threshold leans
REC. The field flat leans toward quiesce. Run that prior forward over the self
move-log and "where to navigate next" is a draw over the nine operators, argmax
to stay in frame or a quantile up the surprise to make a deliberate move
(`direction.js`, the temperature reach).

Inputs: the self move-log so far, the frame state (strain, novelty, flatness),
the covered ground. Output: an operator and an arrested cell, or quiesce.

### §4.2 Site face: Resolve. The one hollow turtle.

The decision: which edge on the referent-and-relation graph realizes the arrested
operator. "EVA at this site" becomes "the family holds <Gregor is still Gregor>",
a specific judgment over specific referents bound by a specific relation. This is
the inverse of the reader's clause-to-event typing. The reader takes a clause and
assigns it a cell and an edge. The resolver takes a drawn cell and SELECTS an edge
to realize. It is the distinct middle act, neither a navigation nor a render.

`resolve.js` before drew the operator and then threw it away and grabbed the next
salient uncovered span. So the predictor said EVA and the renderer got a CON, and
the output read as a list of grounded sentences because that is what it was. The
resolver now honors the operator:

- the arrested operator names a triad and a stance (assert, evaluate, synthesize,
  restructure, instantiate, segment, hold-terms, register, hold);
- `figureSurface` already returns a referent's incident edges, coref-collapsed and
  weight-ranked, in surface form. The resolver selects the edge that realizes the
  operator at the arrested cell: a CON takes the strongest unspent leaving edge; an
  EVA takes a term the frame asserted and a particular to test against it; a SYN
  closes a holon over constituents that have fired and promotes it; a REC takes the
  strained frame and the figure that breaks it; an INS on a void names the gap;
- the resolved proposition rides as the sub-claim, with its spans as the only thing
  the floor will let the unit cite.

Inputs: the operator, the arrested cell, the graph, the covered set. Output: a
renderable proposition, grounded on its spans, carrying the operator it realized
and its resolution band. VOID-the-site is a legal input here (an operator on an
empty address). Quiesce never reaches here, because there is no operator to resolve.

### §4.3 Stance face: Render

The decision: the surface. And it is barely a decision, because the resolved
proposition plus the grammar plus the void gate have nearly determined it. The
model renders one proposition with a small read-window for the seam (`§5`). The
lens-port leans, at high-entropy positions only, toward the figures the plan made
salient, and forbids, at every position, the names and numbers the ground does not
hold. The planner does not pick surface tokens. The proposition picks them, and the
port keeps the picking honest. This is the Mode-against-Object face: the act
against the thing it produces.

Inputs: the proposition, the fold, the read-window, the lens config. Output: one
witnessed atom (text, sources, bound-fraction, vetoes, the operator it realized).

## §5: How a paragraph holds (coherence is a property of the plan)

A paragraph is never made coherent at render time. The model only ever sees one
atom. So coherence is built into the order the atoms are rendered in, and four of
its five mechanisms are decided before any model call:

- **the referential thread** is Centering off the frontier. The frontier knows
  which figures appeared and which is the current center, so the cursor hands the
  model the referring expression ("refer to this one as `it`"), it does not ask the
  model to choose it. Centering buys LOCAL coherence only; global shape is `§8`.
- **the thread itself** is spreading activation (`think.js` `migrateFocus`). The
  next focus is the most-activated figure the last atom reached and has not been
  spoken from. Atom k opens on what atom k-1 touched, so the paragraph walks a
  connected path instead of jumping.
- **the order** is the surfer walk plus the arity gate (`scheduler.js`). A relation
  cell is not schedulable until its arguments are on the frontier, so the dangling
  reference (the "it" with no antecedent) cannot occur.
- **the transitions** are typed moves, never improvised. The relation between two
  atoms is an operator (CON, EVA, SYN, REC, a contrast), so the connective is
  realized from the move and grounded the same way the claim is. Flow the engine
  planned cannot lie. Flow the model invents can.
- **topical unity** is one fold and one reach. The atoms are drawn from one region.

The fifth mechanism is the model's, and it is the read-window. The render of atom k
sees a few prior atoms (already witnessed, NOT bound again) so it can open with a
real transition, and generates only atom k. Reading for cohesion is not generating
for ground. That split is the whole difference between a list and a paragraph at the
surface. Not bigger atoms. Each atom rendered with a short memory of the ones before
it and a planned relation to them.

## §6: The prompt contract (what the model receives)

One atom, one prompt. Each prompt is a stable prefix and a small volatile suffix,
and the split is the caching constraint of `§9` made concrete (`longgen/prompt.js`).

The **stable prefix**, identical on every call in the turn so the prefill caches:

- a short system frame: you are a writer, render exactly what you are handed, add
  no facts, introduce no name or number that was not given.
- the fold: the running situation, a compressed recap of what has been said and
  which figures are in play (`foldConversation` notes).

The **read-window**, the semi-volatile middle (it grows one atom at a time): the
last sentence or two of prose already written, so the new sentence opens with a
real transition instead of cold. The window atoms are already witnessed and are
context for the seam only; they are not bound again.

The **volatile suffix**, small and LAST, so the cache hits on everything before it:

- one proposition in prose-shaped form: a subject, a relation, an object, a band,
  and the verbatim source line. In plain terms, "write one sentence saying the
  Partnership commissioned the report; refer to the Partnership as `it`, since it is
  established; here is the source line; this is firm, state it plainly." A void-site
  atom reads "write one sentence saying the document holds open whether X; do not
  assert it; here is the line."

The model never sees the graph, the operators, the cell names, or the plan. It sees
a frame, a recap, the tail of the prose, and one small instruction with its source.
It writes one sentence, which is bound against its source line and truncated,
regenerated once, or dropped on drift. Then the next prompt: same frame and fold, a
slightly longer tail, the next proposition. The model does the easiest possible job,
repeatedly, with the hard decisions already made. No operator code and no cell name
ever enters the model-facing prompt; that is the discipline the lens-port and the
prompt assembly share.

## §7: The weld is the closure (Stance becomes the next Act's ground)

The faces close into a loop, and the loop is the weld. The Stance face of deposit k
becomes the ground for the Act face of deposit k+1. Concretely: the floor's verdict
on the rendered atom (`bound-fraction`, vetoes) is read back as the strain the next
navigation rides. `strain = 1 - boundFraction`. A clean atom keeps strain low and the
routine body of generation continues. A drifted atom raises strain, and the
structural prior leans the next draw toward REC (restructure) or toward quiesce
(stop). The engine that starts to confabulate raises its own strain and stops itself.
(`direction.js` `selfMoveLog`, tested by the weld test.)

The firewall (`me-ness`, `think.js`): the self-generated atom enters the next step's
profile WITH ITS VERDICT ATTACHED, the judged assertion, never the bare assertion.
An evaluation of self orients the next step. It never grounds it. The system must not
anchor on its own output as if it were the world. This is what keeps the closure from
becoming the self-corroboration loop the whole provenance stance exists to break, and
it is why the fed-back signal is the EXTERNAL grounding verdict, not the model's own
confidence.

The weld is not feedback between stages. It is one face of a deposit becoming another
face of the next deposit. That is the recursion closing.

## §8: Shape: the significance arc, not a canon

The temptation is a canon of response shapes: comparison goes two-sided, explanation
goes general-then-instance, argument goes claim-evidence-rebuttal, match the question
to a shape and fill it. This is McKeown's schemata, and it was built and abandoned,
and the reason it was abandoned is the reason it would fight this system. A schema is
a shape chosen from outside the field and imposed on it. The stance here is that
structure is read off the field and never chosen by a router. Witness does not decide.
A canon is a router. It pre-commits the answer to a form before the reading has said
what is there, and it gives you two sources of structure, the field and the shelf,
which will disagree. Worse, a canon assumes the shape lives in the question, but in a
corpus-grounded system the shape is a fact about what the documents hold. Ask to
compare two reports where one is rich and one is a stub, and the balanced two-sided
shape is a lie the field knows is false. A canon supplies a shape the evidence does
not earn, which is the structural-lie failure of `§3` imported on purpose. A canon is
a void gate run backwards.

So no canon. One arc, derived (`longgen/shape.js`). Open by setting terms, develop,
land. DEF or an orienting INS, then CON and EVA through the middle, then SYN to close.
That is not a genre. It is the DEF-EVA-REC cycle, the significance row's intrinsic
order, the shape any reading takes when it sets terms, tests them, and holds or
restructures. It is not matched to the question. It is what the significance row does
when it arrests. The variety a canon would have supplied falls out of which operators
the field offers. A field with a contrast edge between two figures produces a
comparison, because the surfer keeps arresting on the contrast. A field with one
figure and a deep attribute stack produces an explanation, because the walk keeps
developing the one figure. The shape is not selected. It emerges, earned by the
evidence rather than matched to the phrasing.

The arc is the floor on thin answers. An opening with no development and no close is
just an opening, which is the honest one-sentence answer. A flat walk has no floor on
shape, so it pads (the `§3` failure). The arc has a floor, because it must land on
something, and when there is nothing to land on it collapses to the term-setting atom
and stops. Shape is not only what makes a long answer hold together. It is also what
makes a thin answer stay short.

The recursion is the arc at two grains. Surf coarse and the significance arrests are
the response shape, the open and the turn and the close. Surf fine inside each arrest
and that walk is the sentences. The base case is a resolvable proposition; the
recursive case is a region that still needs developing. Same act at every grain.
This is the recursion McKeown found in text structure, falling out of the helix
rather than bolted on. The difference from a canon: the schemata were a fixed library
applied top-down; the arc is one cycle derived from the operators and applied at
whatever grain the field has structure.

## §9: The two clocks (cost, caching, speculation)

The faces run on two clocks. Navigate and Resolve are symbolic and cost almost
nothing per atom. Render is the model call and costs everything. So:

- **prefix caching is a hard constraint on prompt assembly.** The stable prefix of
  `§6` must not change between atoms, so the prefill is cached and you pay only for
  the volatile suffix. The one proposition being rendered goes last, always. Get this
  wrong and multi-prompt is too slow to live. (`longgen/prompt.js` exposes the
  prefix/suffix split and a `prefixCacheKey` over the invariant part.)
- **speculate across the weld.** The next move depends on this atom's verdict, so the
  chain is sequential, but most atoms bind and drift is the exception. Resolve the next
  move on the assumption of a clean verdict, render it in parallel with witnessing the
  current one, and roll back only on a high-strain verdict. Speculative decoding lifted
  from the token to the atom. The strain feedback stays exact; you stop waiting on it
  when you do not have to. (`speculateNext` resolves the next proposition symbolically
  — the free half; the model-render overlap is the conservative remaining seam.)

## §10: The stop replaces length

Length used to be a number you set. Now it is: deposit atoms until the ground
saturates. The stop logic (uncovered mass below `EPSILON`, the next spans too
overlapped to add coverage `NOVELTY_FLOOR`, or the predictor quiescing) is no longer
a backstop. It runs on every turn and determines every response's shape, so it has to
be calibrated and right. Too eager loses recall (the honest-but-short failure on real
ground). Too patient runs past the evidence into the drift the weld then has to catch,
and the inflated directions answer of `§3` is what too-patient looks like in the wild:
three thin spans stretched into sections because the threshold kept depositing past
the point where the evidence ran out. This threshold is the single knob that now does
what a length target used to do, and it is the first number to measure. The longgen
loop reads it each step (`saturationStop`, exposed as `epsilon` on `runContinuation`).

## §11: The settings toggle (planner on, planner off)

The planner trades fluency for grounding, and whether the trade is worth it is
empirical, not assumable. Each atom is rendered in isolation with the structure
pre-decided, so it cannot lie, and it also cannot flow the way a single free
generation flows. If the resolver picks awkward edges or the atoms run too small, the
output reads stilted, correct sentences that do not breathe. That is the
classical-pipeline gap, the planner specifying what the model cannot say naturally, and
it is a real risk. So the planner is a setting, not a baked-in default.

Two modes (`longgen/generate.js`). Planner ON: multi-prompt, grounded, every claim
witnessed, the answerability gate and the arc and the weld all running. Planner OFF:
the plain path, one prompt, the model writes the whole answer, with the void gate still
running underneath so it still cannot invent a name or a number. Run the same questions
through both on a real document and read them side by side (`compareModes`). If the
planner reads stilted and the plain path reads fine and stays honest because the gate
held, the planner is not worth its cost yet, and you ship the plain path with the gate.
If the plain path inflates or confabulates structure and the planner reads almost as
well while fully witnessed, the opposite. The toggle is the measurement. Default it off
until the measurement says on, and leave it as a reader's choice between flow and
proof even after.

## §12: What is built, and the seams

Built: the surfer (`surfer/surf.js`), the predictor and structural prior
(`predict/`), the self move-log and strain weld (`longgen/direction.js`), the floor
(`arc` `bindAndVeto`, truncate/regenerate/drop), the scheduler with the arity gate and
resolution propagation (`write/scheduler.js`), the Centering thread and spreading
activation (`write/think.js`, the cursor), the void gate and entropy-gated lens-port
(`write/lens-port.js`, `write/concept-tokens.js`).

The seams, in priority order, and where they now live:

- **The Site-face resolver** (`§4.2`, `longgen/resolve.js`). Operator-and-cell to
  graph edge. Until it holds, the planner draws moves it cannot realize, and the
  output is a walk over spans. Once it holds, the planner is the surfer admitting it
  was always also the writer.
- **The answerability gate** (`§3`, `longgen/answerable.js`). The `answerability.md`
  type-test in front of the navigate face, and the follow-up offer gated by the same
  test. Independent of the resolver, so it shipped first.
- **The significance arc** (`§8`, `longgen/shape.js`). The coarse walk arrests on the
  significance row so a response opens, turns, and lands, and a thin answer collapses
  to one atom.
- **Prefix caching and atom speculation** (`§9`, `longgen/prompt.js`). The cost work
  that decides whether multi-prompt as the norm is fast enough to be the norm.
- **The saturation threshold** (`§10`, `arc/saturation.js` + `runContinuation`). The
  one number that now sets response shape.
- **The toggle and its measurement** (`§11`, `longgen/generate.js`). The plain path
  with the void gate as the default, the planner behind the flag, the side-by-side as
  the decision.

## §13: How we know it works

The controls, in the house style (`tests/planner.test.js`):

- **unanswerable questions refuse.** A question whose wanted-type the ground cannot
  supply must produce the refusal atom and nothing else. The directions-against-no-route
  case is the unit test, and the inflated sectioned answer must not reproduce under the
  gate. The follow-up offer must propose only developable regions.
- **thin ground produces a thin shape.** The arc must collapse to one atom when there
  is nothing to develop. Same directions case: under the gate and the arc the response
  is one sentence plus the link, not three sections.
- **stops on its own.** Given finite ground, generation halts by saturation or quiesce,
  never by a token count. The length-trace records which, per run.
- **the operator is realized, not discarded.** Feed the generated text back through the
  reader and check that the move it reads at each atom matches the move the planner
  drew. A mismatch means the resolver let the realization drift from the plan (the
  `spec-generation.md` generate-then-read parity control, applied per atom).
- **drift raises strain.** An injected drifted atom must push the next prediction's mass
  toward REC or quiesce relative to a clean atom. The weld firing, unit-tested.
- **the arc is real.** A temperature-0 plan must produce a maximally predictable,
  coherent, dull paragraph (the proof the surprise knob is calibrated), and a plan with
  a significance-row arc must read as opening, developing, and landing, not as a list.
- **coherence is plan-time.** Pronoun thread, order, and transitions must hold under a
  stub renderer that only collapses the cursor's surfaces, with no model cleverness, so
  the coherence is shown to live in the plan and not in the model.
- **the floor cannot erode.** Over a long session the void gate's ratchet tightens and
  never loosens under repeated model pressure (the lens-port hysteresis control).
- **the toggle is honest.** On the same questions and document, planner-off with the
  void gate must never invent a name or number, and the planner-on output must be at
  least as faithful. The side-by-side is the record that decides the default.
