// organs/in — the sense organs (reshape §3). A modality → a doc on the universal
// contract. An organ INGESTS its modality; it does not understand it. Each adapter
// turns a source into the modality-neutral spine the core reads:
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
