# The Cursor Predictor — predicting the next move, testably

A grounded structural predictor over the **next move**, not the next word. Move the
cursor, see the prediction; the prediction is over the next operator-move, computed
from the log — no model call, no ingested corpus. This is the grounded predictor,
the counterpart to the open, model-driven prediction in `src/read/predict.js`.

- engine: [`src/predict/`](../src/predict/)
- testable surface: [`scripts/predict-moves.mjs`](../scripts/predict-moves.mjs)
- worked example: [`data/esker.txt`](../data/esker.txt) — the Esker story
- tests: [`tests/predict.test.js`](../tests/predict.test.js)

## 1. What is predicted

Not the next word. Not the next sentence. The next **move** — an operator firing on
a Site with a Resolution, the triple the system already speaks (`core/address.js`).
The vocabulary is the nine operators plus VOID (a DEF-to-VOID, the asserted
absence), so the prediction space is **ten symbols**, enumerable and small:

```
NUL  SEG  DEF  SIG  CON  EVA  INS  SYN  REC  VOID
```

That smallness is the whole reason this can be grounded and cheap. You are
predicting which move comes next in a grammar of ten, conditioned on the moves so
far — not the next token in all of language.

## 2. The move-log (Phase 0)

Reading a text emits operators in order, from two registers, and the move-log is
their honest union in reading order (`movelog.js`):

| register | what | operators |
|---|---|---|
| **content** (depicted) | what the reader perceives in the text | INS, SIG, CON, DEF, SEG, SYN, NUL, VOID |
| **enacted** (cognition) | the reading's own act — establish terms, test them, restructure | DEF, EVA, REC |

The enacted stream is the `DEF→EVA→…→REC` cycle of the significance engine
(`enact/loop.js`), single-layer for one clean evaluation per cursor. The union is
ordered by `(cursor, register, generation)`: at each unit the reader first perceives
the line's content, then its cognition tests the frame. The result is a flat array
you index by position — **move `i`, predict move `i+1`** — recomputed causally at
each step.

Dump it: `node scripts/predict-moves.mjs --dump`.

## 3. Why this is grounded, not the LLM

The next move's probability is a fusion of two grounded priors and one small learned
one — the same three-prior structure as the talking spec, but over moves not tokens.

**Recurrence**, from the log (`recurrence.js`). An n-gram over the ten-symbol
alphabet, fit *online* from this reading's log up to the cursor: given the recent
moves, what has tended to follow earlier in this same reading. Bigram interpolated
with the unigram, add-α smoothed so every symbol keeps a floor — the reserve for the
as-yet-unseen. This is the recurrence/persistence baseline: cheap, no model.

**Structure**, from the fold (`structure.js`). The active frame shapes which move is
licensed next, read from the log state at the cursor — no model:

- strain near threshold (right after an EVA) → **REC** becomes probable, the break is coming;
- a flat figure field (low γ-mass surprise, nothing entering, no strain) → **NUL / VOID**, hold or assert absence;
- a figure just entered → **SIG / CON**; a term just asserted → **EVA**.

**Grammar**, small and learned once (`grammar.js`, `grammar-data.js`). The operator
grammar's own regularities — the canonical cycles, which moves can follow which — as
a bigram transition matrix over the ten symbols, learned **once** from a held-out
text (`data/metamorphosis.txt`, never the text it predicts) and frozen. The only
learned component, bounded by the size of the operator grammar. Regenerate with
`node scripts/learn-grammar.mjs`. It recovers the real cycle: `REC→DEF` (a
restructuring installs a new frame), `CON→EVA`, `SEG→CON`, `EVA→INS`.

The posterior is their **product, normalised** — a weighted geometric mean, so a
weight of 0 drops a prior cleanly (the controls run recurrence-only, or
recurrence×structure). None needs an ingested corpus: the prediction is over a
ten-symbol grammar conditioned on a log you already have.

## 4. The testable surface — move the cursor, see the prediction (Phase 3)

```
node scripts/predict-moves.mjs            # interactive: n / p / g <c> / q
node scripts/predict-moves.mjs --all      # the panel at every cursor + summary
node scripts/predict-moves.mjs --cursor 118
```

At the disowning's frame break (Esker, the planted boundary), the panel reads:

```
predicted next move  (posterior over the moves):
   REC   0.93  ██████████████████████··
   INS   0.06  █·······················
   posterior sharpness: 0.93   concentration: 0.87   (confident)
actual next move (read from the log at c+1):
   REC(Int,Pat)   ✓  (predicted top-1)   — break along Esker, Winter (accumulation)
surprise: low    (actual was the predicted mode;  0.10 bits)
```

Two readouts make it a test, not a demo: **predicted-vs-actual** at each cursor
(accuracy of the structural predictor) and **posterior sharpness** (the predictor's
own confidence). The recompute is strictly causal — the prediction at `c` uses only
moves up to `c`, never the future — so you can scrub back and forth and watch the
prediction be right, be wrong, and be surprised, move by move.

The same panel lives in the browser app as the **Predict tab** (beside Feed):
`src/ui/predict-view.js` builds the move-log from the loaded document and renders the
scrubber — a slider, prev/next, quick-jumps to each frame break and to the flattest
posterior, and the collapsed controls battery. Load a document, open Predict, and
drag the cursor. The move-log is built once per document; scrubbing is a single
`predictNextMove` call per step.

## 5. NUL, VOID, and the predictor's own abstention

Two of the moves are NUL and VOID, so the predictor must be able to predict its own
abstention — the property that keeps it honest. On a flat field the structural prior
puts mass on **NUL / VOID** (the engine expects to find nothing here): in the worked
example the structural NUL+VOID mass is **~37× higher** on flat units than on active
ones. And when the three priors disagree and no move dominates, the posterior goes
**flat** — low sharpness, low concentration — which is the predictor's VOID: it
declines to commit rather than emit a confident wrong move. The flattest posteriors
land exactly where they should — right after a part-divider NUL, right after a REC
(what follows a restructuring?), at the opening before any context.

## 6. The controls (Phase 7)

`node scripts/predict-moves.mjs --controls` (numbers from the Esker worked example):

| control | result |
|---|---|
| **persistence** (next = last move) | 13.6% |
| marginal (always the commonest op) | 30.3% |
| **recurrence only** (bare n-gram) | 56.8% |
| **FULL** (recurrence × structure × grammar) | **64.4%** |
| **shuffle** (scramble the move order) | → 23.3% — collapses to chance |

- **Persistence / recurrence baseline.** The frame-aware posterior beats the bare
  n-gram (+7.6 pts). If it did not, the structure would be inert — a real finding.
- **Shuffle.** Scrambling the move order collapses accuracy to the marginal floor:
  the predictor reads the *sequence*, not the operator frequencies.
- **REC test.** REC probability climbs with strain and is sharp-and-right at the
  strongest break (the disowning, strain 1.3× threshold → REC p=0.93, top-1). A
  predictor that nails the routine and is blindsided by every REC has learned the
  easy part; this one sees the break coming from the accumulated strain.
- **VOID test.** It predicts NUL/VOID on flat fields and the posterior flattens at
  genuinely unpredictable points — it can predict its own abstention.

## 7. The cheap reader's localisation lag

The strain that drives the enacted REC rides the modelless γ-mass surprise
(`enact/index.js`), which spikes on a new *figure* and is comparatively blind to a
tone shift that introduces no new name — the documented limit the meaning reader was
built to fix (`enact/meaning.js`). The disowning introduces no new figure, so its
break is localised a few lines *after* the literary climax: the strain ramps through
the renunciation and crosses threshold at the next strong line. The predictor still
**anticipates** it — REC probability rises across the high-strain run-up before the
REC fires — which is exactly what the REC test asks. With the meaning reader live
(an embedder that measures meaning), the same machinery sharpens the localisation
with no change to the predictor.

## 8. Realization is a separate stage (Phase 4)

This holon predicts the **move** and is tested on it alone — predicted vs actual,
surprise, sharpness — *before any word is rendered*. The realizer that turns a
predicted move into prose is a deliberately separate second stage, built and tested
only once move-prediction is grounded and sharp where it should be. A bug in
realization should never be diagnosable only through a bad sentence: you want to see
that the move was right and the sentence wrong, or the move wrong and so the
sentence, separately. The cursor panel shows the move; the realizer is a second
panel that renders it. Two stages, two tests.
