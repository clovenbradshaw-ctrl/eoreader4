# p001 · the novelty reserve — the protention should track the novelty rate

**Draw.** target `EVA/REC` (the protention — belief reserved for the unseen) ·
modality `text + music` · kind `discrimination` · level `significance` · horizon
`across-a-window` · source `structured-draw` over seed of record **"Stefanos
Kanellos"** (rev 1342672544).

## Claim (falsifiable)

The belief-mass the reader reserves for an as-yet-unseen atom — its **protention**,
`pNovel` — should track whether **newcomers have recently been arriving**. After a
burst of newcomers the reader should hold **more** reserve (a newcomer is expected,
its arrival less surprising); after a long stretch of pure confirmation it should
hold **less** (a newcomer is now surprising). With the live fixed reserve `1/(M+1)`,
the reserve depends only on accumulated **mass** `M`, so at **matched mass** the
surprise at a genuine newcomer is **identical** whether the recent stream was
novelty-dense or novelty-barren. *Predicted dissociation:* a signal-derived reserve
(the γ-decayed recent newcomer-arrival rate) makes the matched-mass newcomer surprise
**monotonic** in novelty rate — dense < mid < barren — while the fixed reserve is flat.

## Control (the loud surface)

The cheap surface signal is prior **mass**. The control pair (`barren-short` vs
`barren-long`) holds the novelty rate at ~0 and varies only mass; the **fixed**
reserve already separates them, so a measurement that fires *only* there is reading
mass, not the mechanism. The matched-mass items hold mass constant — only a
novelty-**rate** reader separates them. A fix that merely rescaled mass would move
the control, not open the matched split.

## Verdict — GAP LOCATED, then FIXED behind the parity gate (8/8 blind checks)

| | fixed (live) | signal (fix on) |
|---|---|---|
| matched dense / mid / barren reserveFig | `0.2537 / 0.2537 / 0.2537` (Δ≈0 — **blind**) | `0.5000 / 0.2034 / 0.0541` (**monotonic**) |
| control short / long reserveFig | `0.3704 / 0.2537` (mass loud, instrument alive) | `0.2917 / 0.0541` (sane, not reversed) |
| omni music dense / barren | `0.2537 / 0.2537` (Δ=0) | `0.5000 / 0.1219` (separates) |
| omni text dense / barren | `0.2537 / 0.2537` (Δ=0) | `0.5000 / 0.0541` (separates) |

The gap is **interior** (it shows identically in text and music) and the fix is
**interior** (the same change opens the split in **two different organs** — the
omnimodal gate: *confirmed in two senses*).

## Mechanism & fix

The reserve is a **hand-rolled constant** (`NOVELTY_RESERVE = 1.0`) — the exemplar
the brief names. The fix makes the reserved **amplitude** the γ-decayed recent
newcomer-arrival rate on each field's own mass scale (`core/surprise.js`
`noveltyReserve`), then runs it through the **same fixed Born step**. Context enters
at the amplitude; the law (square, normalize) stays put. **Layer:** interior
(`src/core/surprise.js` + the modality-agnostic `src/perceiver/reading.js`).
**Gate:** `opts.reserve` defaults to `'fixed'` → the 649-test suite is byte-identical
(RULES_REV discipline). **Lock:** `tests/novelty-reserve.test.js`.

## Run

```
node experiments/exp-0002-novelty-reserve/measure.mjs                 # fixed (live) — the gap
RESERVE=signal node experiments/exp-0002-novelty-reserve/measure.mjs  # signal — the fix
node experiments/exp-0002-novelty-reserve/score.mjs                   # blind adjudication (8/8)
```

## Scope

**Holds:** the figure field (surprisal/forward protention) and the proposition field
(significance reserve), text + music + the modality-neutral isolator, default horizon.
**Open / not yet asserted:** the entity-horizon path counts births from the unfiltered
`firstIns` (the default `recency` horizon admits all, so unaffected); promotion to
default (RULES_REV-on as standard) is deferred until the signal reserve is shown to
lift the surf / enacted-loop readings, not only this discrimination.
