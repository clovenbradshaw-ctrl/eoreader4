# Grounded speech at the proposition — the talker holon

> Follow-up to the edge-grounding veto. Grounding moves from a flag **after**
> speech (`ground/veto.js` standing alone) to the **selection** of speech
> (`talker/gate.js`), and the unit of grounding moves from the claim-string to
> the **proposition**, because only a proposition can be true (Frege/Codd). The
> timing moves from post-hoc to **during generation**.

The edge-grounding veto reads the talker's finished prose and flags what the
document does not witness. This holon is the same correspondence, run one step
earlier and one unit finer: the talker measures each candidate **proposition**
against a grounded basis **as it forms it**, and only what grounds is ever
spoken. The veto stays — repositioned to the auditory loop, confirming grounding
rather than supplying it (Levelt's monitor + auditory loop; Dehaene's ignition).

The whole path is flagged (`RULES_REV`) with the existing `phrase()`+veto path as
the byte-identical golden until the gated path wins the Metamorphosis battery
(`docs/metamorphosis-battery.md`).

## The five seams

```
model/interface.js   propose(messages, opts) → AsyncIterator<Dist>, beside phrase().
                     the next-token distribution, no internal sampling, no weights
                     touched. backends without logit access keep phrase() only and
                     the talker falls back to the golden path (non-breaking).
talker/segment.js    SEG over the proposal stream: cut the token murmur into
                     candidate propositions (units with a truth condition).
talker/props.js      the proposition unit + RELATIONAL correspondence (subject id ·
                     relation type · object id), lifting ground/bind.js off lexical
                     overlap. paraphrase grounds; verbatim echo is not privileged.
talker/basis.js      surf → grounded basis: the stops' props (with surf amplitude),
                     the void basis (absence as an element), the question's targets.
talker/gate.js       DEF·EVA·REC over each candidate: measure against the basis,
                     collapse what beats the null at alpha into speech, hold or VOID
                     the rest, roll back what fails at the committed edge.
```

`ground/veto.js` is unchanged in code; it now annotates the gated output (§8).

## The collapse (talker/gate.js)

Per candidate proposition, not per token. The proposal advances one proposition
past the committed edge (speculative); SEG closes the candidate; the gate
measures two correspondences, both relational:

```
findingMatch  = correspond(svo, basis.props)            // is it TRUE
questionMatch = correspond(svo, basis.question.targets) // is it RESPONSIVE
support       = basis amplitude of the matched finding   (0 if none)
relevance     = question amplitude of the matched target (0 if none; neutral 1 if
                                                          no target basis parsed)
redundancy    = 1 − already-spoken support for this prop
projection    = modelAmplitude × support × relevance × redundancy
```

REC: `projection > derivedNull(alpha)` → **COLLAPSE** (append to the committed
edge, emit the surface, deplete the prop's support); else **ROLL BACK** (the
committed edge is unchanged — the talker never builds on a rejected thought) and
regenerate, discouraging the direction; or, where a question target has no
supported prop, **VOID** — emit the fixed conscience token "The text does not
say," selected by the gate.

The multiply is the protection. Three failure modes, one product:

| failure | support | relevance | product | outcome |
|---|---|---|---|---|
| true but irrelevant | >0 | ≈0 | ≈0 | held |
| fluent hallucination | 0 | — | 0 | cannot collapse |
| on-question, unsupported (the dangerous one) | 0 | >0 | 0 | blocked → VOID |

## alpha — the one knob (§9)

The gate's null threshold is the same `alpha` as the reader's VOID boundary
(`read/answerable.js` `ANSWERABLE_ALPHA`). Low alpha: speak only strong
correspondences, abstain often. High alpha: speak weaker ones. The talker's
reticence is the reader's willingness-to-see-structure — one tolerance, two
measurements. Not a new constant.

## Thinking vs speech = the committed edge (§6)

`committedContext` holds only collapsed (grounded, relevant, non-redundant)
propositions. The proposal advances past that edge speculatively; a candidate
that collapses joins the committed context, a candidate that fails is rolled back
and the context resets to the edge. Speech is behind the edge; thought is past
it; the gate is the edge.

### Open risks — prototyped in `.probe/` (gitignored scratch), findings here

The spec named three risks to prototype before trusting the loop. They were, and
the findings are recorded so the next tuner does not re-derive them:

1. **Rollback can loop on degenerate retries.** A deterministic proposal cannot
   offer an alternative on rollback, so a naive loop spins. *Finding:* a
   consecutive-failure budget (`ROLLBACK_BUDGET`, reset on every collapse)
   converts a would-be spin into a clean VOID — the unsatisfiable target breaks
   the loop immediately because it is never *supported-unspoken*. The discourage
   seed (content words) is cheap and honest but coarse; a real logit-space push
   is the un-probed part, and is safe to leave un-probed because the cap bounds
   the loop meanwhile.
2. **SEG must be cheap or it stalls the loop.** *Finding:* the per-proposition
   SEG read (a light SVO parse of the forming surface) is ~tens of µs — orders
   below a CPU token decode (ms). It does not stall the loop at this grain.
3. **Speculative generate-and-rollback wastes tokens.** *Finding:* the
   committed-edge reset bounds re-work to **one proposition** (not the whole
   reply), and redundancy depletion stops re-proposing a spent prop. The real
   budget lever is the rejection rate — i.e. the quality of §5 correspondence and
   §4 amplitudes — so a high waste ratio is itself the regression signal to
   watch, the same signal a RISE in veto firing gives (§8).

## veto.js — repositioned to the auditory loop (§8)

`ground/veto.js` is unchanged in code and intent; it moves from sole gate to
post-collapse annotation. Because grounding is now constructive, vetoes should
fire far less; a **rise** in veto firing is a regression signal that props are
crossing the gate that should not, pointing at §5 correspondence or §4
amplitudes. Same answer surface, now grounded by construction, with vetoes
confirming rather than supplying.

## Build order + golden parity (§10)

`RULES_REV` defaults **off** — `process.env.RULES_REV` flips it for a bench. With
it off, `turn/stages.js` `llm` takes the `phrase()`+veto path, byte-identical to
before (verified: the full suite passes in both modes). With it on AND the
backend exposes `propose` AND the surfer's reading is in hand, the `llm` stage
runs the gate; its emitted surface flows through the same bind → factcheck → veto
stages, so the veto confirms what the gate selected. The gated path becomes the
default only once it beats the battery — grounded recall up, the forbidden gate
holds, VOID fires on the species / cause / origin silences, two-turn coherence
holds — and `phrase()` stays as the no-logit fallback.

## The novel delta over constrained decoding

It constrains decoding **at the proposition** by **relational** match to ground,
with VOID as a first-class outcome — protecting truth where the constrained-
decoding field protected syntax.
