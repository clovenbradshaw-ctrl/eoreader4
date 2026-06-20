# Part I — One Surprise: the emergent, holistic, robust core

*Against `clovenbradshaw-ctrl/eoreader4` @ 9381e78, read fresh. The foundation half of a two-part arc; Part II is the generator (spec-generation.md). This part unifies the surprise mechanism across modalities so structure and meaning emerge from one arithmetic. Four tracks, each gated by a cheap measurement that can come back negative, each held to golden parity on the text path. The generator is not built here, but the one decision that determines whether this core can turn around into a generator is made here, in Track A: the forward distribution `p(next | profile)` is built as an explicit shared object, the thing reading scores against and generation draws from.*

## Current state (what the repull establishes)

There are **three** surprise computations today, not two:

1. **Text predictive surprise** — `reading.js`, `surprisalBits`: `−log2 p(line)` under a γ-decayed figure prior ("who acts next"), squashed to `surprise = 1 − 2^−s`.
2. **Text Bayesian surprise** — `reading.js`, `bayesBits`: `D_KL(posterior ‖ prior)` over the γ-decayed proposition field `priorProp`, with `bayesBy` the per-dimension KL contribution (the directional-strain axis). This is the channel the surfer's cursor rides.
3. **Music move-surprise** — `predictor.js`: a weighted geometric-mean product of three priors (recurrence n-gram × structure frame-nudge × grammar), `surprisalBits = −log2 p(move)`.

The unifying machinery already exists and is only partly used. `voidnull.js` computes a streaming extreme-value quantile (`deriveNull`, `createNoiseFloor`, `extremeValueZ`, one human knob `alpha`) — the Born rule. The 27 cells exist in `phasepost-cells.json` with the full Significance row (DEF/EVA/REC × Atmosphere/Lens/Paradigm), but they are a **verbalizer lexicon and an addressing scheme** (`eoAddressOfEvent` → site/resolution), not the basis surprise runs over, and Atmosphere is thin (`DEF_Clearing_Atmosphere` 0.4% attested_partial; `REC_Cultivating_Atmosphere` provenance "empty"). The impulse threshold in `enact/loop.js` is an absolute `0.95` on a compressed scale the meaning-reader's surprise never reaches — the code comment already names the fix and has not taken it.

## The invariant the whole spec serves

There is **exactly one surprise**: `D_KL(posterior ‖ prior)` over a γ-decayed **referent profile** in a **fixed basis**, taken at the streaming cursor, with a paired predictive channel `−log2 p(arrival)` under that profile, and a per-dimension contribution so the strain has an axis. The basis is frozen; the referent profile is the plastic layer that tunes to whatever keeps arriving. **The only modality-specific code is the front-end map from raw signal into the basis.** Everything past that map — the referent profile, the divergence, the null, the boundary, the fold — is shared. That is what makes the core holistic rather than three readers in a trench coat.

## Track A — One surprise, and the forward distribution it is scored against

Extract the surprise core from `reading.js` into a modality-agnostic `surpriseAt(priorProfile, arrival, basis)` returning both channels (`bits`, `bayesBits`, `bayesBy`). It is the form `reading.js` already computes for text Bayesian surprise; the work is to make it the **only** form.

But surprise has two objects, not one, and the spec must build both or the core cannot turn around. The referent profile is a **backward** object: the γ-decayed summary of what has arrived. Scoring an arrival also requires a **forward** object: an explicit distribution `p(next | profile)` over what arrives next. Reading scores the arrival under `p(next)`; generation draws from `p(next)`. Same distribution, two uses. If Track A builds only the backward profile and computes surprise by any path that never materialises `p(next)`, the recognition core is built in a shape that cannot generate, and the generator becomes a forward model bolted on later. So `p(next | profile)` is a first-class output of the core, not a by-product.

The asymmetry is why this is a decision and not a detail. Music already has `p(next)`: `predictor.js` produces a posterior over the next move, and sampling it instead of taking the argmax is nearly a generator already. Text does not: `reading.js` "predicts" only that the heaviest figure acts next, a recognition summary, not a distribution over the next proposition. Track A's real work on the text side is to grow text's equivalent of the music posterior, a genuine `p(next-proposition | profile)`, because **that distribution is the generative model**. Build it into the foundation and "cursor forward, comparison to draw" is literal; skip it and we re-architect the profile when Part II arrives.

- **Text** calls `surpriseAt` over the figure/proposition basis, unchanged in scoring result, and now also emits `p(next)` over the proposition basis (the grow-the-posterior work above).
- **Music** calls it over the tonal-move basis, and the three priors stop being a separate fusion: recurrence, structure, and grammar become the way the **tonal referent's profile** forms `p(next)`, not a parallel product. The referent is the key-as-it-stands; surprise is the divergence of the arriving move from `p(next)`. This is also the music improvement from the prior analysis: predict the move-against-the-frame, let the structure prior carry hierarchical weight instead of a nudge, and let REC relocate the frame so the post-modulation plateau collapses to a spike.
- **The phasepost path** calls it over the 27-cell basis: a unit activates the cells, the referent keeps an EWMA profile over them, `p(next)` is the expected cell-distribution, surprise is the divergence in that fixed basis.

**Measurement first (can come back negative):** on a known piece, compare music's current three-prior surprisal against a referent-profile surprisal over the tonal basis. If they already track, the unification is cosmetic and the win is the shared code plus the explicit `p(next)`; if they diverge, the divergence is the improvement, and the post-modulation plateau is where to look for it.

**Parity gate:** `surpriseAt` must reproduce the current text `surprisalBits`/`bayesBits` byte-identically before music or the phasepost basis is pointed at it, and emitting `p(next)` must not change the scoring result on the 202 goldens. The forward distribution is added alongside the scoring path, never in place of it. The unification is earned on the most-tested path first, then extended.

## Track B — Null-relative everywhere (the Born rule on every EVA)

Every threshold that is currently a constant or a global statistic becomes a streaming `createNoiseFloor` quantile fit **causally** to the reader's own surprise distribution, with the one knob `alpha`. This is the three logged meaning-reader gaps, which are the same item seen from inside the text path:

- **The impulse threshold** (`enact/loop.js`) becomes a high quantile of the reader's own EVA distribution, not absolute `0.95`. The comment already specifies this; wire it to `deriveNull`. An absolute threshold cannot transfer across modalities or scales; a quantile can.
- **The band becomes causal** — fit from the surprises seen so far, not a global acausal median. A reading must not use its own future to calibrate its present.
- **The per-dimension contribution** (`bayesBy`) is supplied to the meaning-reader so directional strain is live there rather than dead.

**Measurement first:** count how often the absolute impulse threshold fires on the compressed meaning scale. If it never fires (0.95 unreached), that is the dead-threshold confirmed and the re-fit is forced; if it fires sanely, the scale is not as compressed as feared and the priority drops.

## Track C — Shared referent and boundary layer

Extract two shared modules so the modality-specific code shrinks to the front-end:

- **The referent layer** — the per-referent γ-decayed profile over the basis, its EWMA update, and the `SYN` merge under defeasible identity. A voice in music, an entity in text, a blob in video are one object: a referent, a mass with a profile, merged and defeated by the same machinery. Today the profile is computed inside `reading.js` and the music path carries its own; unify them.
- **The boundary layer** — `REC` firing on accumulated strain that beats its (now null-relative) threshold. A phrase end, a section, a scene cut, and a paragraph are one event: the frame breaking under surprise it could no longer absorb. No modality hand-segments.

**Measurement first:** diff how much of the music referent computation and the text referent computation actually overlap. High overlap means extraction is safe; the residue is precisely the modality leak to push back down into the front-end.

## Track D — The Significance row, so the basis carries meaning (Atmosphere first)

The largest track, sequenced in parallel and last, because without it structure emerges robustly and meaning stays shallow. The Significance cells exist as lexicon but units are not classified into them as a live basis, and the Ground column of that row — Atmosphere — is the unbuilt field. Build the **Atmosphere field**: the ambient significance-tone, Significance × Ground, the meaning-domain analog of the γ-mass field, so a unit activates the significance cells and the referent profile carries meaning and not only structure. This is the field that registers a passage reading as evasive before it can name the evasive clause, and it is the same gap reached from every other direction.

**Measurement first:** with current classification, count how many units the significance cells would claim. Near-zero confirms the meaning layer is shallow and the field is needed; a healthy count means the cells are already firing and the work is calibration, not construction.

## Sequencing and discipline

A and B first and together: one surprise form, every threshold null-relative, both proven on the text golden before music or the cube basis is pointed at the new core. C next: the shared referent and boundary layer, which only makes sense once the surprise it serves is one thing. D in parallel and continuing: the Significance row is its own long track because it is construction, not refactor.

Every output change ships behind a `RULES_REV` flag with a parallel golden, so the 202 snapshots stay byte-identical on existing paths until the new core is proven to reproduce them. Every track opens with the cheap read-only measurement above, which is allowed to come back negative and cancel the track. Approach-from-below on every uncertain assertion: the unification is a claim that the three surprises are one, and the parity gate is what makes that claim falsifiable rather than asserted.

## The bridge to Part II

With `p(next)` an explicit output of Track A, generation is that distribution **drawn from** instead of scored against: the low-surprise draw to stay in frame, a deliberately higher-surprise draw to make a move. But a draw over `p(next)` is not yet a generator, for three reasons that are Part II (spec-generation.md), not this part:

- **The plan needs the right granularity.** A draw over the 27 cells alone says "next is an EVA at the Lens" and leaves the content open, so the talker reverts to its own priors, which is thin-structure confabulation one level up. The plan substrate must be the referent-and-relation graph, a specific proposition, which is also why Track D is not optional for generation: without the Significance row the plan carries structure and no meaning.
- **The realize loop is unbuilt.** The engine plans a step; the talker renders it; the floor checks the rendering forward, asking whether the prose matched the planned structure. That is the grounding floor run in the generate direction, a handshake not yet specced.
- **The loop must close on itself.** "Structure unfolding before itself" means the generated unit folds back into the profile as the next prior, with the self-fold firewall so the engine does not anchor on its own output as ground. The reading loop is open; generation closes it, source switched from document to self.

This part is solid when the core is one surprise, every threshold is null-relative, the referent and boundary layers are shared, and `p(next)` is a first-class output proven not to disturb the goldens. Part II turns the cursor forward.
