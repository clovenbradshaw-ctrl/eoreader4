# exp-0004 — do atmosphere and paradigm help? Two complementary boundary channels

## Pressure
exp-0003 segmented every modality by **lens-switching**: assign each unit to its
dominant global reading (`argmax |⟨u|lensₖ⟩|²`), cut where the assignment changes. Two
boundary classes are *invisible* to it by construction:
- **near-degenerate multiplicity** — when two readings have near-equal Born weight, the
  global top-k lenses are *mixtures* of them, so no clean switch happens (`hard_two_balls`,
  F1 0 %);
- **adjacent recurrence** — an A|A boundary where the reading *label* is unchanged but the
  field's *subspace* rotates (`hard_adjacent_recurrence`, F1 0 %).

The engine already carries two passes that never touched segmentation: **atmosphere**
(`relEntropy`, the Umegaki departure S(ρ‖σ), Track B) and **paradigm** (`commutator`, the
incommensurability ‖[Π_A,Π_B]‖_F, Track D). Do they help?

## Claim (held in `key.json`)
Atmosphere and paradigm are **complementary** boundary channels — each reads the field
*locally* (the window before a cursor vs the window after) and peaks exactly where
lens-switching is blind. Fused as a union **gated by the geography abstention**
(`readingCount`), they beat lens-switching on mean boundary F1 *and* keep the flat streams
clean. A **naive (ungated) union does not** — atmosphere/paradigm have no built-in void, so
they flood the flat streams with false peaks.

## Mechanism (`src/core/voidnull.js` → `voidPeaks`, reusing `relEntropy` + `commutator`)
Over the top-M reading subspace (M = 2·`readingCount`, cap 12) and a window W ≈ 5 % of the
stream: `score(b)` = symmetric S(ρ_L‖ρ_R) (atmosphere) or ‖[ρ_L,ρ_R]‖_F (paradigm). The
new primitive **`voidPeaks`** picks the local maxima that clear the **bounded** per-decision
void line (`boundedNull` — a departure is a *bounded* score, not a heavy tail, so the log-tail
bound would reject every real peak; measured, it did). The union of lens+atmo+para is taken
**unless `readingCount` abstains**, in which case no channel fires.

## Verdict (`node measure.mjs && node score.mjs`)
**CONFIRMED.** mean boundary F1: **GATED-UNION 44 %** vs lens 38 % (atmo 30 %, para 11 %);
oracle best-of 54 %. All four key checks pass:

- **Atmosphere cracks `hard_two_balls`**: 33 % where lens = 0 % — the near-degenerate
  multiplicity. Global lenses are mixtures; the *local densities* still differ.
- **Paradigm cracks `hard_adjacent_recurrence`**: 40 % where lens = 0 % — the A|A boundary
  exp-0003 called "invisible to lens-switching." The label is unchanged but the eigenbasis
  rotates, and the commutator sees it.
- **Gate keeps the flat streams clean**: noise / single / collinear stay at 100 %. The
  ungated union crashed them to 0 % (change-point scores have no void of their own).
- Big lifts elsewhere: `high_k` 44 → 61 %, `codeswitch` 27 → 50 %, `ar` 22 → 53 %.

## The shape of the finding
The **Born rule stays the one universal** (every channel is a projection/overlap); what is
*not* universal is which *contrast* reveals a boundary — a reading switch, a density
departure, or a basis rotation. The three are different projections of the same field, and
the geography decides which one carries the cut. The oracle gap (44 → 54 %) marks the next
pressure: **choosing the channel per stream from its spectrum**, rather than unioning all
three.

## Honest cost
The gate suppresses `text_hi/ja/zh`, where paradigm was the only signal (25–29 %) but the
CJK char-trigram basis is flat enough that `readingCount` abstains. Suppressing there is
consistent (honest abstention over a flicker) but forfeits those catches — the fix is a
better basis (front-end), not the fusion.

## Control (the parity gate)
`voidPeaks` is a **new pure export** (no state, no input mutation); the channels reuse the
existing `relEntropy`/`commutator`. Every default engine path is **byte-identical**:
`node --test tests/*.test.js` green (+5 new). Regression lock: `tests/void-peaks.test.js`.
The measure reads only each stream's `units`; boundaries/labels/tol are the held key.

## Files
- mechanism: `src/core/voidnull.js` (`voidPeaks`), re-exported from `src/core/index.js`
- regression lock: `tests/void-peaks.test.js`
- this pressure: `measure.mjs` (key-blind), `score.mjs`, `key.json` — reusing the
  exp-0003 battery (`../exp-0003-omnimodal-sense/battery/`)
