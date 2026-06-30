# Rich notes and the reading substrate

> Follow-up to prompt-assembly (the notes the talker reads), surfing-the-fold (the
> surfer's REC cursors), and the significance loop (DEF·EVA·REC). The talker speaks
> from the fold's notes on the way out and is held to them on the way back. This puts
> the **Significance face** back into those notes and gives the notes a standard graph
> substrate.

## The drop this fixes

Take one line from the flat notes:

```
Gregor -> vermin : woke-as
```

A string verb wedged between two strings: the verb has no type, the endpoints no
class, the assertion no status. That is the whole of what `serializeNotes`
(`src/perceiver/surfaces.js`) can say — an arrow per relation, a value line per def.
Every line is a settled bond. The notes **save the Structure appearances and drop the
Significance appearances**: the held contradiction and the located turn are computed
and thrown away. By the saving-the-appearances standard that is selecting, not saving.

Concretely, the flat serializer dedups defs by referent, so a figure given two
competing readings shows only the first. On the audit play, *God* is both "an invalid"
and "far more wicked than they say…"; the flat notes show one and silence the other.
The reading **measured** the tension and then discarded it.

## What landed (behind `RULES_REV`, golden-parity off)

Three plain groups, the Significance triad made legible without a code reaching the
talker:

```
What the document settles:
  <firm CON arrows and firm DEF value lines>
What the document holds open (do not settle these):
  <EVA tensions — two readings held at once, neither picked>
Where the reading turns:
  <the located REC — the surfer's recCursors, narrated in plain prose>
```

| Group | EO source | Talker may |
|---|---|---|
| settles | firm CON arrows + firm DEF values | assert plainly |
| holds open | `eo:Tension` (competing fills, polarity clash) | voice as a tension, never pick |
| turns | located REC (surfer `recAxes`) + the significance read | narrate the shift |

- **P0 — grouped serializer** (`src/perceiver/surfaces.js#composeGroupedNote`). Pure
  formatter; an empty group is omitted. `serializeNotes` is unchanged (it is the
  settled-group renderer and the edge-grounding veto's witness — one object, two
  directions).
- **P1 — the substrate** (`src/fold/substrate.js`). The notes become a real graph:
  OWL is the floor (open-world, the Given-Log's stance), plus `eo:band` (the
  Resolution axis, riding the assertion), `eo:Tension` (`eo:resolved false` — a
  contradiction kept as data, the paraconsistent move), and `eo:Reframing` (the
  located REC, with its axis and trigger). The runtime form is JSON-LD
  (`substrateToJSONLD`). **Substrate invariant:** a read-time projection of the
  append-only log, no new stored state — `substrateToArrows` round-trips to today's
  arrows, proving the substrate is a superset of the current notes.
- **P2 — the Tension detector** (`detectTensions`). Mints an `eo:Tension` where the
  same referent is DEF'd to two distinct values, or the same bond is both affirmed and
  denied. The members are flagged held (they leave the settled group); they are never
  removed (the round-trip stays a superset).
- **P3 — the membrane** (`src/fold/project.js`). Pulls the labels off the substrate by
  band and node type into the three plain groups and drops every graph token. The
  **membrane invariant** is mechanical: `assertNotesNoLeak` throws if an IRI, a hashId,
  or a `[sN]` tag survives the crossing. The `eo:atSentence` index is prevented by
  construction — the Reframing renderer never emits it — so a plain integer ("126
  years") is never a false positive.

Wired through `foldNote` (`src/fold/integral.js`) and gated at `turn/stages.js#fold`:
with `RULES_REV` off the fold is byte-identical (flat arrows + significance summary);
with it on the note is projected through the substrate. The same level-2/level-3
reading the consciousness already folded is reused — no second pass.

## What remains

- **P4 — the single feed.** Route the grounded answer through one streamed pass with
  the three-group notes (witness and seam on the stream), instead of N model calls per
  cell. Touches the streaming golden path (`src/write/answer.js`); deferred.
- **P5 — the three wires.** The forward-predictor VOID re-surf, the seam re-entering
  the source, and a `SELF_MISMATCH` on read-back emitting a second response. Deep
  enactor changes; deferred. Each ships behind the flag, measured first.
