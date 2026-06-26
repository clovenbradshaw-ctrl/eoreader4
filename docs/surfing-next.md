# Surfing next — close the loops, lift the reach

> The recent work built a large *thinking* apparatus around the surf — the
> significance column (ρ · eigen-lenses · von Neumann entropy · atmosphere ·
> paradigm · stance), the persistent Horizon, the helix predictor, reanalyze,
> grow-basis, the link-type learner. But the surf **as it actually runs**
> consumes almost none of it. This is the plan to fix that. It is a *wiring*
> plan first and a *mechanism* plan second: most of what we need already
> computes correctly somewhere and is dark, unplugged, audit-only, or test-only.

## The ground truth (why this doc exists)

A cold trace of `surfFold` (`src/surfer/surf.js`) and its consumers found:

- **Dark by default.** The significance column needs `activations` from a
  *meaning* embedder. Under the hash embedder (the zero-download default),
  `significanceOpts` returns `{}` (`src/turn/stages.js:58`) and the entire
  column — lenses, paradigm, stance — never computes. The thinking is off
  exactly when no heavy model is loaded.
- **Audit-only.** When it does compute, `atmosphere`, `lensEntropy`, `lenses`,
  the `paradigm` verdict, and `stance` are read **only** in `pipeline.js`
  telemetry (191–213). They never touch the note or the answer. Only
  `paradigmRec` (`stages.js:240`) and the dominant-lens conditioning feed
  downstream.
- **Unplugged.** `createHorizon` — "memory that IS the moved density operator
  across turns" — is exported and **never imported**. `surfFold` is stateless;
  each turn re-surfs from scratch.
- **Test-only.** `helixPredict`, `reanalyze`, `growBasis`, the link learner —
  all complete, all validated in tests, none on the live path. The live
  paradigm REC fires off the *commutator* (`surf.js:231`), a different signal
  than the helix's two-rung misframe detector.
- **Single-anchor reach.** `DEFAULT_REACH = { behind: 4, ahead: 16, maxStops: 5 }`
  (`surf.js:31`). The surf thinks hard about ~20 sentences around one anchor.
  On a 19k-sentence document that is 0.1%.

So "improving surfing" is mostly *closing the loops the recent work already
built*, and lifting the reach so the marquee capability can fire.

## The six moves, in priority order

### 1. Lift the reach — a document-scale significance spine — DONE (this branch)

The single-anchor ±16 window starves the surf's best idea. `significance-loop.md`
describes the **cross-layer document REC** as the headline behavior — the
proposition layer accumulating strain against the document frame "until a
document-layer REC fires and the piece is reread as being about something the
first DEF did not name." That upward accommodation **cannot fire in a 20-line
window**; the reach silently caps the engine's deepest move. It is also why the
audit's summary was thin — `retrieveStructural` got the right 12 spans, but
`surfFold` then reasoned only over the window around `spans[0]`.

**Move (landed).** `src/perceiver/spine.js` computes a **document-scale spine**:
the surf's own Bayesian-surprise scalar read across the whole text, the
highest-surprise cursors being the document's turning points. `retrieveStructural`
now spreads the body across both an even stride (coverage) AND the spine's turning
points (significance, ranked above the stride) — a strict superset of the old
even-stride behaviour. Cost is bounded by a **sampling stride** sized to a fixed
budget (`readingAt` rebuilds its prior each call, so reading every cursor would be
O(units · events)); the spine is pure on the log and memoised by identity. It
lives in the perceiver holon, so `retrieve → perceiver` (an existing edge) stays
acyclic.

Still open (the follow-on): the spine currently informs *retrieval*; making a
turn's surf a true *zoom* into the spine (the band and REC context the document's,
not the window's) is the deeper version, and the enacted-loop RECs at document
scale (not just `bayes` peaks) are part of move 5.

### 2. Default the significance column to the embedder-free ρ — DONE (this branch)

`src/surfer/structure-basis.js` builds ρ from **operator profiles**
(DEF/EVA/REC/CON/SIG/INS counts per unit) — no embedder, reads the log. That is
exactly the ρ the column wants, available on every turn.

**Move (landed).** `significanceOpts` (`stages.js`) now falls back to
`structuralActivations(doc)` when no meaning embedder is present, so the column
(`lenses`, `lensEntropy`, `stance`) computes on **every** turn. Done
conservatively: the structural column is computed and surfaced **without**
lens-conditioning the arrest, so `stops`/`peak` — the load-bearing fields the
answer uses — stay byte-identical. Lens-conditioned arrest on the structural
basis ("ride forward inside the dominant reading") is the follow-on, gated and
bench-validated before it changes the reading by default.

### 3. Close the surf's own verdicts into control

The surf measures actionable signals and logs them to telemetry:

- **stance (landed).** `updateStance` measures the confabulation guard at the
  commit — `guard:true` when the field supports only a Ground move, so a Figure
  commit *would be* the confabulation. This now feeds the **veto battery**
  (`stance-reserve`): on a pointed (`answer`) question, a Ground-grain commit is
  surfaced to the user as a thin-grounding flag, the surfer's own guard made
  visible. Pure wiring — the measurement already existed.
- **paradigm `under-read` → re-read (staged; the loop now exists).** The verdict
  means "the basis still commutes → stay at the Lens, *retrieve more*"
  (`surf.js:286-288`). PR #127 landed exactly that loop as `inquire`
  (`write/think.js`): read more of the source *on the engine's own open question*,
  fold it in, repeat, self-terminating — embedder-free, dependency-injected. So
  what remains is only the **trigger**: route the surf's `under-read` verdict (or a
  `stance-reserve` / a think-void) into `inquire` to widen before answering. The
  mechanism is built; the wiring is the work.
- **lensEntropy (staged).** The von Neumann entropy is the NPOV scalar *and* the
  predictive uncertainty — a calibrated confidence the answer could carry.

### 4. Thread the persistent Horizon — cure the amnesia, keep purity — (a)+(b) DONE

`surfFold`'s statelessness is a virtue (deterministic, replayable); Horizon is
stateful. Reconcile them the way `history` already is: the Horizon lives in the
**turn/session holon**, threaded in; the surf reads `horizon.rho` as a **prior**
(an opt) and stays pure given it; the fold stage **observes the committed
reading back into the Horizon** after the answer — and the *stance moves ρ*
(the loop `stance.js` was built to close, currently open). This is also the only
place the **temporal hysteresis** the surf admits it "cannot enforce on its own"
(`surf.js:255-259`) can live: a re-grounding requires a basis-defeat *sustained
across turns*.

**(a) Generalise the Horizon to a structural ground — DONE.** `createHorizon` cold-
started at σ built from a **centroid basis** (`horizon.js`, `corpusSigma` needs
`basis.keys`), but move 2 made the default basis the embedder-free operator
profiles — no centroids. Threading it as-is would light it up only on the meaning
path, dark by default (the exact mistake move 2 fixed). `createHorizon` now accepts
an explicit `ground` σ, and `structure-basis.js` `structuralGround()` supplies the
maximally-mixed operator-space σ. The Horizon cold-starts and accumulates with no
embedder (tested).

**(b) Thread observe-only through the turn — DONE.** `runTurn` takes an optional
`horizon`; the `settle` stage (after the answer is formed) folds the turn's
operator-profile reading into it, so the conversation grows an interpretive state
across turns. Observe-only: **no reading change**, audited in `settle.horizon`
(turns · departure · turnSurprise · ∫surprise). A turn with no Horizon threaded is
byte-identical.

**Still open.** (c) close the loop — let the measured stance *move* ρ at the commit
(`stance.js applyMeasuredStance`; needs the stance→family map surfaced). (d) read
the next turn *against* the accumulated Horizon (surf reads `horizon.rho` as a prior
— the conditioning step). (e) own the Horizon in the app's session state (`ui/app.js`)
so a real conversation accumulates one. (a)+(b) are the foundation; (c)–(e) are the
measured follow-ons.

### 5. Unify the REC sources

Three accommodation detectors don't talk: the enacted-loop frame break (live),
the paradigm commutator (live), the helix two-rung misframe (test-only), plus
`reanalyze`'s garden-path recovery (cold) and `grow-basis`'s category
composition (cold). The project's discipline is "cursor and frame axes never
disagree — they read the same scalar." Apply it here: route reanalyze and
grow-basis RECs into the **one enacted loop the surf reads**, so a bond-level
reanalysis or a basis-growth surfaces as a stop/reframe in the surf, instead of
parallel detectors.

**Reshaped by PR #127.** `reanalyze` is no longer cold: `applyReanalysis` now
appends its RECs to the **log**, and generation consumes them. So #5 shrinks — the
RECs already live in the log; the surf's frame axis just needs to *surface the
log-resident RECs* (reanalysis now, paradigm/grow-basis as they emit) as stops,
rather than running a parallel detector. Also worth noting: PR #127's `think.js`
**voids** ("a figure reached but never characterised — appeared, not acted") are a
sibling of our `stance-reserve` — both are first-class "honest not-knowing"
signals. The engine now has the inner-speech mechanism; unifying these signals is
part of the same move. (Staged.)

### 6. Give the bench eyes for the failure that matters — DONE (this branch)

`surfing-success.md` scores the *note* directly (recall × precision ×
groundedness) — good. But the battery was a 4-target seed frozen on a short
narrative, with no whole-doc / long-document target, so the reach failure (move
1) was never measurable. A coverage/whole-doc target is added so a document-scale
surf can be told apart from the local one.

## Sequencing

Moves **1, 2, 3 (stance), 6** are landed — the embedder-free column, the surfer's
guard as a veto, the document-scale spine, and the bench target that measures it.
Move **4 (a)+(b)** is landed — the Horizon generalised to a structural ground and
threaded observe-only through the turn; its follow-ons (c)–(e) are the measured
steps that condition the reading and own the Horizon in the app. Move **5** shrank
after PR #127 wired `reanalyze` into the log — it is now "surface the log-resident
RECs in the surf," not "build the detectors."

After PR #127 (embedder-free thinking) merged into main, the engine grew `inquire`
(the active-inference reading loop #3's re-read trigger plugs into) and `think.js`
voids (a sibling of `stance-reserve`). The remaining work is convergent: a single
"honest not-knowing → go read where it pays" loop, with the surf's verdicts and the
think-voids as its triggers and the Horizon as its cross-turn memory.

The honest read: the recent updates were a *building* phase — correct apparatus
accreted faster than it got wired. The next phase is **lifting the reach and
closing the loops**, in that order.

## Where it lives

| concern | file |
|---|---|
| the surfer | `src/surfer/surf.js` |
| the embedder-free basis | `src/surfer/structure-basis.js` |
| the stance face | `src/surfer/stance.js` |
| the persistent Horizon | `src/surfer/horizon.js` |
| significance opts (the wiring) | `src/turn/stages.js` (`significanceOpts`) |
| the veto battery | `src/ground/veto.js` |
| the bench | `src/bench/`, `scripts/surf-bench.mjs` |
