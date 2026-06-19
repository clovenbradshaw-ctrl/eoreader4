# Bayesian surprise — what the reading follows

> Deepening of reading-levels §3 (significance) and the significance loop. The
> Level-3 surprise used to be **surprisal** — −log p, how improbable the figures
> were. That is the wrong invariant for where a reading's attention goes. This
> doc replaces it with **Bayesian surprise** — how far the reading's beliefs
> *moved* when a line landed — and keeps surprisal as a second, named channel.

## The TV-snow problem

Surprisal is self-information: a figure the γ-mass prior did not expect scores
high, a confirming one scores low. It is the obvious measure and it is wrong, for
the reason Itti & Baldi named (NIPS 2005): television snow is **maximally**
improbable — every frame astronomically unlikely — and **completely
unsurprising**, because it never changes your model of what you are looking at.
A spelling anomaly, an odd-but-inert token, a one-off name: all improbable, none
worth arresting on. Surprisal chases them. The quantity attention actually
follows is the divergence between belief *before* and belief *after* the data:

```
        surprise  =  D_KL( posterior ‖ prior )        "wows", not bits-of-luck
```

— how much the line *rewrote* the reading, not how unlikely it was.

## The proposition field is the distribution

The reading maintains a distribution not just over *who is on stage* but over
*what it takes to be the case* — the **proposition field** (`priorProp` in
`reading.js`). Its atoms are:

- **participants** — every figure, and every referent a figure acts on (the
  object of a bond: `the floor`, `the picture`, `the window`);
- **propositions** — the `src|via|tgt` triple a `CON`/`SIG` edge carries (the
  event/relation itself);
- **predicates** — the `id|value` a `DEF` carries.

`P(atom) = mass(atom) / Z`, with a fixed `NOVELTY` reserve atom holding
probability for an as-yet-unseen atom. Bayesian surprise is the KL between this
field before and after a line is folded in. Because the field carries the
propositions, an **event on a standing figure moves belief** — the festering
wound, the disowning — not only a change of cast. (Earlier this field was figure
`INS` only; significance then meant "the cast shifted," and the reading was blind
to every event that introduced no new name — the metamorphosis itself scoring
zero. Widening the field to the proposition is what fixed that.)

The posterior is the prior advanced one step. Each incumbent decays by γ; each
atom delivered at the line (a participant, a proposition, a predicate) deposits
γ⁰ = 1:

```
m′(atom) = γ · m(atom) + (deposits at this line)
```

| | mass before | deposit | mass after |
|---|---|---|---|
| incumbent, quiet | m | 0 | γ·m  (decays) |
| incumbent, recurs | m | +1 | γ·m + 1 |
| **newcomer** | **0** | **+1** | **1** |

KL is taken over the common support (every figure present in the posterior, plus
the reserve atom), with the prior **renormalised over that support**:

```
prior weight   w(id) = m(id)         for an incumbent
               w(id) = pNovel        for a newcomer (its share of the reserve)
               w(NOVEL) = NOVELTY
P(x)  = w(x) / Σw          P′(x) = m′(x) / (Σm′ + NOVELTY)
bayesBits = Σ_x P′(x) · log₂( P′(x) / P(x) )        ≥ 0
bayes     = 1 − 2^(−bayesBits)                       squashed to [0,1)
```

## The newcomer: no mass, but velocity

A newcomer arrives with **zero mass** (no retention, no history) and a **full
deposit** (γ⁰ = 1, the heaviest a single line can land). Position zero, velocity
maximal — pure present tense. The velocity-at-entry is always +1, identical for
every newcomer, so velocity itself is not the signal. What the surprise measures
is what that velocity does to the distribution, weighted by the **protention**
still held open — the `NOVELTY` reserve.

Because the reserve is a **fixed atom**, its *share* of attention shrinks as the
cast fills (`pNovel = NOVELTY/Z`, Z growing). So:

| field | reserve share | a newcomer is… |
|---|---|---|
| sparse, early | large | half-expected — **low** KL |
| committed, late | small | a violation of a confident expectation — **high** KL |

The stranger walking into an empty room is *expected* — rooms get occupants. The
stranger who interrupts Act III of a sealed drawing-room is the shock, precisely
because the reading had stopped reserving room for one. Measured: the same
admitted newcomer costs **0.057 bits** entering a thin field and **0.106**
entering a committed cast.

Two properties fall out for free:

- **Finiteness.** A newcomer is measured against its share of the reserve, never
  against zero — which would be an infinite shock on every entrance (name-snow).
  The reserve is the protention atom that keeps KL defined (absolute continuity).
- **The opening is zero, with no guard.** Renormalising the prior over the
  posterior support makes the first line fall to KL = 0 on its own: the first
  figure splits the reserve and lands in it, violating no model that yet existed.

## Two channels

`readingAt` now returns both. They disagree where it is diagnostic — the
relationship between them tells a reveal from a typo:

| field | is | rides |
|---|---|---|
| `surprise`, `surprisalBits` | surprisal (−log p) — the **novelty** channel | improbability; the audit/trace, the UI %, the note-inclusion gate |
| `bayes`, `bayesBits` | D_KL(posterior‖prior) — the **significance** channel | the surfer's cursor axis and the enacted loop's `read` |

## Calibration: the scale moved

`bayes` clusters well below surprisal — most lines sit under 0.1. The enacted
loop's confirm band (0.25) and thresholds (1.5 / 4.0) were measured on the
surprisal scale, so on `bayes` the frame goes **numb**: strain never accumulates,
no REC ever fires. The fix is the move the meaning reader already makes — fit the
band and thresholds to *this text's* normal step (`calibrateReader`, `loop.js`):

```
band         = median surprise                  (half confirm, half strain)
step         = mean excess over the band         (typical accommodation per line)
threshold    = { proposition: 3·step, document: 8·step }
```

Adaptive, scale-free, per reader — "the higher layer holds harder" (document RECs
~3× rarer than proposition) survives any rescaling. Under it a cast turnover fires
proposition RECs at the swap points and one document REC when the reading finally
accommodates the new cast; no thrash. Falls back to the static defaults when the
distribution is too thin to fit.

## The seam

This is **proposition-level** Bayesian surprise: distributional shift over what
the reading takes to be the case — participants, the propositions among them, and
predicates. It is real and modelless today — shift over a structured field, not
edit-distance over tokens, so it no longer rides spelling, and (unlike the
figure-only version it replaced) a new bond or predication on a warm figure now
moves it.

Two seams remain, both for the geometric reader. **Sense distance**: a line that
restructures *meaning* while depositing no new proposition atom — a re-description,
an irony, a metaphor — still moves the field little; measuring that is
divergence in embedding space, the meaning reader's job (`enact/meaning.js`).
**Unparsed events**: a proposition the extractor never logged (no admitted
subject — "the father hurled apples at Gregor," where *father* is not a figure)
cannot enter a field built from the log; that is a parse-recall limit upstream,
not a surprise-measure limit. Same machinery, richer field — the surfer and the
loop ride `bayes` now and deepen with no shape change once MiniLM is live.

## Where it lives

| concern | file |
|---|---|
| the KL, both channels | `src/read/reading.js` |
| band + threshold calibration | `src/enact/loop.js` (`calibrateReader`) |
| the loop reading `bayes`, calibrated per doc | `src/enact/index.js` |
| tests (opening = 0, newcomer phenomenology, calibration, REC liveness) | `tests/bayes.test.js` |
