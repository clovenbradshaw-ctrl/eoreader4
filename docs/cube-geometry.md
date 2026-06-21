# The cube geometry, made first-class (add-on 2)

A cell is `(Mode, Domain, Object)`. It casts three shadows — three faces — and the
code is being made to conform to that geometry rather than only describe it. This
note records what has landed and the decisions behind it.

## The cognition triad — surfer in the middle (§A)

`src/core/cognition.js`. The system helix (organs / core / outputs) one turn
inward, as faculties:

```
  READER   ──▶   SURFER   ──▶   ENACTOR
  Existence      Structure      Significance
  constitute     navigate/find  judge/commit
  NUL SIG INS    SEG CON SYN    DEF EVA REC
  (first)        (the middle)   (last; gate; modality-blind)
```

The surfer is the **middle** by construction: Structure is the relating function,
so navigating a constituted field to find what bears *is* the relating step
between bringing-into-being (reader) and committing-to-surface (enactor).
`facultyOfOperator(op)` returns which faculty fired an event, by the operator's
Domain — so the log already names the faculty.

### The third faculty is the enactor, not the talker (add-on 3)

The committing faculty is **modality-blind**: deciding-and-committing is mostly
not language (a soccer player runs the full DEF·EVA·REC loop with no speech in
it). Speech is one output organ among several — a pass, a struck note, a hand
closing on a ball are equally enactments. So the gate (the DEF·EVA·REC
commitment) lives in the **core** as the enactor's significance, and output organs
become bare renderers, symmetric with the bare input ingesters: input organs do
no structuring (structure emerges in the core), output organs do no judging
(commitment happens in the core).

This is being landed in tested phases:

1. **done** — rename the faculty `talker → enactor` in the spine (`cognition.js`),
   modality-blind, in the core.
2. move the gate (`organs/out/speech/gate` = DEF·EVA·REC commit) into the core as
   the enactor's commit step; speech becomes a bare renderer.
3. **efference copy** at commit — the forward model (`predict/`) emits the
   predicted sensed-consequence of a commit, indexed to it.
4. **the one monitor** + self/world tagging (`self/`) — compare each sensed P′
   against outstanding efference copies; a match is tagged SELF and attenuated
   (me-ness), a miss is WORLD. One monitor, modality-blind → one self. (add-on 3
   §3–§4: SELF-ATTENUATION test.)
5. ALTERED-FEEDBACK + ONE-ME tests (add-on 3 §7).

The headline (add-on 3 §4): each output organ does **not** get its own feedback
mechanism. Efference copies and sensed returns are propositions and the
comparator is modality-blind, so **one monitor in the core** handles all output —
one loop, one self.

## The three faces — operator(Site, Stance) (§B)

`src/core/faces.js`, built on `cube.js` and `address.js`:

```
  ACT    (Mode × Domain)   the operator   — WHAT is done
  SITE   (Domain × Object) the terrain    — WHERE it lands
  STANCE (Mode × Object)   the manner     — HOW it is done

  written:  operator( Site , Stance )      e.g.  CON(Link, Binding)
```

- `facesOf(event)` reads all three faces off an event.
- `notate(event)` → `CON(Link, Binding)`; `notateHolon(event)` weaves the target in.
- `cellAt(op, { site, stance })` resolves the cell from the faces.
- `cellsOf(op)` gives an operator its three grain-coherent cells (its legal reach).

## Decision: grain stays load-bearing (off-home firings)

The add-on's surfer arrests (§C) include grain-mixed cells like `SIG(Entity,
Tending)` — Entity is Figure-grain, Tending is Ground-grain. The existing
`coherence()` in `cube.js` is the **confabulation guard** ("don't apply a Figure
fix to a Ground problem") and rejects exactly those; `tests/cube.test.js` enforces
it. Per direction (*"grain is very important"*), the guard is **kept**: `cellAt`
refuses a grain-mixed or off-domain request rather than confabulate a cell. The
grain-coherent form of an arrest is its home cell on the diagonal — e.g. the focus
arrest is `SIG(Void, Tending)` (Ground) or `SIG(Entity, Binding)` (Figure), both
in `cellsOf('SIG')`. "The full 27" is the operator × three-grain diagonal, honest.

## Decision: the Site is addressed holonically (§B/§D)

`src/core/holon.js`. The Site face names WHERE an operation lands. The cube gives
the KIND of place (the terrain); the holon gives WHICH place — a path that descends
the holarchy, `customers.profiles.pets.name`, with every referent (each prefix)
carrying a stable **hashId** of record (FNV-1a over the canonical path).

```
  site = (terrain, holon)        terrain: WHAT KIND (cube)   holon: WHICH ONE (path + hashId)
```

- `parseHolon(path)` → `{ path, segments, depth, leaf, parent, id }` (depth = holonic level).
- `holonLevels(path)` → one addressed referent per level, so a CON can walk UP the holarchy.
- `containsHolon`, `parentOf`, `leafOf`, `joinHolon`, `holonId` navigate/identify.

Grain (the operation's resolution band) and holonic depth (the target's nesting)
are kept as distinct axes; the Site carries both.

## The file tree, conformed to the geometry

The reorg makes the directories the geometry, not just a description of it. Golden
parity is the rail — every move is verified byte-identical against the suite
(**457 green**, all additive).

```
src/
  organs/
    in/            the sense organs (was ingest/) — modality → units      [reshape §3]
    out/speech/    the speech organ (was talker/) — props → language      [reshape §6]
  core/            the genome + the geometry made first-class:
    operators · log · cube · address · project   (depends on nothing)
    unit.js · proposition.js                      (the two floors)
    conventions/                                  (the learning layer, priors)
    cognition.js · faces.js · holon.js            (triad · three faces · Site address)
  reader/          the READER faculty (was read/) — Existence · constitute  [§A]
    parse/         the constitution engine (was src/parse/) — marks → structure
  surfer/          the SURFER faculty (the middle) — Structure · navigate    [§A]
  …                enact/ ground/ — shared significance machinery (the talker's
                   judging side); enact is imported by the surfer and imports the
                   reader, so it is a shared engine, not a clean talker-only dir
```

- **Landed (structure):** `organs/in`, `organs/out/speech`, the `reader` and
  `surfer` faculties as their own subassemblies, and the geometry spine in `core/`.
  The reader and surfer were fused in the old `read/` holon; they are split into
  peer faculties that still import each other (the reader reads forward surprise;
  the surfer rides the reading) — a real boundary, not a decoupling that would
  change behavior.
- **Next (golden-gated):** name the talker's judging faculty (`enact`/`ground`) and
  the remaining `organs/out` organs (music, action); thread the holonic Site +
  Stance onto the event emitters so every logged operation is recorded as
  `operator(Site, Stance)` at a holonic address.
