// Reader engine entry — the seam between the EO Reader UI (src/reader/app.dc.js)
// and the eoreader4 engine. The UI needs exactly three things: parseText (text →
// doc), projectGraph (event log → entity/edge graph) and the default projection
// rules. Everything the side panel "knows" about an entity is folded out of these,
// with no model in the loop.
//
// Two wirings are possible — pick one in index.html via window.__resources.eoEngine:
//
//   ./src/reader/eoreader4-bundle.js   (default) a single-file build of the engine,
//                                       identical to what the reference app shipped.
//   ./src/reader/engine-entry.js       THIS file — imports the LIVE repo source, so
//                                       edits under src/ take effect with no rebuild
//                                       (at the cost of many native-ESM fetches).
//
// Both expose the same three names; the UI cannot tell them apart.
export { parseText } from '../perceiver/parse/index.js';
export { projectGraph, DEFAULT_PROJECTION_RULES } from '../core/index.js';
