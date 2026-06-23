# Cycle 001 — the novelty reserve becomes a signal

**Pressure (inside-out, the constant hunt made literal).** A draw on the predictive
path landed on `NOVELTY_RESERVE = 1.0` (`src/core/surprise.js`) — a fixed number where
the signal should be teaching. The reserve is the Born amplitude for "something new
arrives next": `p(unseen) = novelty/(Σmass + novelty)`. Held constant, that probability
decays purely with accumulated mass, so the reader grows equally certain that nothing
new will come whether it just saw a burst of newcomers or a long stretch of
confirmation. It cannot learn the one thing it is watching.

**Blind experiment.** Three newcomer schedules — **clustered** (the planted contrast),
**iid** and **monotone** (the controls) — each realized in two organs (text entities,
music pitch-classes) and driven through the real interior `forwardDist`. Channel:
does `p(unseen next)` predict the next unit's newcomer arrival (causal log-loss)? Key
held separately, pre-registered. Instrument verified first (the realized clustering
read back out of each organ's INS log; a pitch-pool bug that collapsed C4/C5 to one
class was the first fix).

**First hypothesis located a gap.** The naive reserve `R = γR + newcomers` showed the
mechanism was real (R averaged 1.7 in bursts, 0.2 in stretches; the constant sat flat
at 1.0) and improved the aggregate — but it **lost** on text-clustered and on iid. A
per-regime trace put the entire deficit on one regime: the **stretch→burst transition**
(Δ = −2.555 over 5 units). A single reactive timescale decays too far during a quiet
stretch, so the first newcomer of the next burst lands as a near-infinite surprise.

**Root-cause fix, same layer, still signal-derived.** Anchor the fast γ-recent newcomer
mass with a **floor at the reading's own long-run newcomer rate** —
`R = max(γ-recent count, (cumNewcomers/cumSteps)·decayedSteps)`. Two timescales, both
the signal's own counts, combined by the same `max` the void boundary uses. No
constant, no `+1` pseudo-count; absolute continuity holds because the opening always
deposits ≥1 newcomer.

**Confirmed.**
- Blind key: clustered wins both senses (Δ +0.019), iid ties (−0.01, the floor cut the
  naive's −0.126 over-reaction), monotone wins (+0.026).
- Omnimodal gate: both senses improve on the matched battery; the interior is provably
  modality-blind (text-like and pitch-like ids give identical numbers).
- Ablation: the floor is load-bearing (locked as a direct mass comparison).
- Fitness (real material): aggregate log-loss Δ **+0.50**, worst per-stream regression
  0.018; the long 743-sentence *Metamorphosis* — the engine's actual job — improves
  **+0.36**, exactly where the constant fails worst.

**Scope (the next pressure, P-0002).** The win is open-vocabulary novelty. Closed
vocabularies (a melody that introduces its pitches early then only repeats; a fully
introduced cast) tie or regress negligibly, because the floor expects a recurrence that
has stopped. The boundary is **stream statistics, not sense** — a closed-vocab text
ties too, an open-vocab music stream wins too. The principled next step is to estimate
p(new *type*) (Good–Turing / Pitman–Yor under γ-forgetting) so the floor relaxes when
the vocabulary is exhausted.

**Shipped** behind `opts.signalReserve` (default constant → byte-identical; 673/673
green), threaded into `readingAt` and verified at the trace level to move the reserve at
every cursor. Lock: `tests/novelty-reserve.test.js` (K-001). Experiment:
`scripts/novelty-reserve.mjs`. Ledger: L-001.
