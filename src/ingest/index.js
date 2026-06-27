// The ingest holon: structured-data surface forms → canonical EO tuples.
//
// EOT (docs/eot-surface-syntax.md) is the producer-friendly front end — punctuation shapes a
// model already knows, lowered losslessly to EO events with operator recovery, anchor minting,
// site derivation, and provenance. RDF/OWL imports lower THROUGH this same surface (§10).
export { parseEOT, eotDoc } from './eot.js';
