# Part II — The Generator: the cursor turned forward

*The second half of the arc; Part I is the surprise core (spec-one-surprise.md). This part depends on all of Part I, and on one output of it specifically: `p(next | profile)`, the explicit forward distribution. Generation is that distribution drawn from instead of scored against, realised by the talker, checked forward by the floor, and folded back into the profile. It is the same machinery as reading with the source switched from document to self. This is a skeleton: it names the three unbuilt pieces and what each reuses, not line-level edits, because two of the three pieces do not exist yet and the third is the grounding floor run backward.*

## What is already true after Part I

The draw is free. With `p(next)` a first-class output, sampling it is a generator's first act: the low-surprise draw to stay in frame, a deliberately higher-surprise draw to make a move. Temperature is how far up the surprise distribution to reach, and it is the one real knob — `p(next)` already carries the calibrated surprise (Part I, Track B made it null-relative), so "make a surprising move" is a quantile, not a guess. Music is nearly here for free: a draw over the tonal `p(next)` is already a continuation. Text is not, and the three pieces below are why.

## Piece 1 — The plan substrate (the granularity that stops confabulation)

A draw over the 27 cells alone is too coarse to generate from. "Next is an EVA at the Lens" fixes the move-type and leaves the content open, and an open slot is exactly where the talker reverts to its own priors — thin-structure confabulation, one level up from the reading failures we just fixed. So the plan is two-stage:

1. **Draw the move-type** from `p(next)` at the cell grain — which operator, at which site, at which stance. This is the structural intent.
2. **Resolve it to a proposition** on the referent-and-relation graph — which referents, bound by which relation, at which grain. "EVA at the Lens" becomes the specific *the family holds <Gregor is still Gregor>*. The talker realises that proposition, with nothing left to invent.

The plan substrate is therefore the graph, not the cell distribution. This is why Track D is not optional for the generator: a plan drawn over a basis with no live Significance row carries structure and no meaning, and the engine produces structurally-valid, meaning-shallow text. The plan→proposition resolver is the first unbuilt piece. It is the inverse of the reader's clause→event typing: the reader takes a clause and assigns it a cell and a graph edge; the planner takes a drawn cell and selects a graph edge to realise.

## Piece 2 — The realise loop (the grounding floor, run forward)

Reading checks the talker's prose against the document graph (`factcheck/correspond.js`, the four-way verdict). Generation checks the talker's prose against the **planned** graph-step. Same correspondence, plan in place of document:

- the engine hands the talker one planned proposition, in prose-shaped form, with no codes (the same minimal-prompt discipline as the answer path);
- the talker renders it;
- the floor parses the rendering back into an edge and checks it against the plan — did the prose carry the proposition it was given. A rendering that drifts is the generate-direction twin of an ungrounded answer.

On mismatch the floor re-renders or re-plans, and the rejected rendering is appended beside its replacement (suppress-never-erase, the same `revisions` law). This reuses `bind`, `factcheck/correspond.js`, and `ground/veto.js` wholesale, pointed at the plan rather than the document. The forward handshake — engine emits a plan, talker returns prose, floor adjudicates prose-against-plan — is the second unbuilt piece. We have specced the reading-to-talker answer handshake and been fixing it; this is its mirror.

## Piece 3 — The autoregressive closure (structure unfolding before itself)

The reading loop is open: units arrive from outside. Generation closes it: the accepted unit folds back into the referent profile as the next prior, the cursor advances, `p(next)` recomputes, and the engine draws again. The fold is the one from Part I, with the source switched from document to self. This closure is the thing that makes the engine *experience* the unfolding rather than emit a batch — each step's output is the next step's input, and the engine reads its own becoming at the cursor.

The hazard is the one the grounding-floor doc already named: the engine must not anchor on its own generated unit as ground. The self-generated unit enters the profile read back **with its verdict attached**, the judged assertion, never the bare assertion — the same self-fold weld that doc specs as outstanding. Building the closure builds that weld, because they are one firewall: an evaluation of self orients the next step, never grounds it. REC still fires on accumulated strain, so a generator can modulate its own frame — turn the key, change the topic — when its own output strains the frame it set. That is the generator making a structural move, not a token choice.

## What this does not need

Not a bigger model. The talker stays a small realiser; the engine plans, the talker renders, and that division is the right one — it is what keeps the structure in the engine where it can be checked. Not abandoning the talker for direct symbol-to-text. Not new modalities. The architecture is sound; the gap is these three pieces and nothing larger.

## How we know it works

The decisive control is **generate-then-read parity**: feed the generated output back through the reader and compare the reader's surprise trajectory to the generator's intended one. If the engine planned a low-surprise continuation with one high-surprise move, the reader reading that output cold should measure low surprise with one spike at the move. A match means the generator produced the structure it intended; a mismatch means the plan and the realisation came apart, and the realise-loop floor was too loose. Two supporting controls: a temperature-0 (argmax) generator must produce maximally predictable, coherent, dull structure — the proof that the surprise knob is real and calibrated — and the generated text must pass the reader's own contradiction check against its own plan-graph, because a generator that contradicts its own prior propositions is the self-fold firewall failing in the generate direction.

## The seams, named

The plan→proposition resolver (Piece 1) and the forward floor handshake (Piece 2) are unbuilt. The closure (Piece 3) is the session fold with source=self plus the self-fold weld that grounding-floor.md already lists as outstanding — so building the reader's self-fold and the generator's closure are the same work, done once. Everything else is reuse: `p(next)` from Part I Track A, the null-relative surprise from Track B, the shared referent and boundary layers from Track C, the Significance row from Track D, and the floor from the grounding-floor doc. The generator is not a new engine. It is the reading engine with the cursor turned forward, the comparison replaced by a draw, and the source switched from the world to itself.
