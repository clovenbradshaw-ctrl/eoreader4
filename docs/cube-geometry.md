# The cube geometry, made first-class (add-on 2)

A cell is `(Mode, Domain, Object)`. It casts three shadows — three faces — and the
code is being made to conform to that geometry rather than only describe it. This
note records what has landed and the decisions behind it.

## The cognition triad — surfer in the middle (§A)

`src/core/cognition.js`. The system helix (organs / core / outputs) one turn
inward, as faculties:

```
  PERCEIVER ──▶  SURFER   ──▶   ENACTOR
  Existence      Structure      Significance
  constitute     navigate/find  judge/commit
  NUL SIG INS    SEG CON SYN    DEF EVA REC
  (first; m-blind) (the middle) (last; gate; m-blind)
```

The surfer is the **middle** by construction: Structure is the relating function,
so navigating a constituted field to find what bears *is* the relating step
between bringing-into-being (perceiver) and committing-to-surface (enactor).
`facultyOfOperator(op)` returns which faculty fired an event, by the operator's
Domain — so the log already names the faculty.

### Perceiver and enactor — the two modality-blind arcs (add-on 3, add-on 4)

The two end faculties were named for one modality's surface and are renamed for
the universal act. The **enactor** (not "talker"): deciding-and-committing is
mostly not language — a soccer player runs the full DEF·EVA·REC loop with no
speech; speech is one output organ among several (a pass, a struck note, a hand
closing on a ball are equally enactments). The **perceiver** (not "reader"): taking
the world in is mostly not text — reading the field is perceiving; "reading" is
the text modality's name for perception. The perceiver does not receive a reading,
it *builds* the not-me from bare units against the null, predictively, through any
sense.

So both keep their organs bare and symmetric: as input organs do no structuring
(structure emerges in the core), output organs do no judging (commitment happens
in the core). The gate (DEF·EVA·REC commitment) lives in the **core** as the
enactor's significance. The perceiver is the **not-me** (the open loop, the world
unbidden); the enactor is the **me** (the closed loop, prediction meeting its own
return); the surfer navigates between. They are one forward model pointed two ways
and one significance engine at two of its three objects — the mirror made legible
by the shared name-shape (perceiver / enactor).

This is being landed in tested phases:

1. **done** — rename `talker → enactor` and `reader → perceiver` in the spine
   (`cognition.js`) and the directory (`src/reader/ → src/perceiver/`), both
   modality-blind, in the core. Behavior-preserving.
2. **done** — move the gate (`organs/out/speech/{gate,basis,props}` = the
   DEF·EVA·REC commit, its grounded basis, and the relational correspondence)
   into `core/enactor/`. Speech becomes a bare renderer (`segment.js` cuts the
   model's token murmur into candidate SVOs; the core judges them). Behavior-
   preserving — the gated path is byte-identical, just relocated.
3. **done** — the **efference copy** at commit (`core/enactor/efference.js`). The
   gate, when a proposition collapses, casts one copy per commit: the predicted
   sensed-consequence, indexed to the commit, held outstanding, carrying the
   proposition's identity (`propKey`) — the skeleton prediction is IDENTITY (I
   will sense P return). Modality-blind (the organ is provenance only); a VOID
   casts no copy. `runGate` returns `efference: [...]` alongside `committed`.
4. **done** — the **one monitor** (`core/enactor/monitor.js`) + the self/world
   line (`core/self/`). The monitor holds the outstanding efference copies and
   compares each sensed proposition against them: an exact match (`propKey`) →
   SELF · attenuate · resolve the copy (me-ness); a partial correspondence to an
   outstanding copy → SELF-MISMATCH · error · world-interference · correct the next
   commit; no match → WORLD (news). The boundary is drawn in the core by the
   comparison, not in any organ. There is ONE monitor and ONE self model, shared
   across all output organs — modality is provenance the comparator ignores.
5. **done** — the three golden tests (`tests/enactor-monitor.test.js`, add-on 3
   §7): SELF-ATTENUATION (the efference match is the only difference between self
   and world — can't tickle yourself), ALTERED-FEEDBACK (a self-prediction mismatch
   errors, corrects the next commit, tags world-interference — the loop is real),
   ONE-ME (two modalities flow through one monitor, owned by one self; turning off
   an organ removes a renderer, not a self).

The headline (add-on 3 §4) is now realized: each output organ does **not** get its
own feedback mechanism. Efference copies and sensed returns are propositions and
the comparator is modality-blind, so **one monitor in the core** handles all
output — one loop, one self.

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
    out/speech/    the speech organ — a BARE RENDERER: token murmur → candidate
                   SVOs (segment.js); the gate moved to core/enactor      [add-on 3]
  core/            the genome + the geometry made first-class:
    operators · log · cube · address · project   (depends on nothing)
    unit.js · proposition.js                      (the two floors)
    conventions/                                  (the learning layer, priors)
    cognition.js · faces.js · holon.js            (triad · three faces · Site address)
    enactor/       the enactor's modality-blind agentive loop (add-on 3): gate
                   (the DEF·EVA·REC collapse) · basis (the DEF) · props (the EVA) ·
                   efference (the predicted return) · monitor (the ONE comparator)
    self/          the self/world line + attenuation, written by the one monitor —
                   me-ness, modality-blind and singular (add-on 3 §2/§4)
  perceiver/       the PERCEIVER faculty (was read/→reader/) — Existence       [§A]
    parse/         the constitution engine (was src/parse/) — marks → structure
  surfer/          the SURFER faculty (the middle) — Structure · navigate    [§A]
  …                enact/ ground/ — shared significance machinery (the enactor's
                   judging side); enact is imported by the surfer and imports the
                   perceiver, so it is a shared engine, not a clean enactor-only dir
```

- **Landed (structure):** `organs/in`, `organs/out/speech`, the `perceiver` and
  `surfer` faculties as their own subassemblies, and the geometry spine in `core/`.
  The perceiver and surfer were fused in the old `read/` holon; they are split into
  peer faculties that still import each other (the perceiver reads forward surprise;
  the surfer rides the perception) — a real boundary, not a decoupling that would
  change behavior. The two end faculties are renamed for the universal act:
  `reader → perceiver`, `talker → enactor`, both modality-blind.
- **Next (golden-gated):** the enactor build-out (add-on 3) — move the gate into
  the core, add the efference copy and the one monitor + self/world tagging; and
  thread the holonic Site + Stance onto the event emitters so every logged
  operation is recorded as `operator(Site, Stance)` at a holonic address.
