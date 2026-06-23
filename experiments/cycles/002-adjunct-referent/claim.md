# Cycle 002 — a bond binds two referents, not an adjunct

- **target** CON (Relate × Structure — the central operator) / the NP-object slot.
- **modality** text (the parse organ).
- **kind** discrimination (argument vs adjunct).
- **reading level** L2 structure.
- **horizon** within a unit.
- **layer** ORGAN (`src/perceiver/parse/`), kept strictly separate from cycle 001's interior
  reserve gap — surfaced while building cycle 001 (the parser lifted "at dawn"/"north" into the
  proposition field), isolated there by verbatim-recurrence streams so neither fix moves the
  other's number.

## Claim (falsifiable)

A `CON`/`SIG` bond binds two **referents**. A word in the verb's object position that names no
referent — a directional or temporal **adjunct** ("sailed **north**", "sailed **home**", "sailed
at **dawn**") — must NOT become a bond endpoint, and must not seed the proposition field with a
figure that was never admitted.

## The dissociation it predicts

Sentences of the **identical surface shape** "Subject Verb X.":

- **patient** X (a real referent: "carried **Morgan**") → a bond forms (correct, kept).
- **adjunct** X (direction/time: "sailed **north**") → no bond, no field atom.

## The control (loud surface)

The adjunct sits in the *exact* object slot a patient occupies — a position-only reader (bond
whatever noun-ish token follows the verb) is **loud** here and bonds it. Only a referent-aware
reader abstains. So the adjunct cases ARE the loud-surface control: surface position is identical;
only referent status differs.

## What falsified it (live engine, before the fix)

`npObject` (relations.js) lifted the post-verb NP head as a referent endpoint unless it was in a
hard-coded particle/non-head list — which omitted the cardinal directions, "home", and bare
temporal nouns. So "Duane sailed north" forged `CON duane→sailed→north` and injected
`f:north`, `p:duane|sailed|north` into the field, even though the figure path correctly refused
to admit "north".

## Mechanism tag & fix layer

`adjunct-lifted-as-referent` → fix in the **conventions ledger** (`src/core/conventions/`): a
seeded + learnable `adjunct` class, the home for language-specific lists ("the fix is a seed the
ledger exposes, not the literal"). `npObject` consults `conventions.isAdjunct` through the same
guard threading as `isCopula`/`isModifier`/`isSpeech`. On by default as a seed; the parity gate
(`npm test`) is what validates it (650 green). Defeasible and learnable: a text whose adjuncts
run otherwise teaches its own.
