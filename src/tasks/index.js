// The tasks holon — nested task levels over an append-only TaskEvent log
// (docs/nested-task-levels.md).
//
// The arc decomposes a question into a FLAT plan of sections. The tasks holon
// adds the missing axis: a goal too big for one reach is DECOMPOSED into
// sub-goals, recursively, until every leaf is small enough for a small LLM to
// generate in one bite. The whole nested structure is a graph object PROJECTED
// from the events (projectTaskGraph), so it updates as each step completes —
// re-fold the log, get the current tree with live rollup statuses.
//
// `tasks` orchestrates; it imports no other holon's internals. The planner and
// the generative engine arrive as two injected functions (decompose, generate),
// so the small LLM is wired by the caller and the holon stays pure and testable.

export { runTaskGraph } from './runner.js';
export { projectTaskGraph } from './project.js';
export {
  KIND, openEvent, decomposeEvent, stepEvent, completeEvent, failEvent,
} from './events.js';
export {
  STATUS, rollupStatus, isTerminal, assembleOutput, assembleSources, progressOf,
} from './node.js';
export { MAX_DEPTH, MAX_FANOUT, MAX_NODES } from './constants.js';
