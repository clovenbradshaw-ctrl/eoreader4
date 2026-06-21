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
         cellOf, DIAGONAL_CELLS, coherence, isDiagonal, terrainInfo,
         SIGNATURES, signatureOf,
         OPERATOR_ALIASES, STANCE_ALIASES, aliasOperator, aliasStance, aliasCellKey } from './cube.js';
// The two floors (reshape §1/§2). The bare unit is the input membrane (the floor
// of ingestion); the proposition is the first emergent product (the floor of
// meaning). Both frozen as contracts here, in the genome everything depends on.
export { makeUnit, isUnit, sameUnit, streamDistance, unitStream, isOrdered } from './unit.js';
export { PROPOSITION_SLOTS, makeProposition, isProposition, propositionOfEdge } from './proposition.js';
// The shared significance primitives — modality-agnostic, used by every faculty, so
// they live in the genome, not in any one of them. The derived null (the Born-rule
// VOID boundary, voidnull.js) and the one surprise (D_KL over a γ-decayed profile,
// surprise.js): a perceiver reads forward surprise, a surfer derives a null, an
// enactor's gate derives a null, the probe derives a null — one engine, one home.
export { deriveNull, createNoiseFloor, extremeValueZ, MIN_SAMPLES } from './voidnull.js';
export { surpriseAt, forwardDist, NOVELTY_RESERVE } from './surprise.js';
// The learning layer (reshape §5): one defeasible ledger, priors + learned, same
// slot. It lives in the core because the built-in reading knowledge is inherited
// sediment, the same substance the DEF·EVA·REC loop deposits while reading.
export { createConventions } from './conventions/index.js';
// The geometry, made first-class (add-on 2). The cognition triad (perceiver · surfer ·
// enactor, the surfer in the middle), the three faces (Act · Site · Stance) and the
// operator(Site, Stance) notation, and holonic Site addressing (which place an
// operation lands on, by path and hashId, grain preserved).
export { COGNITION, COGNITION_ORDER, facultyOfOperator, facultyOf } from './cognition.js';
export { FACES, facesOf, notate, notateHolon, cellAt, cellsOf, siteStanceAt } from './faces.js';
export { holonId, parseHolon, holonLevels, depthOf, parentOf, leafOf, joinHolon, containsHolon } from './holon.js';
