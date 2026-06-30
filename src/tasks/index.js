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
// `tasks` orchestrates; it imports no other holon's internals — only core's
// public face (the cube). The planner and the generative engine arrive as two
// injected functions (decompose, generate), so the small LLM is wired by the
// caller and the holon stays pure and testable.
//
// CUBE-AWARE (tasks/grain.js). Each task is read onto the EO cube: a leaf is a
// FIGURE one generation makes (INS), a branch is a PATTERN composed from its
// children (SYN) and unravelled into them (SEG), the ambient goal is the GROUND.
// Every projected node carries its Object grain, its holonic (SYN-promotion)
// grain, and its cube cell; the projection flags the confab the cube forbids — a
// Figure-maker handed a Pattern/Ground goal — so "do not apply a Figure fix to a
// Ground problem" becomes the decomposer's stopping rule.

export { runTaskGraph } from './runner.js';
export { projectTaskGraph } from './project.js';
export {
  KIND, openEvent, decomposeEvent, stepEvent, completeEvent, failEvent,
} from './events.js';
export {
  STATUS, rollupStatus, isTerminal, assembleOutput, assembleSources, progressOf,
} from './node.js';
export {
  TASK_OPS, GROUND, FIGURE, PATTERN,
  objectGrainOf, holonGrainOf, cubeCellOf, actsOf, grainCoherence, annotateGrain,
} from './grain.js';
export { MAX_DEPTH, MAX_FANOUT, MAX_NODES } from './constants.js';

// The task creator (spec.js): a generative request → an artifact spec → the two
// runTaskGraph faces, sized for small models. Reads the kind/subject/length off the
// request, picks a shape (learned → built-in → research), and decomposes it into
// leaf-sized, budgeted generations.
export {
  LEAF_MAX_TOKENS, LEAF_MIN_TOKENS, CONTEXT_SPANS,
  ARTIFACT_KINDS, ARTIFACT_TEMPLATES,
  classifyArtifact, subjectOf, readLength,
  createTaskSpec, planArtifact, withBudgets, runArtifact,
  deriveSpecFromDefinition, createSpecLibrary, needsResearch, researchQuery,
} from './spec.js';
