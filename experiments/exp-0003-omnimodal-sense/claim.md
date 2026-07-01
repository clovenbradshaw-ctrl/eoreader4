# exp-0003 — the omnimodal sense: a geography-derived reading count

## Pressure
The engine reads any modality as a density operator: `buildDensity → eigenLenses`
ranks a field's readings by Born weight, and each unit is assigned to its dominant
lens (`argmax |⟨u|lensₖ⟩|²`). Run over four senses (text, audio, vision, IMU — the
`seed/` demo), that Born assignment segments the stream by *lens-switching*. But the
demo had to pick **how many readings** to assign among, and it did so with a
hand-rolled constant: *top lenses covering 90 % of the Born mass, capped at 12*. On any
spread spectrum that rule saturates the cap — 12 readings flicker, and the stream
shatters into 20–90 segments where 3–8 were real.

The pressure, in the user's words: **don't impose a universal segmentation rule.** Let
readings *generate* where structure is found and *dissipate* where it is not — a count
that adapts to *the structural geography of the thing-in-itself*. The Born rule stays
universal; only the count should move.

## Claim (held in `key.json`)
The **Born assignment is the universal invariant**; the **segmentation count is not**.
A geography-derived count — `readingCount`, the void (`deriveNull`) applied to the
**eigengap spectrum** — beats *both* hand-rolled fixed-count rules on aggregate boundary
F1, and abstains exactly (zero boundaries) on every flat-geography stream:

- **90 %-Born-mass (cap 12)** — over-segments (saturates the cap, flickers).
- **eigenvalues above the void floor** — over-abstains on flat, high-rank spectra
  (many near-equal readings read as noise).

## Stimulus (blind) · an intense battery — `stimulus.py`, `battery/*.json`
20 modality-blind streams, each with held boundaries + per-unit labels + a tolerance:

- **11 languages / scripts** (Latin, Cyrillic, Greek, Arabic, Hebrew, Han, Kana,
  Devanagari, Hangul) + a whole-language **code-switching** stream. Front-end is
  script-agnostic character-trigram hashing — *no tokenizer*, so the **engine**, not the
  front-end, must find the boundaries. Each carries two registers, recurrence, and a
  mixed (two-source) block.
- **8 canonical hard problems**: near-degenerate multiplicity (two balls), pure noise
  (must abstain), a single reading (must not cut), gradual drift (no sharp boundary),
  adjacent recurrence (an A|A boundary invisible to switching), a collinear/rank-deficient
  field, a high-K 8-reading sequence, and a heavy common-mode (structure buried under a
  6× DC — the centering test).

## Mechanism (`src/core/voidnull.js` → `readingCount`)
Form the leading eigenvalue gaps; the largest gap is the **elbow**. Keep it only if it
clears `deriveNull` over the gaps on a **log scale** — gap-spacings are heavy-tailed
order statistics, the same setting `voidnull.js` uses for percolation extents. Cleared
→ `k = max(2, elbow)` readings (a cleared gap separates ≥2 reading groups by
construction); not cleared → `k = 1`, **abstain**. The *same test* both counts the
readings and yields the abstention — generate where structure is found, dissipate to one
where it is not. Born assignment to the top-k lenses then segments as before.

## Verdict (`node measure.mjs && node score.mjs`)
**CONFIRMED.** mean boundary F1: **GEO 38 %** vs **null 31 %** vs **mass 20 %**;
GEO wins-or-ties **11/20** and both aggregate margins clear the key. Abstention is
**exact** on all six flat streams. Highlights:

- **Multilingual text** is where the count matters most: Greek 60 % (vs 24 %), Hebrew
  50 % (vs 33 %), English/German 43 % (vs 15 %/21 %). The geography-count halves the
  reading set and the flicker collapses.
- **Abstain trio** (noise, single register, collinear): 100 % — zero false boundaries,
  where the 90 %-mass rule scored 0 % (shattered noise into 30–98 segments).
- **hard_high_k**: `readingCount` recovers k=7 (mass 47 %/GEO 44 %) where the
  void-eigenvalue rule collapses to 0 %.

## Honest limits (predicted, not hidden — `key.json:honest_limits`)
- **Near-degenerate multiplicity** (`hard_two_balls`) and the **adjacent-recurrence**
  A|A boundary stay invisible to lens-switching *by construction* — a boundary between
  two identical readings leaves the assignment unchanged. This is the scope edge, not a
  regression.
- **CJK / Devanagari** (`text_zh/ja/hi`): character-trigram hashing gives these a
  near-flat spectrum, so the engine **abstains** (k=1) rather than flicker. The F1 metric
  scores that 0 %, but it is the *correct* behaviour under the void philosophy — *the low
  sets the possibility for the high*: a basis that does not admit register separation must
  not be read as if it did. The fix lives in the front-end (a better basis), not the count.

## Control (the parity gate)
`readingCount` is a **new pure export** — it reads no module state and never mutates its
input. Every default engine path is **byte-identical**: `node --test tests/*.test.js`
stays green (1756 prior tests unchanged, +6 new). The regression lock is
`tests/omnimodal-reading-count.test.js`. The measure reads only each stream's `units`;
`boundaries/labels/tol` are the held key the scorer joins.

## Files
- mechanism: `src/core/voidnull.js` (`readingCount`), re-exported from `src/core/index.js`
- regression lock: `tests/omnimodal-reading-count.test.js`
- this pressure: `stimulus.py` → `battery/*.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
- origin: `seed/` — the four-sense demo (`gen_all.py`, `engine_run.mjs`, `sense_organs.png`) this generalises
