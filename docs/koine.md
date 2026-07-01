# KOINÉ — the parameter-mapping compiler

> **Status — first slice landed** (`src/koine/`, `tests/koine.test.js`). The
> modality-independent core — profile → compile → critique — plus **CANTOR, the
> auditory backend** (`toScoreSpec` → Web Audio), proven by the §7 worked example
> compiled to eye *and* ear from one profile and sounded through an injected
> AudioContext. The visual backend (`toViewSpec`) and the patch-bay UI are the
> remaining seam, deferred; see [§ Status](#status--what-landed).
>
> **Name** is a placeholder — *koinē aísthēsis*, the common sense that unifies the
> special senses. Rename freely.

## 1. The question

The moment anyone points the system at *their own* data, one question arrives:
given some data and a thing you're trying to see, **which perceptual channels
should carry which variables, and how?** Domains are infinite; data *shapes* and
human perceptual *channels* are small finite sets. So KOINÉ designs no per-domain
view. It compiles over two type systems — the shape of the data, and the channels
of perception — and the compiler is the intelligence.

In one line: **Mackinlay's expressiveness/effectiveness presentation compiler
(APT, 1986), generalized from the visual channel to a cross-modal channel algebra**,
plus two additions the visualization lineage never needed:

1. **A time-character type on every channel** — *sustained* (holds a value) vs
   *transient* (marks an event) — matched to the data's own temporal character.
   Sound is temporal in a way static graphics are not.
2. **A valence / honesty discipline.** Some channels carry emotion (minor mode,
   dissonance, warm colors). Using them for magnitude smuggles in an argument — the
   auditory truncated-axis. The mapping is itself a claim, emitted as data, and
   high-valence channels are quarantined exactly as the rest of eoreader4 quarantines
   rhetoric.

## 2. Architecture — a compiler above the render organs

KOINÉ sits on a modality-independent layer. The MapSpec is the pivot: everything
above it reasons about types; everything below it is a render backend.

```
   dataset
     │  profile()   (SIG: infer each variable's type)
     ▼
  Variable[] ─────────────┐
                          │  compile()   (deterministic CSP over L1–L8)
  Channel[]  (a backend's ┘
   declared catalog)
     │
     ▼
  ┌───────────┐   the modality-INDEPENDENT claim, inspectable + content-addressed
  │  MapSpec  │   "date→position_x · amount→size(√) · donor→unmapped"
  └───────────┘
     │
     ├── toViewSpec(MapSpec, data) ─▶ a VISUAL backend ─▶ pixels   (LIMNER is one candidate)
     └── toScoreSpec(MapSpec, data) ─▶ CANTOR (auditory) ─▶ Web Audio
```

Three properties, mirroring LIMNER's:

1. **The model never touches the hard part.** The assignment is a constraint solve,
   deterministic given (types, importance, catalog). Same inputs ⇒ same MapSpec. The
   model's only optional job is the *importance ranking* — what the finding is —
   which is selection, the task small models do reliably.
2. **One finding renders to eye or ear from one spec.** MapSpec names channels, not
   marks. You can *hear the thing you just saw*; that is the proof the mapping is
   real and not an artifact of one modality — and for a whole population non-visual
   access is the only door in.
3. **Honesty is structural.** The mapping is data you can read and contest, and what
   the mapping *couldn't* show is a first-class `unmapped` field.

The MapSpec is render-backend-agnostic on purpose. LIMNER is *a* visual backend that
can drive position/size/lightness; a canvas/WebGL/DOM renderer would advertise the
same visual catalog. KOINÉ does not import or depend on LIMNER.

## 3. The two type systems

**Variable** (data side, `makeVariable`): `role` (domain axis vs. measure),
`measurement` (nominal/ordinal/interval/ratio/cyclic — the order type), `temporal`
(state/event/rate/static), `cardinality`, `range`/`categories`, `distribution_hint`,
`importance`.

**Channel** (perception side, `makeChannel`): `modality` (visual/auditory/haptic —
haptic reserved), `order` (ordered/categorical/cyclic), `time_character`
(sustained/transient), `capacity` (JND levels), `transfer` (the perceptual
nonlinearity to invert), `polarity`, `valence` (rhetorical load), `integral_with`
(channels not independently readable), `attentional`, `effectiveness`.

A mapping is a typed assignment `Variable → Channel` satisfying §4 and optimizing
effectiveness.

## 4. The laws, as typing rules (enforced by `critique`)

- **L1 Expressiveness.** `measurement` must not exceed the channel's `order`:
  ordinal/interval/ratio → *ordered*; nominal → *categorical*; cyclic → cyclic.
  Nominal-on-ordered fabricates a magnitude; ordinal-on-categorical hides one.
- **L2 Time-character.** A measure's `temporal` matches the channel's
  `time_character` (state→sustained, event→transient). A temporal *domain* is the
  scene's time axis — position in space, onset in sound.
- **L3 Perceptual linearization (tool-owned).** Encoding is never data→channel; it is
  `channel = transfer(normalize(data, distribution))`. Loudness via sone, pitch via
  mel, area via √. Naming the transfer is the contract; the renderer owns the physics.
- **L4 Effectiveness.** Among valid assignments, the highest-`importance` variable
  takes the most effective channel (position > length > area > lightness > hue; pitch
  > tempo ≈ loudness > timbre; onset for events). Domains define the frame first.
- **L5 Capacity.** A discrete variable's levels ≤ channel capacity, else unmapped.
- **L6 Separability.** Two independently-read variables never share an integral pair
  (pitch×loudness, hue×lightness).
- **L7 Polarity.** Ordered mappings follow convention (more→up/bright/high/loud).
- **L8 Valence.** The full MapSpec is inspectable data; high-valence channels are
  quarantined (not used for magnitude unless declared with a justification).

## 5. API (`src/koine/`)

```js
profile(dataset, hints)              // Variable[]  — SIG: type inference (hints override)
channelsFor(modality)                // Channel[]   — 'visual' | 'auditory' | 'cross'
compile(variables, channels, budget) // MapSpec     — deterministic CSP over L1–L8
critique(mapSpec, { channels, variables }) // Violation[] — error | warn | info
mapSpecHash(mapSpec)                 // content address of a compiled claim
```

`compile` is a small solve: domains take the frame axes, then measures by importance
take the most effective legal remaining channel; L3 stamps the transfer; a variable
with no legal channel is honestly `unmapped`. Milliseconds, fully reproducible.

`critique` takes the catalog alongside the spec — the laws are about *types*, and a
bare MapSpec carries ids, not types. (The proposal's 1-arg `critique(MapSpec)` is
refined to `critique(mapSpec, { channels, variables })` for exactly this reason; a
compiled spec embeds its `provenance` so a host can re-resolve the catalog.) It runs
inside compile's guarantee *and* over a hand-edited spec, so a reader's re-patch (an
`EVA` on the log) that breaks a law is caught.

## 6. Position in EO

| Stage | Operator |
|---|---|
| Choose the bindable variables | `SEG` |
| Infer each variable's type | `SIG` |
| Materialize the compiled assignment | `INS` (a MapSpec artifact) |
| Reader re-patches a binding | `EVA` (same model as span edits) |
| Re-profile as data grows | `REC` |

## 7. Worked example — "Downtown Money"

`donor` (nominal, high-card), `recipient` (nominal), `amount` (ratio, skewed),
`date` (event), `days_to_nearest_vote` (ratio); the finding puts importance on
`amount` and `days_to_nearest_vote`. `compile` yields, honestly: `date → position_x`
(the time axis), the two finding measures onto the most effective ordered channels
(√-corrected where the mark is area), and `donor → unmapped` — high-cardinality
identity exceeds every categorical channel's capacity, so it becomes a label-on-demand
and the `unmapped` field says so. `critique` blocks the tempting `amount → loudness`:
a skewed measure hides in ~5 loudness levels (L5) and loudness carries urgency (L8).
The auditory compile of the *same* profile makes each donation a click on the time
axis (`date → onset`) with the finding variable on pitch — a burst of tight clicks
after a governance event is *audible* where a static plot flattens it.
(`tests/koine.test.js` compiles this to eye and ear and asserts both are law-clean.)

## Status — what landed

- **`src/koine/schema.js`** — the two type systems, the MapSpec/Binding, validation,
  and the content hash (the FNV-over-canonical idiom, kept local — no cross-faculty dep).
- **`src/koine/profile.js`** — `profile` types columns (role/measurement/temporal/
  cardinality/distribution) with deterministic heuristics; `hints` override any field
  (where a finding supplies `importance`).
- **`src/koine/transfer.js`** — L3: `normalizer` inverts the data distribution,
  `applyTransfer` the channel's perceptual correction.
- **`src/koine/channels.js`** — the visual catalog (Bertin variables, typed) and
  CANTOR's declared auditory catalog; the valence quarantine threshold.
- **`src/koine/compile.js`** — the deterministic CSP; **`critique.js`** — the L1–L8
  linter with severities; **`index.js`** — the one entrance.

**CANTOR — the ear (landed).** `src/koine/cantor/` lowers a MapSpec to sound, the
auditory mirror of LIMNER. `toScoreSpec(mapSpec, data)` is pure and deterministic: it
turns each data row into a sounding event with a physical time / frequency / gain / pan
and a `ref` back to the row (grounding). It owns the physics L3 deferred — `freqOf`
places the data linearly on the **mel** scale (equal data steps sound like equal pitch
steps, not equal Hz), `gainOf` on the **phon/sone** scale — reading the log/linear
normalization off each binding so CANTOR and the compiler agree where a value sits.
`playScore(score, ctx)` is a thin scheduler on a caller-**injected** AudioContext (no
browser global at import, so it loads and tests in Node against a fake context — one
oscillator + envelope + optional pan per event). The §7 donations profile compiled to
the ear makes each donation a click on the time axis (`date → onset`) with the finding
on pitch — the tight cluster before a vote is *audible*. Open (§8 Q1): live streaming
(for SURFER) vs. offline scores; the current `toScoreSpec` is an offline score.

Deferred (named so the boundary is honest):

- **`toViewSpec`.** The MapSpec → visual backend lowering. A visual backend's
  encoding vocabulary (position-from-a-variable, √-size, lightness ramps) is broader
  than LIMNER's current graph/timeline marks, so this is a real backend extension, not
  a thin adapter — deliberately not forced onto LIMNER.
- **The patch-bay UI** (§6 of the proposal): the two-column direct-manipulation board,
  the critique gutter, the hear-it/see-it scrubber, the channel-budget meter, the
  "what's not shown" panel. The compiler + linter are the engine these render.
- **Importance source** (§8 Q2): a field on `Variable` today (user- or model-supplied);
  the UI question (a priority drag vs. a stated finding) is open.
- **MapSpec storage** (§8 Q3): content-addressed today; archive.org mirror vs.
  OPFS-only is the same open question LIMNER's renders have.

## Relationship to the plexus

`src/plexus/` (docs/parameter-mapping.md) wires a persistent holon from one organ into
another with EOT as the carrier. KOINÉ maps a data variable onto a perceptual channel
with a MapSpec as the claim. Both are the same spine — a **typed assignment emitted as
an inspectable claim, re-patchable as an `EVA` on the log** — over two different type
pairs. The plexus is organ↔organ; KOINÉ is variable↔channel. They are siblings under
"parameter mapping," not the same wire.
