# The answer expectation — predicting the answer, then error-correcting toward it

> A truthful model would start answering, stop when it notices it is off, and begin
> again — and you should be able to watch it do this. Sometimes it realizes it is
> answering *poorly*; sometimes it realizes it has the *wrong* answer.

## The gap this closes

The engine had a rich model of **how it read** (the surf, terrain, bands, stance,
referential confidence) and of **whether a claim is witnessed** (bind → factcheck →
veto). It had almost no model of **what the question wants back**. The whole "what does
a good answer look like" budget was a four-way task tag (`intent.js`:
answer/summary/list/explain) that set a token ceiling and a faithfulness guard, nothing
more.

So a turn could be fluent, on-topic, grounded-adjacent, and still **not answer the
question** — and nothing noticed. The worked failure: *"what is her name?"* answered
with a personality sketch that never says **Grete**, while the name sits in the source
24 times and the reader's own coref had already folded *his sister → Grete*. Every gate
passed; the only flags were about grounding, never about responsiveness. The system was
optimizing **provenance**, not **answerhood**.

## The predictive-processing frame

Comprehending a question already instantiates a **typed answer-slot**, before any
content arrives. *"What is her name?"* predicts a single proper noun, short, standing in
an "X is named ___" relation to the figure in focus. A good answer is the one that
**fills that slot and discharges the prediction error the question opened.** "Knowing
what a good answer looks like" is not a separate faculty — it is the question's own
forward model with an unfilled variable.

That reframes the three pieces:

- **Predict** — `expect` (turn/expect.js). The question, read as the shape its answer
  must take, with a **precision**: how sharply it types the answer. A name question is
  high-precision (almost nothing but a proper noun satisfies it); a summary is
  low-precision (many answers are acceptable). Tip-of-the-tongue is the proof the slot
  is separable from its filler: you can know *a name is missing* without recalling the
  name.
- **Error** — `answerSlotError`. The prediction error: does the produced answer fill the
  slot? For a name slot, when the reading resolved the referent's proper name, the answer
  must *give that name* — the knowledge the answer path used to discard. An honest
  abstention ("I did not find her name") **fills** the slot: reporting the typed gap is
  the correct terminal, not a miss to retry.
- **Correct** — the `revise` loop. A shape miss now joins the confabulation and §5
  grounding triggers as a reason to **stop and answer again**, with a corrective that
  hands the talker the resolved name when the engine has it. Each superseded draft is
  preserved beside its successor with a plain `why`, so the audit shows the engine
  catching itself: *start, stop when off, begin again.*

When the correction cannot land (the lines truly do not name her, or no model is
present), the unmet slot ships as the `answer-shape` veto — the prediction error the
engine could not discharge, **told to the user rather than hidden**. Predict → error →
correct → report the residual is the same loop the reading side already runs on the
page; this points it at the reply.

## Precision, not a flat rule

Only a high-precision slot (`name`) gates a restart. `who` is detected but flags only — a
role-only identity answer can be acceptable, so a miss there is told, not retried.
Everything that does not type its answer sharply is `OPEN` (precision 0): no slot, no
gate, byte-identical to the prior pipeline. The same calibration the grounding floor
already carries (`GROUNDING_FLOOR` per task) — a direct answer is held tightly, a
synthesis loosely — now extends to *whether the answer is even the right kind of thing*.

## Where it lives

- `src/turn/expect.js` — `expectAnswer` (the prediction) and `answerSlotError` (the
  error signal). Pure, embedder-free; the name check reuses `namedReferents`, the same
  admitted-figure matcher the fold turns on.
- `src/turn/stages.js` — the `expect` stage; the shape trigger folded into `revise`
  (which resolves the referent read-only, even with `RULES_REV` off, so it can use the
  name the engine *can* resolve); the `shapeCorrective`.
- `src/ground/veto.js` — the `answer-shape` flag for the residual.
- The audit carries `expect` (slot · precision · gates) and, per revision, the `why`.

## What is deliberately left

The slot vocabulary is two entries (`name`, `who`) plus `OPEN`. The frame generalizes —
a count question predicts a number, a when predicts a time, a list predicts an
enumeration of a known cardinality — but each new slot is a new predicate with its own
error signal, added only where the check can be made honestly. The point proven here is
the *loop*, on the sharpest case.
