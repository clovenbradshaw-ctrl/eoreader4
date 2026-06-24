# Source trajectory — the `credence` holon

> Status: stage one (read-only measurement) landed behind the gate.
> Holon: `src/credence/`, depends on `core` only. Additive — a second
> projection over the one append-only log, no new spine.

A source is not a fixed quantity of trust. The same outlet is more or less full
of shit at different times and in different domains. So the object tracked here
is not a number attached to a source — it is a **path** the source moves along,
segmented into **regimes**, conditioned on the **domain** of discourse. Truth
itself is never held; every measure is relational — a source scored against
itself, against independent others, and against its own past.

The path lives on two coordinates:

- **Modelfulness `M`** — how much state sits behind the claims. High when they
  cohere and hold their shape under pressure; low when they wash out under
  resampling. The seeker and the competent liar both score high; the bullshitter
  scores low.
- **Orientation `O`** — the signed heading toward (`+`) or away (`−`) from the
  corroborated record. Defined **only where `M` is high** — there is no
  orientation without a model to orient.

The three types form an **L, not a line**: `M` separates the bullshitter from the
other two; `O` separates the seeker from the liar, and only high `M` makes `O`
meaningful. This is Frankfurt's claim made geometric — bullshit is orthogonal to
truth, not a stronger grade of lie.

The cost structure follows: `M` is cheap (it reads off the source's own claims,
no external truth), so the **BULLSHITTER call is assertable** (it gets a `DEF`).
`O` is expensive (it only resolves as independent corroboration grows without
bound), so the **SEEKER-vs-LIAR call ships as a tightening interval that never
closes to a verdict** — it never gets a `DEF`.

## What landed (stage one)

Per the spec's own build discipline (§12): *the cheap read-only measurement comes
first; the integration points turn on only on a positive measurement.* So this
stage is the measurement and its conformance, behind the gate. The retrieve/veto
wiring is implemented as pure, unit-tested, **gated-off** functions and is **not**
spliced into the live turn — that is stage two.

| Piece | File |
| --- | --- |
| Beta forgetting filter, EW mean/variance, regularized incomplete-Beta + inverse (credible intervals) | `src/credence/filters.js` |
| Page-Hinkley changepoint detector (clamped two-sided CUSUM) | `src/credence/detect.js` |
| `projectCredence` — the pure, memoized fold; coordinates `M`/`O`; classification; regimes; velocity; `DEFAULT_CREDENCE_RULES` | `src/credence/project.js` |
| `createCredenceBook` — the write side: three channels, write-time changepoint emission, independence, the `DEF` bullshitter verdict | `src/credence/book.js` |
| `credenceReweight` / `credenceFlag` — the two integration points, pure and gated **off** | `src/credence/integrate.js` |

`projectCredence(log, frame)` mirrors `projectGraph` exactly: pure on
`(log, frame)`, memoized on `(log.length, frameSig)`, rules arriving through
`frame.rules.credence` with `DEFAULT_CREDENCE_RULES` as fallback so the memo key
serializes them. The state is never stored — it is the fold of the events. Lose
it, rebuild by replay.

## The event vocabulary

Three channels, five writes, the only inputs — appended to the same log the graph
reads. The operator each rides is the spec's mapping (§8):

| kind | op | channel |
| --- | --- | --- |
| `coherence_obs` | EVA | internal coherence, the cheap bullshitter detector |
| `corroboration_obs` | EVA | independence-weighted survival, the slow alignment stand-in |
| `revision_obs` | EVA | signed response at a disconfirmation |
| `changepoint` | SEG | a regime boundary the detector named |
| `credence_init` | NUL | marks a (source, domain) never-set, held distinct from low |

The one **output** the system asserts is a `DEF credence_verdict` — and only for
the BULLSHITTER call. `O` never gets one.

## Three decisions worth their comments

These are the places the obvious implementation is wrong:

1. **The EW variance seeds its mean from the first observation.** Dragging the
   mean up from a phantom zero makes `(x−0)²` on the first step masquerade as
   dispersion for the filter's whole memory window — and the tomographic
   convergence gate, which reads that variance, would then mistake every fresh
   source for an unstable bullshitter. (`filters.js`)

2. **The changepoint CUSUM is absolute, not standardized.** The channels are
   bounded, so a tolerance set *above* within-regime jitter and *below* a real
   regime shift keeps a stationary stream — erratic (a bullshitter) or tight (a
   seeker) alike — as **one** regime, while a genuine mean shift trips it in a
   step or two. A standardized CUSUM instead fragments low-noise streams, because
   tiny wiggles are many σ. Revision (signed, `[−1,1]`) is left off the segmenter:
   its regime signal is its *variance*, which feeds `M` directly. (`detect.js`)

3. **Independence is an effective-count, not a sum.** `K` is only as good as the
   independence weights — the spec's named soft spot. Five sock-puppets sharing an
   author are ~one voice, so the corroboration weight is
   `(Σwᵢ)² / Σᵢⱼ wᵢwⱼρᵢⱼ` (ρ = 1 − independence), computed at write time where the
   source descriptors live, and ridden on the event so the projection stays pure.
   A like-author cluster collapses to ≈ 1; an independent set of the same size
   gives `k`. (`book.js`)

## Conformance

`tests/credence-separation.test.js` is the **build gate** (§12, criteria 1–2): the
three synthetic types separate on the `(M, O)` plane with no ground-truth input.
`tests/credence.test.js` covers §5–§10 (independence guard; interval honesty / no
gag; replay determinism; the asymptotic axis tightening but never closing, and no
`DEF` on `O`; domain separation; and the three distinct void states — never-set,
cleared, observed-but-uncertain). `tests/credence-regime.test.js` covers §3–§4
(a dated break, two regimes, forgetting and reform). `tests/credence-filters.test.js`
pins the estimators. `tests/credence-parity.test.js` is the golden gate: graph
projection is byte-identical with credence events on the same log, and with the
channels off nothing is written at all.

See the separation for yourself:

```
node scripts/credence-measure.mjs   # or: npm run credence
```

## Stage two (gated, not yet wired)

The spec's §9 integration turns on only now that the measurement separates:

- **retrieve** — a low-`M` source's spans in the relevant domain are
  down-weighted through `frame.rules`. `credenceReweight(prior, state, rules)` is
  the prior multiplier; it changes the prior, never the retrieve contract, and is
  floored so a flag is never a gag. The wiring point is the channel fusion in
  `src/retrieve/hybrid.js`.
- **ground / veto** — a claim bound by CON to a source carries that source's
  regime and classification. `credenceFlag(state, rules)` returns a veto-shaped
  annotation (`refuses: false` — flag and tell, never gag): a low-`M` source draws
  "unsupported by a coherent source in this domain", a LIAR draws "modelful but
  anti-aligned, signal recoverable under inversion". The wiring point is the
  `VETOES` battery in `src/ground/veto.js`.

Both are behind `credenceEnabled(rules)` (`rules.credence.enabled`, default
false), so the existing paths stay byte-identical until the flag is flipped.
