# exp-0008 — EVA: the reading made defeasible

## Pressure
exp-0007's honest limit was a reading that **could not lose**: a REC prior kept mis-holding
on a stream the world had moved past, because nothing *evaluated* it. The cube names the
missing cell — **EVA** (Relate × Interpretation, "evaluate → reinforce or strain"), the
`eva(kind, token, holds)` of the DEF·EVA·REC ledger. Build it, and close the loop.

## What the deep test found first (the honest turn)
The obvious hypothesis — EVA improves online *segmentation* — **failed**, repeatedly and
informatively. On every drift/replacement stimulus, SYN (blending) and INS (birth) already
handled the boundaries; EVA's defeat never bit, because **SYN's accommodation pre-empts the
strain**: a reading that freely blends to fit whatever it is fed never fits *poorly* enough
to strain. The fix (support = conviction = resistance to blending) narrowed but never gave
a clean boundary-F1 win. The lesson: **EVA is not a segmentation operator.** SEG (`voidPeaks`)
finds boundaries; SYN/INS birth and merge; **EVA is a LEDGER operator** over a reading's
`{support, strain}` — it governs the reading's *lifecycle*, which the boundary metric cannot
see. That is where the repo's own EVA lives too: a convention's support/strain, not a cut.

## Claim (held in `key.json`)
`evaluate(ledger, fit)` reinforces a reading that keeps fitting and strains one that stops;
the reading is **defeated** when strain overtakes support. The γ-leak makes both accumulators
forgetful, so a **transient** blip strains without defeating, but a **sustained** drift crosses
over. This makes a reading (or a carried REC prior) **defeasible** — able to lose — closing the
DEF·EVA·REC loop.

## Stimulus (blind) — `stimulus.mjs`, `battery/*.json`
Four unit-vector streams over their own opening: **stationary** (stays put), **dip** (a 3-unit
excursion then back), **drift** (rotates 90° steadily away), **replaced** (jumps to a far
direction midway). The measure seeds a reading from the opening window and EVA-tracks it; the
held key is the `defeats` flag.

## Verdict (`node stimulus.mjs && node measure.mjs && node score.mjs`)
**CONFIRMED**, 4/4, both directions:

- **stationary** → never defeated (support persists) ✓
- **dip** → survives (the leak forgives a transient) ✓
- **drift** → defeated at t=38, at the crossover where strain overtakes support ✓
- **replaced** → defeated at t=35, shortly after the jump ✓

Defeating on a blip would be as wrong as never defeating on a drift; EVA does neither.

## The shape of the finding
The operator grid is now complete but for **NUL**: EVA fills the last cell we hunted, and it
does so by *not* being what we first guessed. It is the return that makes a convention losable
— DEF asserts a reading, EVA tests it against the stream, REC revises on defeat. The residual
autonomy `coupling` measured, the recurrence `readingCount` counted, the prior `recognize`
carried — EVA is what lets any of them be *wrong* and be dropped. The whole conditions the part
(REC), and the part can defeat the whole's expectation of it (EVA): the two-way loop, closed.

## Honest limits
EVA needs enough **conviction margin** (γ, `expect`) to separate a transient from a drift —
that calibration *is* the line between "a blip" and "the world moved," and there is no
universal setting (real-vector noise makes a naive threshold fragile; a 3-unit blip and a
4-unit drift differ only by how long the misfit is sustained). And EVA is a *lifecycle*
operator: its value shows on long horizons and genuine non-stationarity, not single-stream F1.

## Control (the parity gate)
`evaluate` is a **new pure export** — a fold step, no state of its own; every default engine
path is byte-identical. `node --test tests/*.test.js` green (+5 new). Regression lock:
`tests/evaluate.test.js`.

## Files
- mechanism: `src/core/spectral.js` (`evaluate`), re-exported from `src/core/index.js`
- regression lock: `tests/evaluate.test.js`
- this pressure: `stimulus.mjs` → `battery/*.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
