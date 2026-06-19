// The read holon: the three levels of reading and the consciousness that
// folds them. Pure on (doc, cursor/spans); no model in the loop.
//
//   existenceSurface     level 1 — raw text
//   structureSurface     level 2 — the extracted SEG/CON/SIG/SYN graph
//   significanceSurface  level 3 — prediction + surprise (reading mode)
//   consciousness        the integration the talker reads
//   readingAt            significance at a single cursor (UI reading mode)

export {
  existenceSurface, structureSurface, figureSurface, namedReferents,
  significanceSurface, consciousness, serializeNotes,
} from './surfaces.js';
export { readingAt } from './reading.js';
export { surfFold } from './surf.js';
export { predictNext } from './predict.js';
export {
  unitIdSequence, predictNextUnit, predictiveSequenceReading,
} from './sequence.js';
export { mutualNearestPairs, discoverEquivalences } from './equivalence.js';
export { persistentFigures, coherentFigures, motionReading, detectMotion } from './motion.js';
export { deriveNull, createNoiseFloor, extremeValueZ, MIN_SAMPLES } from './voidnull.js';
export { fieldVerdict, fieldIsVoid, ANSWERABLE_ALPHA } from './answerable.js';
export { siteRoles, markSites, siteIndices } from './site.js';
export {
  PRIMITIVES, DISJOINT_PRIMITIVES, typeOf, isFunctional, isSymmetric,
  relationPrior, areDisjoint, functionalClash, checkRelationConflict,
} from './relation-types.js';
