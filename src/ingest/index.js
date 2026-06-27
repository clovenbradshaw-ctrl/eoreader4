// The ingest holon: structured-data surface forms → canonical EO tuples.
//
// EOT (docs/eot-surface-syntax.md) is the producer-friendly front end — punctuation shapes a
// model already knows, lowered losslessly to EO events with operator recovery, anchor minting,
// site derivation, and provenance. RDF/OWL imports lower THROUGH this same surface (§10).
export { parseEOT, eotDoc } from './eot.js';
// Web pages as groundable sources: admit a fetched payload as a provenance-tagged prose doc
// that drops into the answer scope, cited + veto-checked like any source (docs/web-search.md).
export { admitWebSource, createWebStore, webRecord, webContentHash,
         toWebCitation, verifyCitation, engineDocId, recordIdForDoc, recordIdOf } from './websource.js';
// The live fetch/search client over a CORS feed proxy (search-by-feed → admit into scope).
export { createWebClient, searchAndAdmit, fetchAndAdmit, parseFeed, htmlToText,
         DEFAULT_FEED_PROXY } from './webfetch.js';
