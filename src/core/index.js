// The core holon: the genome. Everything depends on it; it depends on nothing.
// The evo allowlist boundary from eoreader3 — "MAY NOT touch: projectGraph,
// the nine-operator vocabulary, the append-only log" — is this module.

export { MODES, DOMAINS, GRAINS, OPERATORS, isOperator,
         operatorsByMode, operatorsByDomain } from './operators.js';
export { createLog, isLog } from './log.js';
export { eoAddressOfEvent, eoNotation } from './address.js';
export { projectGraph, projectionStats, DEFAULT_PROJECTION_RULES } from './project.js';
export { VERDICTS } from './verdicts.js';
