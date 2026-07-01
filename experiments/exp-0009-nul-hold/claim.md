# exp-0009 — NUL: the hold that keeps a reading clean (the cube completed)

## Pressure
The operator grid had one cell left: **NUL** (Differentiate × Existence, "hold —
non-transformation"). The credence module defines it exactly — *"never-probed → no
opinion, return the prior"* — held distinct from CLEARED (proven-empty) and from a low
verdict. It is the reader's **third** response to a unit: not LIFT (SIG/SYN/INS), not VOID
(a DEF assertion of absence), but **HOLD** — keep it as-is, contributing nothing.

## Claim (held in `key.json`)
A reader with **no NUL** must lift every unit into the nearest standing reading — a false
opinion that drags that reading off true, collapsing distinct readings into one corrupted
blob. **NUL** holds the ambiguous/novel unit (weight 0 — the additive identity on ρ), so the
standing readings stay clean; the held reserve is lossless and, once it coheres, lifted (INS)
as a fresh reading. NUL ≠ VOID: a held unit is present and recoverable, not asserted absent.

## Mechanism (`src/core/spectral.js` → `NUL`)
`NUL(reserve, unit)` appends a unit to a reserve, untouched. The load-bearing property,
proven in the lock: a held unit folded into a density with **weight 0 leaves ρ exactly
unchanged** (`tests/hold.test.js`), where *forcing* the same unit in (weight 1) corrupts ρ.
That is "no opinion, return the prior" made mechanical.

## Stimulus (blind) — `stimulus.mjs`, `battery/return.json`
A stream **A B C A B**: two established readings A, B; a block of a NOVEL third group C
(orthogonal to both); then A and B RETURN. Two readers, identical but for the third response
to a novel unit — `force` (lift into the nearest standing reading) vs `nul` (hold, then lift
on coherence). The measure reads only `units`; the true A/B/C directions are the held key.

## Verdict (`node stimulus.mjs && node measure.mjs && node score.mjs`)
**CONFIRMED**, all three checks:

| reader | A | B | C (novel) | readings |
|---|---|---|---|---|
| **force** | 71 % | **27 %** | **1 %** | **1** (collapsed, corrupted) |
| **NUL** | **98 %** | **97 %** | **95 %** | **3** (A, B, C all clean) |

The forcing reader dragged R_A to absorb B and C, ending with a single reading true to
nothing; when A and B returned they no longer fit. NUL held the uncohered units (no opinion),
kept A and B true, and lifted C into its own reading — losslessly.

## The shape of the finding — the cube completed
NUL is the smallest operator and the one we kept brushing against without naming: the
pre-INS buffer, `CON`'s residual autonomy, the units below every lens. It is what lets a
reader *not decide* — hold evidence without lifting it into a false reading or asserting it
absent. With NUL the 3×3 grid is **complete on ρ**:

```
NUL hold   SIG attribute   INS instantiate
SEG resplit CON bond       SYN synthesize
DEF assert  EVA evaluate   REC learn
```

Nine operators, each a pure primitive with a lock, all realised at the spectral grain — the
same vocabulary the whole system speaks, now spoken by the omnimodal sense. The set is
**closed** (nine cells) and recurs at every grain and holon level: bounded in kind, unbounded
in depth. The Born rule is the one universal; NUL is the one *restraint* — the operator that
holds, so the reader can be wrong-free by not over-reading.

## Control (the parity gate)
`NUL` is a **new pure export** — a lossless append, no mutation; every default engine path is
byte-identical. `node --test tests/*.test.js` green (+4 new). Regression lock:
`tests/hold.test.js`.

## Files
- mechanism: `src/core/spectral.js` (`NUL`), re-exported from `src/core/index.js`
- regression lock: `tests/hold.test.js`
- this pressure: `stimulus.mjs` → `battery/return.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
