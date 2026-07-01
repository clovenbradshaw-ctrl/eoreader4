# Parameter mapping — the plexus, touchdesigner for organs

> A modality input throws up persistent holons. Call them parameters. Wire one
> organ's parameters into another, with EOT as the translation layer.
>
> **Status — first slice landed** (`src/plexus/`, `tests/plexus.test.js`). The
> parameter reader, the binding, and the EOT-carried wire exist and round-trip
> into a first-class doc through the real ingester. What is deferred is named in
> [§ Status](#status--what-landed).

## The idea

TouchDesigner is a patchbay: every operator exposes **parameters**, and you draw a
wire from one operator's parameter into another's. The wire carries the value; the
downstream operator is driven by the upstream one without either knowing the other's
internals.

This system already has the operators — they are the **organs** (`organs/in`,
`organs/out`, docs/omnimodal-core.md). What it was missing is the parameters and the
wire. This note adds both:

- A **parameter** is a *persistent holon* (docs/holons.md) — an emergent figure a
  modality input throws up, one that RECURS across the stream instead of firing once.
  Holons are the stable intermediate forms selection can act on; here they are also
  the stable things a patch can wire. The organ does not hand them in — they are read
  off the core's own structure surface (`perceiver/surfaces.js`).
- The **wire** carries **EOT** (docs/eot-surface-syntax.md), the one surface every
  organ already speaks. A holon heard by the audio organ crosses to any other organ
  as EOT triples and lowers, losslessly, into that organ's own append-only log. The
  wire is modality-blind, exactly as the interior between the membranes is.

```
  organ A ──▶ [ reading ] ──▶ parametersOf ──▶ ( persistent holons )
                                                      │
                                                   mapParameter          the patch (data)
                                                      │
                                                   route  ── EOT ──▶     the translation layer
                                                      │
                                                   connect(eotDoc) ──▶   organ B's own log
```

## Why EOT is the right wire

A parameter's value is not a scalar — it is a holon's STATE: the relations it wears
and the standing properties it carries. EOT is exactly the surface for that state:

- a relation → a LINK triple (`Gregor -> Grete : protects`),
- a standing property → an IS-A (`Gregor : weary`).

And EOT is already the lingua franca every organ lowers to and reads back
(`ingest/eot.js`, `perceiver/surfaces.js` → `serializeEOT`). So the wire reuses the
one renderer and the one ingester the system already trusts — no bespoke transport.
When the source and destination name a holon differently, EOT even carries a native
**translation operator**: `!rec vocabulary:A {X} => {Y}` remaps the vocabulary across
the wire (`route(..., { recBridge: true })`).

## The API (`src/plexus/`)

One entrance, `plexus/index.js`. Pure and dependency-injected — it imports no model
and no ingester (the ingester is passed to `connect`), the same discipline
`organs/out` keeps.

```js
import { parametersOf, mapParameter, route, connect, patch } from './plexus/index.js';
import { eotDoc } from './ingest/eot.js';

// 1. the persistent holons of organ A's reading, as parameters (ranked by recurrence)
const params = parametersOf(readingFromOrganA, { organ: 'text', minPersistence: 2 });

// 2. draw a wire from one parameter into organ B, under B's own parameter name
const wire = mapParameter(params[0], { organ: 'music', as: 'Motif' });

// 3. the EOT the wire carries over a live reading (the translation layer)
const { eot } = route(wire, readingFromOrganA);

// 4. lower it into organ B as a first-class doc (the graph stack reads it natively)
const docForB = connect(wire, readingFromOrganA, eotDoc);

// (patch does 2+3 in one step)
const { binding, lines } = patch(params[0], { organ: 'music', as: 'Motif' }, readingFromOrganA);
```

| function | role |
| --- | --- |
| `parametersOf(reading, opts)` | a reading's persistent holons, as parameters (`opts.organ`, `opts.minPersistence`) |
| `parameterOf(reading, ref, opts)` | one parameter by label or key |
| `snapshotEOT(param, reading, opts)` | a holon's state as EOT lines (`opts.as` relabels it) |
| `mapParameter(source, target, opts)` | draw a wire — a binding, pure data, deterministic id |
| `route(binding, reading, opts)` | the EOT the wire carries (`opts.recBridge` documents the remap) |
| `connect(binding, reading, ingest, opts)` | lower the wire's EOT into the target via an injected ingester |
| `patch(source, target, reading, opts)` | draw + route in one step |

### The parameter

```js
{
  key,          // wire endpoint id — holonId(`${organ}.${label}`), unique per (organ, holon)
  holonId,      // the holon's own identity — organ-independent (same holon on two organs → one id)
  label,        // the human-readable name
  organ,        // which organ exposed it (the source modality)
  kind: 'figure',
  persistence,  // recurrence (the merged sighting count) — how clearly the holon emerged
}
```

The endpoint id is organ-scoped on purpose: a "Gregor" heard and a "Gregor" read are
two endpoints (two things you can wire) but one holon identity — the same rule the
referents follow, where two documents' "Darcy" are not one until a proof unifies them
(`organs/in/index.js`).

## Status — what landed

- **`src/plexus/parameters.js`** — `parametersOf` / `parameterOf` read persistent
  holons off a structure surface and present them as parameters; `snapshotEOT` renders
  a holon's state (its LINKs and IS-As) as EOT, relabelable to a destination name.
  Reuses `serializeEOT`, so the wire and the notes surface are one renderer.
- **`src/plexus/wire.js`** — `mapParameter` (the binding as deterministic data),
  `route` (the EOT payload, with an optional `!rec` vocabulary bridge), `connect`
  (lower into the target via an injected `eotDoc`), `patch` (draw + route).
- **`tests/plexus.test.js`** — the round-trip is proven end to end: a holon read off
  one organ's reading crosses as EOT and lowers into a first-class doc through the
  REAL ingester (`eotDoc`), minting spans under the destination name with zero
  diagnostics. The source name does not leak across a renamed wire.

Deferred (named so the boundary is honest):

- **Live / reactive wiring.** Today a binding is routed on demand over a reading you
  hand it. A standing patch that re-routes when the source reading changes (the
  touchdesigner cook) is the natural next slice — the binding is already pure data
  keyed by a deterministic id, so a patchbay holding many bindings is additive.
- **Parameters beyond figures.** A parameter is a persistent *figure* here. A
  persistent *relation* or a scalar DEF as a parameter (a value that drives a
  numeric organ control) is a straight extension of `parametersOf`.
- **Driving `organs/out` directly.** `connect` lowers into an EOT doc any faculty
  reads. Feeding a routed holon straight into an output organ's `render` as its
  directive (docs/omnimodal-task-language.md) — so a heard motif *composes* a phrase —
  is the symmetric follow-up, and the seam (`directive`) already exists.
