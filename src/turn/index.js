// The turn holon: the named-stage pipeline. Composes every other holon.

export { runTurn } from './pipeline.js';
export { stages }  from './stages.js';
export { buildFeed } from './feed.js';
export { loadShapeLibrary, buildShapeLibrary, parseExemplars } from './shape.js';
export { proposeWebSearch, searchAnnouncement, COST_NOTICE } from './propose.js';
export { runTurnWithWeb, runWebFollowup, verifyAgainstWeb, formulateSearchQuery } from './web.js';
export { runCuriousResearch, runTurnWithResearch, researchAnnouncement,
         curiosityOf, profileOf, foldInto, leadsFrom, plausibleLead, nextQuery, researchTerms } from './research.js';
