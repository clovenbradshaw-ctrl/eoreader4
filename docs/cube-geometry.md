# The cube geometry, made first-class (add-on 2)

A cell is `(Mode, Domain, Object)`. It casts three shadows — three faces — and the
code is being made to conform to that geometry rather than only describe it. This
note records what has landed and the decisions behind it.

## The cognition triad — surfer in the middle (§A)

`src/core/cognition.js`. The system helix (organs / core / outputs) one turn
inward, as faculties:

```
  READER   ──▶   SURFER   ──▶   TALKER
  Existence      Structure      Significance
  constitute     navigate/find  judge/speak
  NUL SIG INS    SEG CON SYN    DEF EVA REC
  (first)        (the middle)   (last; gate)
```

The surfer is the **middle** by construction: Structure is the relating function,
so navigating a constituted field to find what bears *is* the relating step
between bringing-into-being (reader) and committing-to-surface (talker).
`facultyOfOperator(op)` returns which faculty fired an event, by the operator's
Domain — so the log already names the faculty.

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

## What landed vs. what is next

Golden parity is the rail — the suite is **457 green** (was 441), all additive.

- **Landed:** the cognition triad, the three faces + `operator(Site, Stance)`
  notation, holonic Site addressing — all in `src/core/`, exported, tested
  (`tests/geometry.test.js`), guard-respecting.
- **Next (golden-gated increments):** the full directory reorg into the cognition
  triad — `read/surf` → `core/surfer` (the middle), the reader and talker
  subassemblies as full cubes — and threading the holonic Site + Stance onto the
  event emitters so every logged operation is recorded as `operator(Site, Stance)`
  at a holonic address. These are the high-fan-out moves staged behind the rail so
  each is verified against the goldens for function.
