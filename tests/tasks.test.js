import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runTaskGraph, projectTaskGraph,
  openEvent, decomposeEvent, stepEvent, completeEvent, failEvent,
  STATUS, rollupStatus, isTerminal, assembleOutput, assembleSources, progressOf,
} from '../src/tasks/index.js';

// ── node.js — the rollup is the whole "graph updates as steps complete" claim ──
test('rollupStatus folds a branch from its children, no policy knobs', () => {
  const { PENDING, ACTIVE, DONE, BLOCKED } = STATUS;
  assert.equal(rollupStatus([]), PENDING, 'no children → pending');
  assert.equal(rollupStatus([PENDING, PENDING]), PENDING, 'all pending → pending');
  assert.equal(rollupStatus([DONE, DONE]), DONE, 'all done → done');
  assert.equal(rollupStatus([BLOCKED, BLOCKED]), BLOCKED, 'all blocked → blocked');
  assert.equal(rollupStatus([DONE, PENDING]), ACTIVE, 'some done, some pending → active');
  assert.equal(rollupStatus([ACTIVE, PENDING]), ACTIVE, 'any active → active');
  // a landed branch with one dropped leaf is still done — the block survives in
  // the trace but does not sink the branch (the arc's dropped-section rule).
  assert.equal(rollupStatus([DONE, BLOCKED]), DONE, 'done+blocked, none pending → done');
});

test('isTerminal is exactly the two settled rollups', () => {
  assert.ok(isTerminal(STATUS.DONE));
  assert.ok(isTerminal(STATUS.BLOCKED));
  assert.ok(!isTerminal(STATUS.PENDING));
  assert.ok(!isTerminal(STATUS.ACTIVE));
});

// ── project.js — the projection is a pure fold of the log ─────────────────────
test('projectTaskGraph folds a hand-written log into a nested tree with rollups', () => {
  const log = [
    openEvent({ id: 'root', goal: 'G', depth: 0 }),
    decomposeEvent({ id: 'root', childIds: ['root.0', 'root.1'] }),
    openEvent({ id: 'root.0', parentId: 'root', goal: 'A', depth: 1 }),
    openEvent({ id: 'root.1', parentId: 'root', goal: 'B', depth: 1 }),
    stepEvent({ id: 'root.0', note: 'generating' }),
    completeEvent({ id: 'root.0', output: 'alpha', sources: [2, 0] }),
  ];
  const { root, byId } = projectTaskGraph(log);
  assert.equal(root.id, 'root');
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].status, STATUS.DONE, 'completed leaf is done');
  assert.equal(root.children[1].status, STATUS.PENDING, 'untouched leaf is pending');
  assert.equal(root.status, STATUS.ACTIVE, 'one done + one pending → active branch');
  assert.equal(root.output, 'alpha', 'branch output folds the leaves');
  assert.deepEqual(root.sources, [0, 2], 'sources de-duped and ordered');
  assert.equal(byId.get('root.0').goal, 'A', 'byId indexes every node');
});

test('a failed leaf is blocked and kept in the trace, not dropped', () => {
  const log = [
    openEvent({ id: 'root', goal: 'G', depth: 0 }),
    decomposeEvent({ id: 'root', childIds: ['root.0'] }),
    openEvent({ id: 'root.0', parentId: 'root', goal: 'A', depth: 1 }),
    failEvent({ id: 'root.0', error: 'model refused' }),
  ];
  const { root } = projectTaskGraph(log);
  assert.equal(root.children[0].status, STATUS.BLOCKED);
  assert.equal(root.children[0].note, 'model refused');
  assert.equal(root.status, STATUS.BLOCKED, 'all children blocked → blocked branch');
});

test('projection is replay-stable — same log, identical tree', () => {
  const mk = () => [
    openEvent({ id: 'root', goal: 'G', depth: 0 }),
    decomposeEvent({ id: 'root', childIds: ['root.0'] }),
    openEvent({ id: 'root.0', parentId: 'root', goal: 'A', depth: 1 }),
    completeEvent({ id: 'root.0', output: 'x' }),
  ];
  assert.deepEqual(projectTaskGraph(mk()).root, projectTaskGraph(mk()).root);
});

// ── runner.js — recursive decomposition + per-leaf small-LLM generation ───────

// A stub planner: split a goal until it reaches a "point" goal, then stop. Two
// levels of nesting, deterministic, no LLM.
const splitPlanner = ({ goal }) => {
  if (goal === 'doc') return ['chapter one', 'chapter two'];
  if (goal === 'chapter one') return ['c1 point a', 'c1 point b'];
  if (goal === 'chapter two') return ['c2 point a'];
  return []; // a point → leaf
};
// A stub generative engine standing in for a small LLM: echoes its leaf goal.
const echoLeaf = ({ goal }) => `<<${goal}>>`;

test('runTaskGraph nests levels and generates each leaf once', async () => {
  const seenLeaves = [];
  const res = await runTaskGraph({
    goal: 'doc',
    decompose: splitPlanner,
    generate: (v) => { seenLeaves.push(v.goal); return echoLeaf(v); },
  });

  // three leaves: c1 point a, c1 point b, c2 point a — each generated exactly once
  assert.deepEqual(seenLeaves, ['c1 point a', 'c1 point b', 'c2 point a']);

  // depth-first left-to-right tree order in the assembled output
  assert.equal(res.output, '<<c1 point a>>\n\n<<c1 point b>>\n\n<<c2 point a>>');
  assert.equal(res.graph.root.status, STATUS.DONE, 'every leaf landed → root done');
  assert.equal(res.progress.total, 3);
  assert.equal(res.progress.done, 3);

  // the nesting is real: root → 2 chapters → points
  const root = res.graph.root;
  assert.equal(root.children.length, 2);
  assert.equal(root.children[0].children.length, 2);
  assert.equal(root.children[1].children.length, 1);
  assert.equal(root.children[0].children[0].depth, 2);
});

test('a leaf at the goal is generated directly (degenerate graph ≡ one generation)', async () => {
  let calls = 0;
  const res = await runTaskGraph({
    goal: 'just answer this',
    decompose: () => [],          // never splits
    generate: () => { calls += 1; return 'the answer'; },
  });
  assert.equal(calls, 1, 'one leaf, one generation');
  assert.equal(res.graph.root.children.length, 0, 'no children — the root IS the leaf');
  assert.equal(res.output, 'the answer');
  assert.equal(res.graph.root.status, STATUS.DONE);
});

test('onUpdate sees the graph fill in live and never un-completes a leaf', async () => {
  const doneCounts = [];
  const statuses = [];
  await runTaskGraph({
    goal: 'doc',
    decompose: splitPlanner,
    generate: echoLeaf,
    onUpdate: (graph) => {
      doneCounts.push(progressOf(graph.root).done);
      statuses.push(graph.root.status);
    },
  });
  // The KNOWN tree grows as the walk reveals sub-goals, so the completed
  // FRACTION fluctuates — but a completed leaf is append-only and never reverts,
  // so the completed COUNT is monotone. That is the real live-update invariant.
  for (let i = 1; i < doneCounts.length; i++) {
    assert.ok(doneCounts[i] >= doneCounts[i - 1], `done count monotone at ${i}`);
  }
  assert.equal(doneCounts.at(-1), 3, 'ends with all three leaves done');
  assert.equal(progressOf((await snapshotDone()).root).fraction, 1);
  assert.equal(statuses[0], STATUS.PENDING, 'starts pending (root just opened)');
  assert.equal(statuses.at(-1), STATUS.DONE, 'ends done');
  // a mid-run snapshot is ACTIVE — the graph genuinely updates step by step
  assert.ok(statuses.includes(STATUS.ACTIVE), 'passes through active');
});

// the final graph, re-run, for the fraction assertion above
const snapshotDone = async () =>
  (await runTaskGraph({ goal: 'doc', decompose: splitPlanner, generate: echoLeaf })).graph;

test('a failing leaf blocks only itself; siblings still land', async () => {
  const res = await runTaskGraph({
    goal: 'doc',
    decompose: ({ goal }) => (goal === 'doc' ? ['ok one', 'bad two', 'ok three'] : []),
    generate: ({ goal }) => {
      if (goal === 'bad two') throw new Error('cannot ground');
      return goal.toUpperCase();
    },
  });
  const kids = res.graph.root.children;
  assert.deepEqual(kids.map((k) => k.status), [STATUS.DONE, STATUS.BLOCKED, STATUS.DONE]);
  assert.equal(res.graph.root.status, STATUS.DONE, 'a landed branch survives one blocked leaf');
  assert.equal(res.output, 'OK ONE\n\nOK THREE', 'blocked leaf contributes no text');
  assert.equal(res.progress.done, 3, 'blocked still counts as terminal');
});

test('sources fold up the whole tree, de-duped and ordered', async () => {
  const res = await runTaskGraph({
    goal: 'doc',
    decompose: ({ goal }) => (goal === 'doc' ? ['x', 'y'] : []),
    generate: ({ goal }) => ({ output: goal, sources: goal === 'x' ? [3, 1] : [1, 5] }),
  });
  assert.deepEqual(res.sources, [1, 3, 5]);
  assert.deepEqual(assembleSources(res.graph.root), [1, 3, 5]);
});

// ── guards — runaway decomposition is capped and the drop is recorded ─────────
test('maxDepth forces a leaf and stops asking the planner', async () => {
  let deepest = 0;
  const res = await runTaskGraph({
    goal: 'g',
    maxDepth: 2,
    decompose: ({ depth }) => { deepest = Math.max(deepest, depth); return ['child']; }, // never quiesces
    generate: ({ goal }) => goal,
  });
  // depth 0 and 1 are asked; depth 2 is forced to a leaf (planner not called there)
  assert.equal(deepest, 1, 'planner never consulted at maxDepth');
  // the chain g → child(1) → child(2, leaf)
  assert.equal(res.graph.root.children[0].children[0].depth, 2);
  assert.equal(res.graph.root.children[0].children[0].children.length, 0);
  assert.equal(res.graph.root.status, STATUS.DONE);
});

test('maxFanout truncates a wide decomposition and records the drop', async () => {
  const res = await runTaskGraph({
    goal: 'g',
    maxFanout: 3,
    decompose: ({ depth }) => (depth === 0 ? ['a', 'b', 'c', 'd', 'e'] : []),
    generate: ({ goal }) => goal,
  });
  assert.equal(res.graph.root.children.length, 3, 'kept only the fanout');
  assert.equal(res.dropped.length, 1);
  assert.deepEqual(res.dropped[0], { id: 'root', guard: 'fanout', kept: 3, asked: 5 });
});

test('assembleOutput is a pure projection any caller can re-run', () => {
  const log = [
    openEvent({ id: 'r', goal: 'G', depth: 0 }),
    decomposeEvent({ id: 'r', childIds: ['r.0', 'r.1'] }),
    openEvent({ id: 'r.0', parentId: 'r', goal: 'A', depth: 1 }),
    openEvent({ id: 'r.1', parentId: 'r', goal: 'B', depth: 1 }),
    completeEvent({ id: 'r.0', output: '  one  ' }),
    completeEvent({ id: 'r.1', output: 'two' }),
  ];
  const { root } = projectTaskGraph(log);
  assert.equal(assembleOutput(root), 'one\n\ntwo', 'trims and joins leaves in order');
});
