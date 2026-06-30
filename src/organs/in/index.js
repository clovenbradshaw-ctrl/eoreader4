// organs/in — the sense organs (reshape §3). A modality → a doc on the universal
// contract. An organ INGESTS its modality; it does not understand it. Each adapter
// turns a source into the modality-neutral spine the core reads:
//
//   ingestText(file)            text      → units = sentences
//   ingestImage(detections)     image     → units = regions  (vision model injected)
//   ingestMusic(score)          melody    → units = notes    (pitch-class entities)
//   ingestFrequencies(spec)     raw tones → units = notes    (overtone token sets)
//   ingestFrames(spec)          video     → units = frames   (motion tracks)
//   ingestCodons(spec)          DNA/RNA   → units = codons   (prefix token sets)
//   ingestCode(file)            source    → units = modules / functions / classes,
//                                           related by imports / definedIn / calls / extends.
//                                           Emits EOT and lowers it, so a program reads as a
//                                           traversable EO graph (organs/in/code.js).
//
// New modalities (audio, tables, OCR) are new adapters emitting the same
// operators onto the same log. The spine does not change.
//
// Every doc carries a `metadata` slot (by canonical key: title, author, date, …) —
// the modality-neutral home for its bibliographic facts. It is the document's FRONT
// MATTER, omnimodal: text harvests it structurally from labeled lines (the case
// human-language input especially carries — parse/metadata.js), while an image fills
// it from EXIF, a score from ID3, a clip from container tags. The turn includes it
// when chatting about the document, so "who wrote this?" / "when is it from?" are
// answerable whatever the modality.
//
// Across documents it is held as a THEORY, not collapsed: a composite keeps each
// member's front matter apart (`metadataByDoc`, provenance retained) rather than
// merging a shared title into one — the same rule the referents follow, since the
// "Darcy" of one document is not the "Darcy" of another until a proof unifies them.
// Each fact is addressed under its document's holon, so the address carries the scope.

export { ingestText }        from './text.js';
export { createCompositeDoc, proposeCrossDocSyn, compositeDocIdOf } from './composite.js';
export { ingestImage }       from './image.js';
export { ingestMusic }       from './music.js';
export { ingestFrequencies } from './frequency.js';
export { ingestFrames }      from './video.js';
export { ingestCodons }      from './codon.js';
export { ingestCode }        from './code.js';
export {
  parseFasta, complement, reverseComplement, codonsOf, isStop,
  codonVector, vectorDim, codonReadings, frameReading, sixFrameReadings,
  rcCanonical, complementSignedReadings, ALL_DNA_CODONS, codonContextVectors,
} from './locus.js';
