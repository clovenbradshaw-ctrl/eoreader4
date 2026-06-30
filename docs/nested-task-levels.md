# Nested task levels — the graph that fills in as a small model works

> `src/tasks/` · `tests/tasks.test.js`. One level deeper than the arc: a goal
> too big for one reach is decomposed into sub-goals, recursively, until every
> leaf is small enough for a small LLM to generate in one bite. The whole nest is
> a graph object **projected** from an append-only log, so it updates as each
> step completes.

## The one fact

The spine of this codebase is always the same: **append-only log → pure
projection → a graph object that updates by re-folding, never by mutation.**

- The document is a fold of its event log → `projectGraph`.
- The turn is a fold of its stage list → the audit log.
- The arc is a fold of its **flat** section plan → the assembled long answer.

The arc is one level of decomposition: question → sections. A small model still
has to draft a whole section in one reach, and the sections never nest. Output of
any real size wants more than one cut. The **tasks holon** adds the missing axis:

```
goal ─decompose─▶ sub-goal ─decompose─▶ … ─▶ leaf ─generate─▶ output
              (recursive, bounded)                (a small LLM, one bite)
```

A goal that is too big becomes a branch with child goals; a goal small enough to
state becomes a leaf the generative engine writes directly. The nesting is
whatever the planner asks for — three levels (document → section → point) covers
the shapes the arc handles, and the depth guard sits above that so real plans
never touch it.

## The graph object that updates

`projectTaskGraph(log)` is a **pure fold** of the `TaskEvent` log into a nested
tree. Each node carries one derived field that moves — `status` — and a leaf's
status is read straight off its own terminal event while a **branch's status is a
pure rollup of its children**:

| children | branch status |
| --- | --- |
| all `done` | `done` |
| all `blocked` | `blocked` |
| all `pending` | `pending` |
| anything in between | `active` |
| mix of `done` + `blocked`, none pending | `done` — it landed something |

No node is ever *told* to update. A leaf completes, its status flips, and every
ancestor's rollup recomputes the next time you project — which the runner does
after **every** appended event, handing the fresh graph to `onUpdate`. A UI
subscribed to `onUpdate` watches the tree fill in live; a completed leaf is
append-only and never reverts, so the completed-leaf count only ever climbs
(`progressOf` reads it straight off the tree).

The long output is not stored either: `assembleOutput` projects it by an
in-order walk that joins every leaf's text — the arc's section join, only the
leaves now come from arbitrary depth. Re-folding the same log yields the
identical tree and the identical text (replay-stable, `tests/tasks.test.js`).

## The five events

Append-only, frozen at entry, never edited (`src/tasks/events.js`):

- **open** — a node enters the graph (its goal exists, nothing done).
- **decompose** — a node is split; its child ids are declared. This is the edge
  that makes a node a *branch* rather than a leaf.
- **step** — progress on a node (marks it `active` before it settles).
- **complete** — a **leaf** produced output (with the source indices it bound to,
  folded up the tree the way the arc folds `arcSources`).
- **fail** — a node could not be produced. The error is **kept in the trace**, a
  blocked leaf beside its done siblings — the same way the audit keeps a refusing
  veto rather than hiding it. A blocked leaf does not sink a branch that landed
  something.

Ids are **paths** (`root`, `root.0`, `root.1.2`): a node's id is its own position
in the tree, so the log is order-independent to project and trivially
replay-stable.

## Small LLMs as the generative engine

`runTaskGraph` imports no model. The intelligence arrives as **two injected
faces**, so the holon stays pure and testable and the small model is wired by the
caller:

```js
runTaskGraph({
  goal,
  decompose: (view) => [subGoal, ...] | [],   // the planner: split while too big, [] when small enough
  generate:  (view) => string | { output, sources },  // run ONCE PER LEAF
  onUpdate:  (graph, event) => render(graph),  // the live graph, after every event
});
```

`view` is `{ id, goal, depth, parentId, ancestry }` — `ancestry` is the goal
chain root→parent, the context a leaf sits inside.

This is the whole point of nesting. "Write the long answer" is a reach a small
model fumbles; decomposition turns it into a forest of one-bite generations it
can each do well. Wiring it to this repo's grounded talker is a few lines — the
planner is a small-model call (or a heuristic over retrieval, the way the arc
clusters), and the leaf generator is the arc's own grounded sub-turn:

```js
import { buildGroundedMessages } from '../model/index.js';

const generate = async ({ goal, ancestry }) => {
  const spans = retrieveFor(goal);                         // this leaf's evidence only
  const messages = buildGroundedMessages({ question: goal, spans, task: 'answer' });
  const output = await model.phrase(messages, { maxTokens: ceilingFor({ spans }) });
  return { output, sources: spans.map(s => s.idx) };       // folds up the tree
};
```

Each leaf is grounded on its **own** spans — nothing else — so a section speaks
the same language as a turn, exactly as `arc/generate.js` already arranges. The
ceiling scales with that leaf's evidence; you cannot faithfully say more than the
spans support.

## The guards (runaway only)

Length and shape are emergent — the tree is as deep and wide as `decompose`
chooses. `src/tasks/constants.js` holds only the backstops, and every firing is
**recorded** in the run's `dropped` list, never silent:

- `MAX_DEPTH` (4) — at the floor a node is forced to be a leaf; the planner is not
  even consulted, so a planner that never quiesces still terminates.
- `MAX_FANOUT` (8) — demand caps supply, the way the arc's `reconcile` does: a
  wider decomposition is truncated.
- `MAX_NODES` (256) — the last line against a planner splitting just under the
  other two caps.

If the planner returns `[]` on a small goal — the equivalent of the arc's
saturation stop — none of these ever binds. A trace that shows one firing is a
signal worth reading, not a normal stop.

## What does not change

`tasks` orchestrates; it imports no other holon's internals. Parse, core,
retrieve, ground, model, the UI — untouched. The degenerate task graph (a planner
that never splits) is a single leaf: one goal, one `generate` call, byte-identical
to calling the small model once. The nesting is additive, the same way the arc is
additive over the turn.
