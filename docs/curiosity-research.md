# Curiosity-guided research — following surprise across hops

> Research is the engine reaching past one page to the next — not by firing every follow-up at
> once, but by following the single thread that surprised it most, up to a fixed number of hops,
> and stopping the moment surprise runs out.

This is the multi-hop sibling of `docs/web-search.md`. That path is **single-shot**: the `auto`
gather formulates one query, fetches four results, folds them into the answer scope, and answers.
That fills a single gap. But a good answer often opens further questions — a fetched page names a
director, a place, a date the engine had never seen — and the honest next move is to go ask about
*that*. Curiosity-guided research does, **without shotgunning**: it expands exactly one thread per
hop, the most surprising one, and quits when the seam is mined out.

## Curiosity is not a new metric — it is the one surprise, pointed at the web

The engine already has exactly one surprise (`src/core/surprise.js`, `docs/spec-one-surprise.md`):
`D_KL(posterior ‖ prior)` over a γ-decayed profile in a fixed basis. Research reuses it verbatim.
**Curiosity is the surprise of a freshly fetched page against the γ-decayed profile of everything
read so far.**

- A page that only restates what we know moves belief by ≈ 0 bits → **low curiosity → a dead
  thread**, dropped.
- A page that introduces a new figure, claim, or relation moves belief a finite positive amount →
  **high curiosity → follow it**.

And the same computation hands back *what* was surprising: `bayesBy`, the per-dimension KL
contribution, names the atoms belief moved toward. **Those atoms are the next leads.** The search
is steered by the measured gap, not a keyword heuristic — active inference (`docs/web-search.md`,
"fire where expected information gain is highest"), run as a loop.

`curiosityOf(prior, arrival)` is a thin rename over `surpriseAt` so the call site speaks
"curiosity" while the arithmetic stays the one shared core. A drift in `surpriseAt` is a drift
here, by construction — there is no second metric to keep in sync.

## The loop — best-first over curiosity, not breadth-first

`runCuriousResearch(seed, { search, maxHops, gamma, curiosityFloor, patience, k })`
(`src/turn/research.js`):

1. **Front-end map.** `profileOf(text)` reduces a page to a term-frequency `Map` — the surprise
   basis. Embedder-free and offline, so the curiosity measure runs in a unit test exactly as in
   the browser. (Repetition is signal: a page *about* Coogler says "Coogler" many times, and that
   mass is what lifts that thread above the others.)
2. **The frontier** is a priority list keyed by *expected* curiosity — the KL contribution that
   surfaced each lead. The seed leads at `+∞` (always explored first); discovered leads enter at
   their realized contribution.
3. **Each hop** pops the single most-promising thread (`popBest`), fetches it (one focused query,
   `k` results — not a fan-out), and measures *realized* curiosity against the running prior:
   - **Alive** (`bits ≥ curiosityFloor`, or the seed): the pages join the ground, the arrival
     folds into the prior (`foldInto` — γ-decay incumbents, deposit the new), and its surprising
     terms (`leadsFrom`) push onto the frontier. Deeper threads can now out-rank shallow ones, so
     the walk follows where the information actually is.
   - **Dead** (`bits < curiosityFloor`, or an empty fetch): dropped. It is **not** folded in and
     spawns **no** leads — the discipline that stops the loop wandering into ever-more-tangential
     pages.
4. **Stops** at one of three boundaries: the hop budget `maxHops` is spent (the hard ceiling — the
   "max number of hops"), the frontier empties (nothing left to be curious about), or `patience`
   consecutive dead threads say the seam is mined out (early exit, well short of `maxHops`).

Every next query is kept coherent by the **anchor** (the seed's standing subject):
`nextQuery("X-Files revival", "coogler")` → `"X-Files revival coogler"`, never the bare term — the
same namesake guard `proposeWebSearch` applies (`web.js`). One thread, sharpened.

## Why this is not shotgunning

Shotgunning is firing a fan-out of follow-up queries on every term a page mentions and drowning
the answer in tangential pages. The loop is the opposite on every axis:

| | shotgun | curiosity walk |
|---|---|---|
| queries per hop | many, parallel | **one**, the most surprising |
| order | arbitrary / breadth-first | **best-first** over realized surprise |
| which leads | all terms | only the heaviest few (`leadsFrom`) |
| when it stops | a fixed count | when **surprise drops below floor** (`patience` dead threads) |

The seed is always kept as the answer's ground, floor or not — it is the question's own footing,
not a lead.

## The orchestrator and the app wiring

`runTurnWithResearch(args, { search, runTurnImpl, maxHops, … })` is the inverted-flow entry: gather
by a curiosity walk, fold every kept page into the turn scope, then answer in **one** grounded pass
over `[web + docs]`, with a `research` trace (hops + curiosity per hop + kept sources) riding back.
`runTurnImpl` and `search` are injected, so the whole flow is offline-testable
(`tests/research.test.js`).

In the app (`src/ui/app.js`), the `auto` gather now runs the walk instead of the single search.
`STATE.researchHops` (default 4) is the budget. A per-hop progress beat shows the live thread
(`🔎 hop 2/4: "X-Files revival coogler"…`), and the verbose web-result block surfaces the full hop
trace collapsed (`renderWebResult` → `.wr-hops`): which thread, how many bits of surprise, kept or
dropped as a dead seam — so "it followed its curiosity" is legible, not a black box.

## What is next

- **Richer basis.** The web front-end profiles raw prose by content term; the deeper engine has a
  proposition/figure basis (`reading.js`). Parsing each hop's page through that basis before
  measuring curiosity would let the walk be surprised by a *relation*, not just a token.
- **Cross-source promotion.** The "deep part" of `web-search.md` — an entity two-sighted across
  hops completes the local graph — is the natural payoff of a walk that gathers many pages.
- **Budget by stakes.** `maxHops` is fixed per turn; spending more hops where uncertainty × stakes
  is highest is the precision-weighting dial the rest of the engine already uses.
