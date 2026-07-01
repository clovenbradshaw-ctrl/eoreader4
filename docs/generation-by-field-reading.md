# The turn is a boundary in the generated field

> A bridge note. `essay-backwards.md` ended at a wall: the fine cadence of an essay —
> when to develop, *when to turn* (REC), when to stop — is **not coaxable out of the
> reader's move-predictor** (biasing it off the last move traps the walk on `CON·EVA·EVA·…`,
> even at recurrence weight 0). The ingestion experiments **exp-0003** (the geography-derived
> reading count) and **exp-0004** (atmosphere + paradigm as boundary channels), plus the
> void primitives in `src/core/voidnull.js`, are the missing mechanism. They read an
> incoming stream as a density field and find its boundaries; generation is that same act
> run forward, over the field the generation is itself laying down. The turn I could not
> fire is a **boundary in the generated field**, and ingestion already knows three ways to
> see one.

## What ingestion built (the object of observation is a density field)

Any modality is read as a density operator ρ (`buildDensity → eigenLenses`,
`src/core/spectral.js`). The **Born rule is the one universal** — every reading is a
projection/overlap, `argmax |⟨u|lensₖ⟩|²`. What is *not* universal is **which contrast
reveals a boundary**. exp-0004 makes the point exactly: there are three, and they are
different projections of the same field.

| channel | what it reads | the primitive | the boundary it catches |
|---|---|---|---|
| **lens-switch** | which reading a unit assigns to | `eigenLenses` + argmax | a change of reading (a new frame / topic) |
| **atmosphere** | the local density **departure** before vs after a cursor | `relEntropy` — symmetric S(ρ_L‖ρ_R) | near-degenerate multiplicity — the field shifts weight with no clean switch |
| **paradigm** | the local **incommensurability** — the eigenbasis rotating | `commutator` — ‖[ρ_L, ρ_R]‖_F | adjacent recurrence — the label is unchanged but the frame *breaks* |

Two more pieces make it honest, and both matter downstream:

- **the geography gate** — `DEF` (the void applied to the eigengap spectrum):
  how many readings the field actually holds is a property of its own spectrum, not a
  constant. A flat spectrum holds one reading and **abstains** — no boundary may fire. The
  same test that counts the readings yields the abstention. "Generate where structure is
  found, dissipate to one where it is not."
- **the void** — `deriveNull`/`boundedNull`/`SEG`: a proposed structure fires only
  if it beats what the field's own non-cohering background would produce by chance (the
  Born noise-null, extreme-value corrected). `SEG` reads a change-point curve and
  keeps only the peaks that clear that line.

## The mapping to generation (each open seam, answered)

`essay-backwards.md` left five things unbuilt or wrong. Each is a face of the same
field-reading act, turned forward — the source switched from the world to the self
(`spec-generation.md`). This is the concrete form of its "read self back through the
perceiver" seam.

**1. The turn (REC) — I approximated it; the field measures it.**
`essay-backwards.md §7` found REC was dead because strain was `1 − boundFraction` (a
grounding verdict), and the floor keeps every appended atom at ~1.0. I bolted on a
`semanticStrain` self-fold: lexical novelty of an atom against everything said. That is a
**poor-man's atmosphere** — a lexical stand-in for the Umegaki density departure
`relEntropy` computes properly. And the *sharper* turn signal is **paradigm**: REC is
`structure.js`'s "the strained frame and the figure that breaks it," which is *exactly* a
basis rotation — `commutator(ρ_before, ρ_after)` peaking. Read the accepted atoms back as
a field and the turn is where atmosphere and paradigm peak over that field. No lexical
proxy, no `1 − boundFraction` conflation — the real contrast.

**2. The fine cadence — it lives in the field, not the predictor.**
The negative result of `§8` was that the interleave (introduce → develop → turn) cannot
be biased out of the move-predictor. Correct — because the cadence is not a property of
the move sequence, it is a property of the **field's boundary geography**. Atom *k+1*
turns when the field ρ over atoms `0..k` has a boundary at *k*; it develops when it does
not. The predictor says *which operator*; the field says *whether this is a boundary*.
That division is the whole resolution: stop steering the operator sequence, read the field
the operators are laying down.

**3. Quiesce / stop — `DEF` going flat.**
`essay-backwards.md` stopped on span-exhaustion or a coarse land rule. The principled stop
is the geography gate: when the field of accepted atoms holds only one reading
(`DEF` abstains), there is nothing left to distinguish — the honest move is to
close. The same abstention that keeps ingestion from cutting flat noise keeps generation
from developing a field that has gone flat. Length dissipates to one atom exactly where the
evidence does.

**4. The floor (SYN/NUL/VOID) — already the same void.**
The generator's floor and the ingestion void are one mechanism. `SEG`/`boundedNull`
is the Born noise-null; SYN fires when a proposed structure beats it, NUL holds, VOID
asserts absence. The generation weld and the ingestion gate are the same firing rule,
modality-blind, pointed at self instead of world.

**5. Generate-then-read parity — it is literally this.**
The control `spec-generation.md` names — feed the generated output back through the reader
and check the boundary trajectory matches the plan — is *running these detectors on the
generated atoms*. The target trace in `eoreader4-eval/essay-backwards.trace.json` is a
boundary sequence; parity is the atmosphere/paradigm/lens curve over the output having its
peaks where the trace has its turns.

## Why this is the right shape (the Meno frame)

`docs/common-sense.md` (THALAMUS) states the principle the generation architecture already
runs on: **the model points; a deterministic engine constructs.** The sayer works in
tokens and cannot *say* the diagonal — continuous magnitude, rate, shape. The turn of an
argument is such a diagonal: a small model asked to "write a turning sentence" reverts to
its priors and confabulates a turn. So the planner must not ask it to. The **field**
constructs the turn (the boundary is a fact about ρ, computed, not emitted), and the model
only renders the proposition the boundary resolves to. The self-register and the self-fold
were the first two steps toward that; atmosphere/paradigm/`DEF` are the organ.

SURFER already navigates ingestion by surprise — the KL rate, a diagonal you can only feel
against the expected (`common-sense.md`, SURFER coupling). Generation navigates the self
the same way: the self-fold's departure *is* that surprise, pointed at the generated field.
One navigator, two sources.

## Built — the field read is wired into the loop

The prototype is in the tree, opt-in behind `fieldRead` + `interleave` (default off; the
full suite stays green at 1772). `src/longgen/field.js` reads the accepted atoms back as a
density field each step:

1. embed the atoms (any `embed` fn; the hash organ by default), **normalise but do not
   center** — centering antipodes a low-cluster split and a density is sign-blind, so a
   clean two-topic turn would collapse (verified: centered kills `A|B@4`);
2. at each interior cursor compute **atmosphere** `relEntropy(ρ_L, ρ_R)` and **paradigm**
   `commutator(ρ_L, ρ_R)` over trailing windows (skipping the rank-1 frontier, which reads
   as a spurious departure against any field);
3. pick the turns with the **Born void** `SEG` over each curve, union them (exp-0004's
   fusion), and mark the boundary and its wake as the `strain` the structural prior reads —
   *replacing* `1 − boundFraction` and the lexical self-fold;
4. read `DEF` over the field spectrum; a flat field with no turn **quiesces**;
5. the `interleave` scheduler walks the ground introduce/develop so a turn lands right after
   an EVA, where the loop realizes it as a **REC**.

`src/core/voidnull.js` now carries `DEF`/`SEG` (brought over from
`claude/new-session-qnyzcs`, identical source so it merges clean); `relEntropy`/`commutator`/
`eigenLenses`/`buildDensity` were already on `main`. **Result** (`npm run essay-backwards`,
and `tests/essay-backwards.test.js`): on a three-topic turning ground the loop walks
`CON·EVA·CON·EVA·CON·EVA·CON·EVA·CON·EVA·REC·CON·EVA·CON·EVA·CON·SYN` — introduce/develop
pairs, a **REC where the field rotates**, and a **SYN** landing. The turn is read off the
generated field, not coaxed from the move-predictor. The unit tests pin the detector: an
`A|B` field fires a boundary at the seam; a flat field abstains.

## How close are we to a full pipeline?

The generation act is *navigate → resolve → realize → floor → weld*, guarded, shaped, and
stopped. Component by component, on this branch:

| piece | status | where |
|---|---|---|
| answerability gate (§3) | **built** | `longgen/answerable.js` |
| navigate — p(next) predictor | **built** | `predict/`, `longgen/direction.js` |
| resolve — self-register (edge ops on the self) | **built** | `longgen/resolve.js` |
| realize — one-proposition render | **built (echo)**; needs a real small model | `arc/generate.js` |
| floor — bind + veto | **built** | `ground/` |
| weld — strain feedback | **built**, now **field-derived** | `longgen/direction.js` + `field.js` |
| shape — significance arc | **built** | `longgen/shape.js` |
| **field read — the turn as a boundary** | **built + verified** | `longgen/field.js` |
| interleave — the §4.2 scheduler | **built, coarse** | `longgen/continuation.js` |
| quiesce / saturation stops | **built** | `continuation.js`, `arc/saturation.js` |
| prefix caching / atom speculation (§9) | **partial** (symbolic half) | `longgen/prompt.js` |
| embedder that measures meaning | **stub** (hash is bag-of-words) | `model/embed-hash.js` |
| real small-model render | **not wired here** (echo); exists in the mechanics harness | `eoreader4-eval/mechanics/` |
| §4.2 resolver, full (edge on a real graph) | **coarse only** | `resolve.js` seam |
| corpus-built concept graph | **authored/hand-fed** | — |

**The read.** The *control structure* of a full generation pipeline now exists and runs end
to end: it opens, develops on the self, **turns where its own output rotates**, lands, and
stops on its own — every claim witnessed by the floor. That is the spine `spec-planner.md`
and `spec-generation.md` describe, closed. Three gaps stand between this and *good essays*,
and none is structural:

1. **A meaning embedder.** The hash organ is `measuresMeaning:false` — spelling space. The
   field read detects *lexical* turns today; a MiniLM-class embedder (already used by the
   mechanics harness) makes the turns *semantic*. This is the highest-leverage swap and it is
   a dependency injection, not a redesign.
2. **A real renderer.** Echo returns spans verbatim, so the prose is not yet prose. Wiring
   the SmolLM2 talker (present in `eoreader4-eval/mechanics/`) as the `model` gives real
   sentences under the same one-proposition contract.
3. **The full §4.2 resolver.** The interleave here is a coarse strict-alternation scheduler.
   The full form resolves each move to a specific *edge on a referent-and-relation graph*, so
   the develop/turn structure is read off the subject's own graph rather than the ground order.

In short: **the pipeline is complete in mechanism and gated behind flags; it is stubbed in two
organs (embedder, renderer) and coarse in one seam (the graph resolver).** Swap the two stubs
for the components that already exist elsewhere in the repo and run it on a real document, and
the generate-then-read parity control (`essay-backwards.trace.json`) becomes the measurement
of how good the essays are — the toggle `spec-planner.md §11` always intended.

**The real-model swap is now wired.** `eoreader4-eval/essay-real-model.mjs` injects the
mechanics harness's SmolLM2-360M talker (`model`) and MiniLM meaning organ (`embed`, so the
field turns are *semantic*) into `runContinuation` with `dynamics + fieldRead + confine`, and
exports the audit. The adapter is dependency-injection only and is locked in CI by
`tests/real-model-wiring.test.js` (real-model-*shaped* async organs → the pipeline runs and the
audit reads WORKING) and demonstrable without any download via `npm run essay-real-model:mock`.
The real path (`npm run essay-real-model`) does **not** complete in the standard agent
environment: `onnxruntime-node`'s post-install downloads its native binary from GitHub releases
and the egress policy returns **403 Forbidden**, so the ONNX runtime and the q8 weights cannot
be fetched here. Run it where that fetch is permitted and the two models reach the HF cache; the
wiring is verified and waiting.

## Files referenced


## Files referenced

- ingestion channels: `experiments/exp-0003-omnimodal-sense/`, `experiments/exp-0004-atmosphere-paradigm/` (branch `claude/new-session-qnyzcs`)
- the void + count: `src/core/voidnull.js` (`deriveNull`, `boundedNull`, `SEG`, `DEF`) — same branch
- the field primitives (on `main`): `src/core/spectral.js` (`buildDensity`, `eigenLenses`, `relEntropy`, `commutator`)
- the common sense / Meno frame: `docs/common-sense.md`, `docs/thalamus.md` (branch `claude/parameter-mapping-organs-wu2vuy`)
- the generation investigation this bridges from: `docs/essay-backwards.md`
