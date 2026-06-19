// The ingest holon: a source → a doc with the modality-neutral contract.
//
// A doc is { docId, modality, units, log, projectGraph, mentions, ... }. The
// log carries the nine operators; everything downstream (retrieve, fold,
// read, ground, the graph view) speaks that contract, not a modality. Adapters
// turn a modality into it:
//
//   ingestText(file)            text      → units = sentences
//   ingestImage(detections)     image     → units = regions  (vision model injected)
//   ingestMusic(score)          melody    → units = notes    (pitch-class entities)
//   ingestFrequencies(spec)     raw tones → units = notes    (overtone token sets)
//   ingestFrames(spec)          video     → units = frames   (motion tracks)
//
// New modalities (audio, tables, OCR) are new adapters emitting the same
// operators onto the same log. The spine does not change.

export { ingestText }        from './text.js';
export { ingestImage }       from './image.js';
export { ingestMusic }       from './music.js';
export { ingestFrequencies } from './frequency.js';
export { ingestFrames }      from './video.js';
