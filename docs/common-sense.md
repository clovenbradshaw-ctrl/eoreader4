# Common Sense — a reprogrammable *sensus communis*

> **Status.** Framing note for the parameter-mapping organs (THALAMUS the common
> sense, LIMNER the eye, CANTOR the ear). One concrete slice from it has landed —
> **the three timbres of nothing** (§IV → `rest_character`, `src/thalamus/cantor/`,
> `tests/silence.test.js`). The other organs it imagines are recorded here as the
> map of where this goes.

## The soft common sense

Hold a lemon: yellow, sour, cool, rough, a small weight. Five senses, five
incommensurable channels — and you experience *one* object. Aristotle saw that the
binding cannot be done by any of the five (the eye cannot taste), so he posited a
sixth faculty, the *koinē aísthēsis*, the common sense, that perceives the **common
sensibles** — motion, rest, number, figure, magnitude — the qualities that show up in
more than one sense and belong to none.

In a human that faculty is **fixed hardware**: you don't choose that yellow arrives by
the eye. THALAMUS is a *soft* common sense — external, inspectable, typed, governed —
so you can decide, per finding, per reader, which quality of the world arrives by which
door of the senses, and then take it back. That is the whole idea; everything else is a
consequence.

## The Meno engine

A slave boy in the *Meno* can construct the diagonal of a square and point to its
length — but that length is √2, irrational, and he cannot *say* it. There is no number
in his mouth for the thing his hand can indicate. That gap is the engineering surface.

Some truths fit in tokens (language, number — the symbolic). Others live beside the
symbolic: continuous magnitude, rate, shape, simultaneity, texture — Aristotle's common
sensibles, exactly the qualities no single symbol carries and the senses were built to
carry. **Parameter mapping is the engineering of the Meno threshold**: it takes the
diagonal in your data — the pattern no number names without murdering it into a summary
statistic — and routes it to a faculty that never needed number.

This is why the model must not emit geometry, and it is not an economy. The model is the
faculty of *saying*; it works in tokens; it is arithmetic. The diagonal is not available
to arithmetic, and a bigger model is still a boy trying to *say* the unsayable. The right
architecture asks the sayer to **point** (select *which*), and hands the **construction**
to a compass — the deterministic layout engine, the transfer function. The sayer points;
the engine draws the diagonal. That is why THALAMUS/LIMNER/CANTOR work at small scale.

## The three timbres of nothing (landed)

The finding, in investigative work, is usually the document that *should exist and does
not*: the authorization never sought, the record destroyed, the line that is a black bar.
Absence is information of the highest value and the hardest thing to represent, because
every tool displays what is there.

The ear has a relationship to nothing the eye lacks: it knows **silence**, and it can
tell a silence that belongs from one that is *wrong* — a rest in the wrong place is a
hole you *hear*, a pulse that failed to land. And absence is not one thing. There are
**kinds of nothing**, and they mean different things:

| kind | meaning | its silence |
|---|---|---|
| **destroyed** | it existed; someone removed it | a **decay** — the acoustic ghost of something that was ringing |
| **never-created** | an omission, lawful or not | a **clean** gap — a silence that was always silent |
| **withheld** | it exists, held out of reach | a **loaded** rest — a quiet held tension, the nothing straining |

The crucial honesty: "which kind of absence" is a **nominal** variable — the three have
no order (a withheld record is not *more absent* than a destroyed one, only *other*). So
it routes to a **categorical** channel — three timbres of silence, never three *volumes*
— and THALAMUS forbids it a magnitude channel at the point of the patch, the way it
forbids every claim the data cannot support (L1). The honesty is structural.

**As built** (`src/thalamus/cantor/`):
- A typed channel `rest_character` (categorical, transient), legal *only* for an absence
  variable — a plain nominal (a recipient) never becomes rests, and absence never becomes
  a magnitude. Absence *prefers* it (silence is absence's canonical home, the way identity's
  is smell). `ABSENCE_KINDS` = `destroyed | never_created | withheld`.
- CANTOR reads absence off the data as a **NUL** (a row whose sounding magnitude is
  missing) or an explicit kind, and emits a shaped rest. `playScore` sounds each: `clean`
  schedules *no voice* (the gap is heard in the rhythm around it), `decay` a fading ghost,
  `loaded` two detuned voices beating in held tension.
- `tests/silence.test.js` — absence routes to `rest_character`; a magnitude route is
  vetoed (L1); each kind gets its character; a bare NUL reads clean; `playScore` renders
  0/1/2 voices for clean/decay/loaded.

## The organs not yet grown

Two senses is a poverty; the common sense binds five. Recorded as the map:

- **Smell — the identity channel.** Olfaction has almost no ordered structure; it is a
  nearly pure *nominal* space — thousands of categories, no order, each a key to a door in
  memory. It could tell you *which*, never *how much*: which batch a record came from, which
  docket. The mistake would be routing magnitude to it, and THALAMUS would forbid exactly
  that — teaching what smell is *for*.
- **Duration as a magnitude channel.** Route bigness to *subjective duration*: make the
  reader wait longer for larger things, so scale is felt as impatience and a fat tail is the
  part where you start to sigh. A small, near-term CANTOR extension (per-event `dur` ∝ a
  magnitude binding). For an eviction docket it is nearly an argument.
- **The organ that names its own blindness.** For structure of a dimensionality no sense
  can hold, do not flatten it into a pretty lie — render the **residual**, the un-perceived
  remainder, as a first-class object: here is the shadow, and here is how much it throws
  away. The void crosses the glass: a determinate absence on *our* side, the shape of what we
  cannot see, named so we don't mistake our blindness for the world's emptiness. (THALAMUS
  already names `unmapped`; this makes the remainder itself renderable.)
- **Dreamt correspondences.** The consolidation loop (REC, the dream) already reworks the
  graph while idle. Give the dream an organ: let it invent cross-modal patchings no
  effectiveness ranking would propose, and leave them by morning. Most are the garbage of
  sleep; now and then one breaks the rules into a revelation — synesthesia as the sediment
  of machine sleep. The dreamer already exists.

## SURFER coupling

SURFER navigates by **surprise** (KL-divergence between expected and found) — a rate, the
derivative of belief, hence a diagonal (you can only *feel* a surprise against the
expected). The L2 split routes it: **cumulative** surprise (the integral — epistemic
distance travelled) → a *sustained* channel (position, a held pitch); **instantaneous**
surprise (the derivative — the jolt) → a *transient* (a click, a flash, a pitch leap).
THALAMUS already types this (state→sustained, event/rate→transient); wiring it to SURFER's
live surprise stream is the open coupling.

## Position in EO

The mapping is a `SEG`/`SIG` profile, an `INS` of the MapSpec claim, an `EVA` when a reader
re-patches (docs/thalamus.md). Absence is the **NUL** operator made perceptible — determinate
nothing, given a sense.

---

*Framing after the "Common Sense" essay. Plato, Meno · Aristotle, De Anima · Blake.*
