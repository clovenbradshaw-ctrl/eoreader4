// The core holon: the genome. Everything depends on it; it depends on nothing.
// The evo allowlist boundary from eoreader3 — "MAY NOT touch: projectGraph,
// the nine-operator vocabulary, the append-only log" — is this module.

export { MODES, DOMAINS, GRAINS, OPERATORS, isOperator,
         operatorsByMode, operatorsByDomain } from './operators.js';
export { createLog, isLog } from './log.js';
export { eoAddressOfEvent, eoNotation } from './address.js';
export { projectGraph, projectionStats, DEFAULT_PROJECTION_RULES } from './project.js';
export { VERDICTS } from './verdicts.js';
export { STANCES, TERRAINS, stanceOf, terrainOf, grainOfStance, grainOfTerrain,
         cellOf, DIAGONAL_CELLS, coherence, isDiagonal,
         SIGNATURES, signatureOf,
         OPERATOR_ALIASES, STANCE_ALIASES, aliasOperator, aliasStance, aliasCellKey } from './cube.js';
// The two floors (reshape §1/§2). The bare unit is the input membrane (the floor
// of ingestion); the proposition is the first emergent product (the floor of
// meaning). Both frozen as contracts here, in the genome everything depends on.
export { makeUnit, isUnit, sameUnit, streamDistance, unitStream, isOrdered } from './unit.js';
export { PROPOSITION_SLOTS, makeProposition, isProposition, propositionOfEdge } from './proposition.js';
// The learning layer (reshape §5): one defeasible ledger, priors + learned, same
// slot. It lives in the core because the built-in reading knowledge is inherited
// sediment, the same substance the DEF·EVA·REC loop deposits while reading.
export { createConventions } from './conventions/index.js';
