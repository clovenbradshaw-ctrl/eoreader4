# Cycle 002 — results

**Verdict: CONFIRMED.** An organ-layer fault, fixed in the conventions ledger, on by default,
parity green (650 → 653 with the lock). Surfaced while building cycle 001 and kept strictly
separate from it.

## The gap

`npObject` (relations.js) lifts the post-verb NP head as a referent endpoint unless it sits in a
hard-coded particle/non-head list — which omitted the cardinal directions, "home", and bare
temporal nouns. So "Duane sailed north" forged `CON duane→sailed→north` and injected `f:north`,
`p:duane|sailed|north` into the proposition field, though the figure path correctly refused to
admit "north". (The figure extractor was already right; only the relation extractor leaked.)

## The fix (organ / conventions ledger — the right layer)

A seeded + learnable `adjunct` class in `src/core/conventions/ledger.js` (`isAdjunct`), the home
for language-specific lists — "the fix is a seed the ledger exposes, not the literal." `npObject`
consults it through the same guard threading as `isCopula`/`isModifier`/`isSpeech`
(`src/perceiver/parse/pipeline.js` → `relations.js`). Seeded conservatively (cardinal/locative
directions + temporal points), defeasible, and learnable — a text whose adjuncts run otherwise
teaches its own. On by default as a seed; the parity gate (`npm test`) validates it.

## Scores (blind)

| item | kind | bonded (want) | in field |
|---|---|---|---|
| carried/guarded/chased **Morgan** | patient | true (true) ✓ | yes (correct) |
| sailed **north** / **home** / **west**, marched **south** | adjunct-direction | false (false) ✓ | no |
| sailed at **dawn** | adjunct-temporal | false (false) ✓ | no |

CONTROL (every adjunct in the identical loud object slot abstains): **PASS**.
RECALL (every patient still bonds — no loss): **PASS**. Field clean: **PASS**.

## Orthogonality to cycle 001 (the guardrail)

Cycle 001's streams use verbatim recurrence ("X met Morgan") with no adjuncts, so this organ fix
does not move cycle 001's numbers — re-run after the fix: forward novelty log-loss still
0.792 → 0.638 (gain 0.154), byte-identical. The interior reserve gap and the organ adjunct fault
were fixed in their own layers without contaminating each other's measurement.

## Files

`claim.md` · `stimulus.json` (blind) · `key.json` (held) · `measure.mjs` (read-only) ·
`score.mjs` (blind) · `out.json`. Lock: `tests/lock-adjunct-referent.test.js`.

## Scope

Seeded conservatively: words that are *sometimes* real patients (morning, night, harbour) are
left out of the seed and to the learning loop. The argument/adjunct distinction is lexical (or
learnable), never structural — a fully signal-taught adjunct inducer (a word that recurs as a
bare post-verb modifier across many verbs, never a subject) is the natural next step, deferred.
