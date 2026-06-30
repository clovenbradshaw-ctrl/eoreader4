// tasks/runner.js — runTaskGraph: drive a goal down to leaves a small LLM can
// generate, re-projecting the graph after every event.
//
// The runner is the only stateful piece, and the state it owns is the one durable
// thing: the append-only TaskEvent log. Everything else — the nested graph, the
// statuses, the assembled output — is PROJECTED from that log. After each event
// it re-projects and hands the fresh graph to `onUpdate`, so a UI watches the
// tree fill in and a small model only ever sees one leaf-sized goal at a time.
//
// TWO INJECTED FACES, no LLM imported here (the holon stays pure and testable):
//
//   decompose(view) → [subGoal, ...] | []   the planner. Returns sub-goals while
//     a goal is too big for one reach; returns [] (or null) when it is small
//     enough to generate directly. May be a small LLM, or a heuristic, or a fixed
//     plan. This is what makes the levels NESTED — a returned sub-goal is expanded
//     by the same recursion, so depth is whatever the planner asks for.
//
//   generate(view) → string | { output, sources }   the generative engine, run
//     ONCE PER LEAF. Because every leaf is small by construction, a small model
//     can produce it. This is the whole point: decomposition turns "write the
//     long answer" — which a small model fumbles — into a forest of one-bite
//     generations it can each do well.
//
// `view` is a read-only descriptor: { id, goal, depth, parentId, ancestry } where
// ancestry is the goal chain root→parent, the context a leaf sits inside.

import { MAX_DEPTH, MAX_FANOUT, MAX_NODES } from './constants.js';
import { openEvent, decomposeEvent, stepEvent, completeEvent, failEvent } from './events.js';
import { projectTaskGraph } from './project.js';
import { assembleOutput, assembleSources, progressOf } from './node.js';

const throwIfAborted = (signal) => {
  if (signal && signal.aborted) {
    const err = new Error('aborted');
    err.name = 'AbortError';
    throw err;
  }
};

// Accept the two return shapes a planner may use — bare strings or { goal } —
// and drop the empties, the way the arc drops a sub-claim with no spans.
const normalizeSubGoals = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .map((g) => (typeof g === 'string' ? g : g && g.goal))
    .map((g) => String(g ?? '').trim())
    .filter(Boolean);

// Accept the two return shapes a generator may use — a bare string or
// { output, sources } — so the simplest leaf is just `() => 'text'`.
const normalizeGen = (raw) => {
  if (raw == null) return { output: '', sources: [] };
  if (typeof raw === 'string') return { output: raw, sources: [] };
  return { output: String(raw.output ?? ''), sources: Array.isArray(raw.sources) ? raw.sources : [] };
};

export const runTaskGraph = async ({
  goal,
  decompose = () => [],
  generate = () => '',
  onUpdate = null,
  rootId = 'root',
  maxDepth = MAX_DEPTH,
  maxFanout = MAX_FANOUT,
  maxNodes = MAX_NODES,
  signal = null,
} = {}) => {
  const log = [];
  const dropped = [];   // runaway-guard firings, recorded — never silent
  let seq = 0;          // a monotonic step counter; the event `t`. Not wall-clock,
                        // so the same run replays to the same log (replay-stable).
  let nodeCount = 0;

  const emit = (event) => {
    log.push(event);
    if (onUpdate) {
      try { onUpdate(projectTaskGraph(log), event); } catch { /* a subscriber must never sink the run */ }
    }
    return event;
  };

  const expand = async (id, nodeGoal, depth, parentId, ancestry) => {
    throwIfAborted(signal);
    emit(openEvent({ id, parentId, goal: nodeGoal, depth, t: seq++ }));

    // Should this node split? Only while there is depth and node budget left; at
    // the floor it is forced to be a leaf so a runaway planner cannot fork past
    // the guards.
    let subGoals = [];
    if (depth < maxDepth && nodeCount < maxNodes) {
      subGoals = normalizeSubGoals(await decompose({ id, goal: nodeGoal, depth, parentId, ancestry }));
    }

    // Demand caps supply: truncate to the fanout, and again to whatever node
    // budget remains. Both truncations are recorded.
    if (subGoals.length > maxFanout) {
      dropped.push({ id, guard: 'fanout', kept: maxFanout, asked: subGoals.length });
      subGoals = subGoals.slice(0, maxFanout);
    }
    const budget = Math.max(0, maxNodes - nodeCount);
    if (subGoals.length > budget) {
      dropped.push({ id, guard: 'nodes', kept: budget, asked: subGoals.length });
      subGoals = subGoals.slice(0, budget);
    }

    if (subGoals.length) {
      const childIds = subGoals.map((_, i) => `${id}.${i}`);
      emit(decomposeEvent({ id, childIds, t: seq++ }));
      for (let i = 0; i < subGoals.length; i++) {
        nodeCount += 1;
        // Depth-first, left-to-right: a leaf completes and every ancestor's
        // rollup recomputes on the next projection before the next leaf starts —
        // so the graph fills in the order a reader would read it.
        await expand(childIds[i], subGoals[i], depth + 1, id, [...ancestry, nodeGoal]);
      }
      return;
    }

    // A leaf: the small-LLM reach. step → (complete | fail).
    emit(stepEvent({ id, note: 'generating', t: seq++ }));
    try {
      const { output, sources } = normalizeGen(
        await generate({ id, goal: nodeGoal, depth, parentId, ancestry }),
      );
      emit(completeEvent({ id, output, sources, t: seq++ }));
    } catch (err) {
      if (err && err.name === 'AbortError') throw err;
      emit(failEvent({ id, error: String(err?.message || err), t: seq++ }));
    }
  };

  nodeCount = 1; // the root counts against the node budget
  await expand(rootId, String(goal ?? ''), 0, null, []);

  const graph = projectTaskGraph(log);
  return {
    graph,
    log,
    dropped,
    output: assembleOutput(graph.root),
    sources: assembleSources(graph.root),
    progress: progressOf(graph.root),
  };
};
