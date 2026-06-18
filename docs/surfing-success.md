# Surfing success — scoring the note, no talker

> The talker is out of the loop. The harness scores the surfaced structured note
> directly, as the artifact, and probes each target from many angles. This is the
> `bench` holon (`src/bench/`), driven by `scripts/surf-bench.mjs` and frozen over
> `data/metamorphosis.txt`.

## The object under test is the note, not an answer

Surfing produces a structured note: a topic-pivoted view of the graph in the notes
register — entity nodes, typed/directed relations, the spans that ground each
element, and the significance frame-turn when the question asks for one. The talker
was only ever a proxy for whether that note was good. Remove the talker and you
score the note directly: harder, because you must say what a good note contains,
but cleaner, because nothing downstream can rescue a bad note or hide a good one.

`surfaceNote(doc, query, { embedder, forces })` (`src/bench/note.js`) builds the
note for one probe over the live spine — retrieve sets the surfer down, the surfer
(`read/surf.js`) widens the window over the field, and the structure surface
(`read/surfaces.js`) folds the graph. It then **pivots to the topic**: the note's
`relations` are the figure → figure edges (the typed, citable claims); the
open-vocab NP-referent edges (`gregor → morning`) ride in `referents`, the
propositional substrate, not the scored note.

## The gold is a note, not an answer (`src/bench/battery.js`)

For each target a gold note is authored once and frozen — not prose, but the
structured content a correct note must carry:

| field | meaning |
|---|---|
| `required.entities` | entity ids that must appear |
| `required.relations` | `{src, tgt, type\|via, symmetric?}` — typed, directed (symmetric matches either way) |
| `required.spans` | sentence indices that must be cited (±2 tolerance) |
| `required.frameTurn` | `{layer?, near}` — a REC near a cursor, for significance targets |
| `forbidden` | entities / relations / tokens that must NOT appear |
| `silence` | `{slot, tokens}` — the text leaves this empty; the note must too |
| `angles` | 6–12 phrasings, incl. a zero-overlap paraphrase and a near-miss **decoy** |

The forbidden lists and silence markers are authored from the first draft, not as an
afterthought: with no talker to smooth over a thin battery, the battery is the
entire definition of success, and the failures that matter most — fabrication and
false certainty — are scored against exactly those fields.

The shipped battery is a **seed** (four targets exercising every scoring channel:
relation recall, entity+relation, significance frame-turn, silence). Extend toward
the spec's 15–30 by adding entries of the same shape.

## Scoring the note, no talker (`src/bench/score.js`)

```
probe score = (recall × precision) × groundedness,   0 if any hard gate trips.
```

- **recall** (coverage) — matched required elements / total required elements.
- **precision** (parsimony) — required-present / present (entities + figure relations).
  Either alone is gameable; only the product is surfacing quality.
- **groundedness** (the gate, a multiplier) — every relation/def element must cite a
  span that supports it (in-stack embedder cosine ≥ floor, or token overlap with no
  embedder). An ungrounded element contributes nothing.
- **forbidden / silence** (hard gates) — a forbidden element, or a fact asserted
  where the text is silent, fails the probe outright. The void marker *is* the
  absence: a silence slot that surfaces no forbidden token is held.

## The angle aggregation, which is the point (`src/bench/aggregate.js`)

```
target score  = mean × consistency,   consistency = max(0, 1 − 2·σ)
battery score = Σ target scores,       admissible only if no hard gate trips anywhere
```

`consistency` is where the multi-angle proof lives: a target that nails the
text-overlapping phrasing and misses the zero-overlap paraphrase scores low
consistency even when the mean looks fine — the signature of a fold that pivots on
surface words, not meaning. A decoy angle is scored against the target it actually
belongs to, so a fold that pivots on shared words to the wrong region fails it and
drops this target's consistency.

## The forces, and where they live in the real system

The spec's forces are real knobs, threaded so the harness can move them:

| force | knob | where |
|---|---|---|
| **the leak** | `strainLeak` | `enact/frame.js`, `enact/loop.js` (via `forces.leak`) |
| **confirm band / thresholds** | `confirmBand`, `thresholds`, `impulse` | `enact/loop.js` (via `forces.*`) |
| **surprise depth** | cheap γ-mass vs meaning reader | `enactedReadingTo` / `enactedReadingMeaning` (`forces.depth`) |
| **confinement window** | `maxDist` / `descMaxDist` / `descGamma` | `parse/coref.js` (via `corefOpts`, now threaded through `createParser`/`ingestText`) |
| **charge / valence** | the role-exclusivity sentinel `areDisjoint` | `read/relation-types.js`, injected at `ingest/text.js` (`rolesConflict: false` turns it off) |

`sweepForce(name, values, base)` runs the battery per value and reports the best
consistency-discounted, gate-clean setting. Charge/valence is **declared, not
swept** — an on/off regression (`chargeValenceRegression`): with the sentinel on, a
bearer already holding `mother` refuses a disjoint `sister`; with it off, the
forbidden bond appears. Surprise depth is read on *which targets fill at all*: the
significance frame-turn should reach full recall only when the richer surprise is
live (under the hash organ the meaning reader falls back to cheap — the firewall).

## Running it

```
npm run bench                                   # baseline battery, per-target + per-angle
node scripts/surf-bench.mjs --sweep leak 0.5,0.9,0.99
node scripts/surf-bench.mjs --sweep confinement 2,20,400
node scripts/surf-bench.mjs --regression        # charge/valence + surprise depth
node scripts/surf-bench.mjs --no-embed          # pure-mechanical (lexical + token grounding)
```

## Caveats — the same as the spec, now sharper

- **The battery is the whole definition.** With no talker, a battery without decoys
  and silences would reward a fold that fabricates confidently. The seed battery has
  both from the first draft; widen it before trusting an absolute score.
- **The in-stack embedder is the hash organ in CI**, a bag-of-words firewall — it
  cannot pivot a zero-overlap paraphrase, so those angles fail and the consistency
  number reflects it honestly. Warm a real meaning embedder (MiniLM) to lift them.
  The harness degrades honestly rather than pretending.
- **The seed corpus is compressed.** In the full novella the sister-epithet and
  Grete's first naming sit ~100 sentences apart, which is what makes the confinement
  window bite; in the compressed corpus they are close, so that particular sweep
  reads flat. The force is threaded and swept; the corpus simply doesn't stress it.
