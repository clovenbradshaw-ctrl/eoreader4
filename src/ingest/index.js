// The ingest holon: structured-data surface forms → canonical EO tuples.
//
// EOT (docs/eot-surface-syntax.md) is the producer-friendly front end — punctuation shapes a
// model already knows, lowered losslessly to EO events with operator recovery, anchor minting,
// site derivation, and provenance. RDF/OWL imports lower THROUGH this same surface (§10).
export { parseEOT, eotDoc } from './eot.js';
// The inverse: render a reading (the live engine log, or canonical tuples) BACK into EOT surface
// — every ready event read out in the same line syntax a model writes, deduped, no-ops dropped,
// only vocabulary-remap RECs surfaced; what EOT cannot express is reported, never silently lost.
export { emitEot, eotText, tupleToEotLine, tuplesToEot, valueLiteral } from './eot-emit.js';
// Web pages as groundable sources: admit a fetched payload as a provenance-tagged prose doc
// that drops into the answer scope, cited + veto-checked like any source (docs/web-search.md).
export { admitWebSource, createWebStore, webRecord, webContentHash,
         toWebCitation, verifyCitation, engineDocId, recordIdForDoc, recordIdOf } from './websource.js';
// The live fetch/search client over a CORS feed proxy (search-by-feed → admit into scope).
export { createWebClient, searchAndAdmit, fetchAndAdmit, parseFeed, htmlToText,
         SEARCH_SOURCES, routeKind, DEFAULT_FEED_PROXY } from './webfetch.js';
// The raw web-content store: keep every fetched page in full, as binary, in OPFS (re-readable
// without a refetch); degrades to in-memory where OPFS is absent.
export { createRawStore, opfsAvailable, rawFileName, RAW_STORE_DIR } from './opfs-store.js';
// Also surface stripWebBoilerplate for callers that reduce a page before admission.
export { stripWebBoilerplate } from './websource.js';
