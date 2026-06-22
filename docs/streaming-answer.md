# The Streaming Answer — the write loop, turned onto the answer path

The grounded answer used to be drawn in one shot — `turn/stages.js` `llm` called
`model.phrase()` once over the whole reply, and `bind` / `factcheck` / `revise`
annotated the block after the fact. The writer already does the better thing:
`write/spurt.js` `writeLoop` realises **one beat per cell**, folds each beat back,
and reads the seam where the model surprises itself — but that loop only ran in the
writer demo and the idle loop, never on an answer.

This routes the answer through that loop. The answer becomes a sequence of grounded
sentences, each aware of the ones behind it (the fold) and carrying a prediction of
the one ahead (the predictor) — **streamed so seamlessly the seams do not show.**
The reader sees one flowing answer; the substrate sees a fold advancing one beat at
a time. And each beat is **frame-aware without the talker knowing it** (§8): the
substrate measures what kind of site the beat falls in — opening ground, the salient
turn, the relation drawn across — and shapes the sentence to fit, while the talker
only ever sees "write one sentence that does *X*."

It is not a new engine. It is `writeLoop` pointed at the retrieval subgraph instead
of a hand-written cell DAG, with a streaming surface laid over it. Everything
load-bearing already existed; the four built seams are named below.

## The opt-in surface

The path is **off by default** — the present one-shot answer, chat, and golden
gated-speech paths are byte-identical when streaming is not requested
(non-breaking by construction).

```js
runTurn({
  question, doc, model, embedder, auditLog,
  stream: true,                 // arm the streaming-answer path
  onToken: (piece) => ui.append(piece),   // the live surface, left to right
});
```

When `stream` is set, the turn is grounded, a surfer path exists, and spans were
retrieved, `turn/stages.js` `llm` realises the answer through `streamAnswer`
(`write/answer.js`) and emits tokens through `onToken` as they decode. The emitted
draft becomes `rawOutput`, so the downstream `bind` / `factcheck` / `veto` stages
annotate it exactly as today. Any precondition absent → the single `phrase()` runs
instead.

## The four seams

Everything else is reuse (the scheduler's resolution propagation, the cursor
membrane, the witness, `surfDraft`, the predictor, the phasepost band partition).

### 1. `stopToCell` — the span→cell resolver (`write/plan.js`)

The plan is read off the physics, not authored. The `fold` stage already runs the
surfer over the retrieved subgraph and returns `surf = { stops, peak, focus, field,
recCursors }`; the surfer arrests where the reading was **rewritten**, so its stops
are exactly a beat order — **each stop is one sentence.** `stopToCell` is the
inverse of the reader's clause→event typing:

- the stop's focus figure → the cell's **Subject** (its integral name from the fold);
- the strongest **unspent** edge leaving that figure within the reach → the cell's
  **edge** (`A --tends--> B`) — read off `figureSurface`, which already returns a
  referent's incident bonds coref-collapsed and weight-ranked in surface form;
- the edge's Resolution band (void when a modality hedges it or a carved absence
  shadows the subject) → the cell's **band**, so a void stop **hedges before it is
  written**, never after;
- the lines the edge and the stop were read from → the cell's grounded excerpts.

A stop whose only leaving edge is already spent falls back to an **orienting beat**
— still grounded on the stop's own line, never a forced repeat or a forced claim
(the FIRM-ONLY law applied to the answer).

### 2. The streaming renderer (`model/stream.js`)

`streamPhrase(model, messages, { onToken })` is `phrase`'s streaming sibling — the
same optional-capability shape as `propose`. A backend that decodes token-by-token
(wllama, and the echo/stub test backends) calls the handed `onToken` per piece; one
that cannot ignores it, and `streamPhrase` falls back to **draw-then-emit** (the
whole beat emitted once). The loop runs either way; the only loss is that the gap
between beats becomes one sentence's latency instead of none. The returned beat text
is the canon the witness binds; the streamed pieces reconcile to it exactly.

### 3. The inter-beat fold/predict surfacing (`write/answer.js` `predictForward`)

After each beat the fold advances (`advanceFold`, now exported from `spurt.js`) and
the predictor reads the **next** move forward: a minimal move-log is built from the
realized cells' ops and the surfer's per-cursor surprise, and `predictNextMove`
returns `p(next move)`. A flat posterior is surfaced honestly as the predictor's
VOID — "the reading sets up no strong expectation here" — never a guessed move.
Reuses `predict/predictor.js` wholesale; the work is the plumbing.

### 4. `frameAt` — the piece-grain frame (`write/frame.js`)

The Ground / Figure / Pattern triad (`classify/bands.js`), raised one grain: run over
the **answer so far** instead of a single clause. The site is **emergent**, read off
the same scalar the surfer rode and cannot disagree with it:

- early, the integral mass is thin → opening beats measure into **Ground**;
- the steepest stop (`surf.peak`) is the salient move → **Figure**;
- after the turn, and at a REC firing under accumulated strain → **Pattern**.

"Hook → bona fides → turn → land" is the human's *name* for this trajectory, not its
cause. The frame **conditions the cursor's surface only** — its posture, a
plain-words target ("open the ground here", "make the move", "draw it together"), its
budget. It never emits a typed edge, and the site name never reaches the talker (the
same surface discipline that withholds codes and indices). It is a posterior: above
a floor it commits a position; on a flat field it holds at no-commit and the cursor
falls back to a neutral posture.

## The disciplines carry unchanged

- the **witness** owns every factual bind, **per beat** — its retractions are
  surfaced beside the kept beat (`flag-and-tell`), never substituted for it;
- **void** is held open per stop and *before* the beat (prospective hedging), so the
  hedge is a posture at the cursor, not a rewrite after;
- **suppress-never-erase** is upheld by **never un-streaming**: a streamed beat is
  never retracted on screen. A drift the seam catches re-orients the *next* beat (a
  plain-language correction carried into the following cursor); the false word is
  never unwritten. The block-rewrite `revise` stage is therefore **retired on this
  path** (`if (ctx.streamed) return ctx`) — it would un-stream tokens already seen;
- the **membrane** holds: `buildCursor` asserts no hashId reaches the model, per beat.

**The asymmetry** (load-bearing): model *uncertainty* (a fired seam) may re-orient
the cursor; model *confidence* may never certify a claim or suppress the witness.
Attention yes, certification no.

## How we know it works

`tests/model-stream.test.js`, `tests/write-frame.test.js`, `tests/write-plan.test.js`,
`tests/write-answer.test.js` cover the four seams and the integration. The decisive
properties:

- **the seam never shows** — the token stream reconstructs the draft exactly, with no
  newline, double space, or index at any join;
- **one beat per stop**, each bound backward by the witness, no hashId in the draft;
- **the frame walks Ground → Figure → Pattern**, read off the field;
- **`p(next move)` rides each beat**, with the predictor's VOID surfaced as a flat
  posterior;
- **a void stop hedges before it is written**; an ungrounded beat is flagged, not
  removed;
- **non-breaking** — without `stream` the turn sets no streaming telemetry and the
  one-shot answer is unchanged.

Deferred (the spec's §9 validation harness, not the mechanism): *generate-then-read
parity* — feeding the streamed answer back through the reader and matching its
surprise trajectory to the generator's planned arrests — and the matching *frame
recovery* read. The mechanism those tests would grade is built here.
