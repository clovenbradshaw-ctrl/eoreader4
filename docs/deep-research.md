# Deep research — the curiosity walk, planned wide and dug deep

> Deep research is the engine asked to dig HARD on one question: open it from several angles, follow
> the surprise of each as far as it stays on topic, and write up everything found with its sources.
> It is the same one surprise as the single walk — orchestrated for depth, not for a fast answer.

This is the deliberate, user-invoked sibling of `docs/curiosity-research.md`. That path is the
**auto** gather: one curiosity walk, one thread expanded best-first, tuned to **stop early** because
it is one tributary of a fast answer. Deep research is what happens when the user types
**`/research <query>`** (or `/deep <query>`) — a concise question, answered not in one pass but by a
**wide, deep sweep** that ends in a **report with full provenance**.

It is `src/turn/deep-research.js`, and it reuses the single walk's machinery verbatim
(`curiosityOf`, `foldInto`, `leadsFrom`, `nextQuery`, `bornSalience`). Nothing here is a new notion
of "interesting" — curiosity is still `D_KL(page ‖ what-we-know)`, leashed by saliency to the
question. Deep research is an **orchestration** over that one surprise.

## It asks for a concise query

The mode "asks for a concise query" literally: `/research how do mRNA vaccines work` gives the
engine one short question. A bare `/research` with no query is a no-op that prompts for one. The
concise query is the seed — and, crucially, the **anchor** the saliency leash measures every later
hop against, so the sweep can never drift off the thing that was asked.

## Multiple prompt generation — one query becomes several angles

A concise query is one mouth on a topic; a thorough sweep needs several. `planQueries(seed, { plan,
max })` turns the one question into a small set of **facets** — distinct angles on the same subject
(its background, how it works, the evidence, the criticism, the current state):

- **`modelPlanner(model, { history, question })`** is the planner used in the app: a tiny, low-token
  talker call (the same discipline as `formulateSearchQuery`) that proposes `max − 1` distinct
  queries, one per line. The model knows the *shape* of a topic, so it is the right organ to
  decompose it. It is **discourse-aware**: when the app threads the conversation `history` and the
  raw `question`, the planner reads the `discourseFrame` (converse/dialogue-state.js) — the **subject
  in focus** (the warm referent) and the **open question** — and hands that frame to the model, so
  every generated angle resolves back-references and keeps the *conversation's* subject rather than
  re-guessing a topic from the seed string. Same firewall as the single query: only the grounded
  referent label and the user's open-intent text ride, never the talker's claims.
- With **no model**, the seed stands alone and the walk still fans out by surprise — just from one
  mouth instead of several.

The concise query is **always facet 0** (the broad overview and the leash anchor); the planner's
angles are appended, deduped against the seed and each other, capped at `max` (default 4). A planner
that throws or returns junk is caught — the seed always survives. This is the "multiple prompt
generation" the mode needs: **deliberate breadth at the start**, on top of the surprise-driven
breadth the walk discovers as it goes.

## Follows curiosity as deeply as possible — one shared state, a longer leash

`runDeepResearch(seed, { search, plan, maxHops, beam, … })` seeds **one** best-first frontier with
**all** the facets and walks it deep. Three things make it *deep* where the single walk is *fast*:

1. **One shared prior, one shared leash.** Every facet folds into the **same** γ-decayed prior and
   is leashed to the **same** topic frame (anchored on the original query). So a figure learned
   while exploring facet A raises the surprise bar for facet B — the branches don't re-learn the
   same thing — and a page fetched once is never fetched again across the whole sweep.
2. **A bigger budget, a looser leash.** `maxHops` defaults to **14** (vs the auto walk's 6), the
   lead **beam** to 5 (vs 4), the saliency floor a touch looser (`0.30` vs `0.34`), and stray
   patience to 3 (vs 2) — because one bad lead shouldn't end a sweep that has many branches in
   flight. The leash is still the real governor; the budget is only the runaway backstop.
3. **Facets are trusted; discovered leads are leashed.** A depth-0 facet is a *deliberate* angle, so
   it always grounds — but a facet that has drifted off the question spawns **no** deeper leads
   (we don't dig down a thread already off-topic). A discovered lead (depth ≥ 1) is fully leashed:
   stray too far and it is dropped, and a run of strays stops the walk.

The frontier priority is unchanged from the single walk — `surprise × (0.1 + saliency)` — so the
sweep follows surprise **within the orbit of the question**, across every branch at once. Facets
lead in plan order; the concise query (facet 0) is explored first and **calibrates the leash
baseline** and freezes the topic frame, exactly as the seed does in the single walk.

## Produces a thorough summary with all the provenance

The deliverable is not an answer but a **report**. `runTurnWithDeepResearch` folds **every** kept
page into the turn scope and synthesizes in **one grounded pass** over `[web + docs]` — so the
summary stands on the seam the engine actually mined. `deepResearchReport(walk, { turn })` then
wraps that prose with the full provenance:

- **`overview`** — the synthesized, cited answer (the report body).
- **`facets`** — the angles it opened from (the multiple prompts it generated).
- **`sources`** — every page read, numbered, each with title · url · fetched-at **and** the thread
  that found it (which facet, which query, what depth) **and** the surprise + saliency that admitted
  it. Nothing the summary used is opaque.
- **`byFacet`** — those sources grouped by the angle that surfaced them (the report's sections).
- **`archive`** — the readings the walk **parsed but strayed past**: an off-topic page is read
  (fetch, parse, surprise/saliency all paid) but, being not salient to the question, is **not** stored
  as a source — it is **absent from `sources`**. Rather than throw the reading away the instant it
  strays (a strayed page often sits on the very *edge* of the question, and a later hop can circle
  back), it is **filed in the archive**, each entry leased to go to the **shredder** after a duration
  set by **how much content it processed** (`archive.js` `shredTtl` — bigger reading, longer lease;
  floored and capped). So "parse every source, but only *store* the salient ones" is literal: the
  non-salient reading is kept just long enough that a circle-back re-uses it instead of re-reading,
  then the shredder destroys it on the schedule its content bought.
- **`tree`** — the complete hop trace: which thread, at what depth, how surprising, kept or why
  dropped (`strayed` / `empty` / `exhausted`), and how many strayed readings it `archived`.
- **`stats`** — the shape of the sweep: facets, hops, kept, strayed, sources, deepest hop, total
  bits of surprise.

In the app (`src/ui/app.js`), `/research` runs the deep gather, a progress beat shows the live
thread (`🔬 planning…`, then `🔎 angle: "…"`, then indented `↳ hop n: "…"`), and the verbose web
block (`renderWebResult`) surfaces the **research plan** (the facets, expanded) and the **deep
research walk** (the hop tree, with depth indents and per-hop curiosity/saliency) above the full
source list — so "it researched from several angles and dug in" is legible, not a black box.

## Why this is not shotgunning

Shotgunning fires a fan-out of follow-ups on every term and drowns the answer in tangential pages.
Deep research is wide **by plan** and deep **by surprise**, both leashed:

| | shotgun | deep research |
|---|---|---|
| where breadth comes from | every term, all at once | a small **plan** of distinct angles |
| where depth comes from | none — one level | best-first over **realized surprise**, many hops |
| cross-branch state | none — each query blind | **one shared prior**; no branch re-learns |
| when it stops | a fixed count | when every branch **strays** off the question (the leash) |
| the output | a pile of pages | a **synthesized report** with per-source provenance |

## The seams to the rest of the engine

- The surprise is `core/surprise.js` via `research.js` — one metric, no second copy to keep in sync.
- The saliency leash is the Born rule (`surfer/salience.js`), the same projection the surfer uses to
  decide what a conversation is about.
- The synthesis is the ordinary grounded turn (`turn/pipeline.js`) over the gathered scope — deep
  research changes *what is gathered*, not *how the answer is grounded*.

`tests/deep-research.test.js` exercises the whole flow offline with a fake `search` and a fake
`plan`: planning, the multi-branch shared-state walk, the leash, the provenance rows, the report,
and the orchestrator — no model, no network.

## What is next

- **Per-facet synthesis.** The report synthesizes one overview over everything; a section *per
  facet* (grounded only in that angle's sources) would make a long report navigable.
- **Budget by stakes.** `maxHops` and `maxFacets` are fixed per `/research`; spending more where
  uncertainty × stakes is highest is the precision-weighting dial the engine already uses elsewhere.
- **Cross-source promotion.** A figure two-sighted across facets completes the local graph — the
  natural payoff of a sweep that gathers many pages from many angles.
