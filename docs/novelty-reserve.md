# The adaptive novelty reserve — a constant the signal should have been teaching

The one surprise (`docs/spec-one-surprise.md`) keeps a **reserve atom**: a slice of
probability held for an as-yet-unseen atom, so the divergence stays defined on a
newcomer (absolute continuity) and an opening falls to zero on its own. Until now that
reserve was a **hand-set constant** — `NOVELTY_RESERVE = 1.0` in `src/core/surprise.js`,
mirrored as `NOVELTY = 1.0` in `src/perceiver/reading.js`.

A constant is wrong here for the same reason a constant is wrong anywhere in the
predictive path: it is an external assumption standing in for something the signal
teaches. The reserve probability the reader actually holds is

```
p(novel) = reserve / (Σ figure-mass + reserve)
```

With a fixed `reserve`, `p(novel)` is a function of **accumulated mass alone**. So the
reader grows equally certain that nothing new will come whether it **just saw three
newcomers or none** — it cannot tell a burst of arrivals from a long confirmation
stretch, because the constant has no term for the one thing that distinguishes them:
the **rate at which newcomers arrive**.

## The fix: context at the amplitude, the law left fixed

`recentNoveltyReserve(events, cursor, { gamma })` derives the reserve from the log
instead of hard-coding it: the **γ-decayed count of `INS` first-appearances**, under the
*same kernel the figure field uses* (`w = γ^(at−1−s)`).

```
nu = Σ_{ids first seen at s < cursor}  γ^(cursor−1−s)
```

It runs **high right after a burst** of newcomers and **decays toward zero** through a
confirmation stretch. It is an **amplitude only** — it is threaded into the *unchanged*
Born step (`surpriseAt` / `forwardDist` / `pNovel`) at the very place the constant sat.
The square-and-normalise law stays identical for every sense; only the reserved mass
becomes context-sensitive. This is the discipline in one line: **context enters at the
amplitude, the law stays put.** Put modality or context in the law and you have put
modality in the law; put it in the amplitude and every sense inherits the same fix.

It reads only `INS` operators, so it is **modality-agnostic**: any organ that admits
entities inherits the adaptive reserve, exactly as any organ emitting bonds inherits the
connectivity channel.

## How it ships

Opt-in, behind the same parity gate as `opts.bridge` / `opts.forward`:

```js
readingAt(doc, cursor, { reserve: 'adaptive' })   // nu drives the reserve
readingAt(doc, cursor)                            // default: the fixed unit, byte-identical
```

`pNovel` (the reserve probability itself, the cleanest readout) is surfaced under
`opts.forward`. The default path is unchanged; `npm test` stays green (676 → 681 with the
lock). At a genuine opening (no prior `INS`, `nu = 0`) the reserve falls back to the
non-informative unit — the honest boundary when there is no signal yet to fit, not a
tuned parameter.

## The evidence (experiments/ledger.jsonl exp-0002)

A blind experiment with a held key and a loud-surface control, in **two organs** (text
via `parseText`, tonal via `ingestMusic`) and on a pure-operator log. Three readings reach
**identical accumulated mass** (every unit deposits one `INS`) but differ in newcomer
rate; the probe is a brand-new entity:

| condition (window before the probe) | fixed `p(novel)` | adaptive `p(novel)` |
|---|---|---|
| `newcomers` — three brand-new entities | 0.25 | **0.50** |
| `one_recurs` — one entity, three times  | 0.25 | 0.20 |
| `old_recur` — three **old** entities cycled | 0.25 | 0.20 |

- **The gap.** The fixed reserve is flat (`0.25`) across all three, in both senses — it
  cannot see the difference.
- **The split.** The adaptive reserve fires high after a burst, low after a stretch.
- **The loud-surface control.** `old_recur` has the *same* distinct-entity count and the
  *same* recent-mention activity as `newcomers` — only the entities are old. It groups
  with `one_recurs`, not the burst, so the reserve is reading **recency of introduction**,
  not surface activity or distinct-count.
- **The omnimodal gate.** The dissociation is identical in text and music: an interior
  change that helps two senses, not a modality fact wearing an interior costume.

Lock: `tests/novelty-reserve.test.js`.
