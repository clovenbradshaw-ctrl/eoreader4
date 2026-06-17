// Text ingestion. Reads the file, parses it, attaches a lazy sentence-
// embedding cache. Anything beyond plain text (PDF, audio, OCR) belongs
// in an adapter that turns its modality into text; the spine stays the same.

import { parseText } from '../parse/index.js';

export const ingestText = async (file) => {
  const text  = typeof file === 'string' ? file : await file.text();
  const name  = typeof file === 'string' ? `doc-${Date.now()}` : (file.name || `doc-${Date.now()}`);
  const doc   = parseText(text, { docId: name });

  // Sentence embeddings are computed lazily and cached on the doc itself.
  // First caller pays the warmup; subsequent callers (retrieve, impression,
  // form) re-use the cache. The hot lexical path never invokes this.
  let vecPromise = null;
  doc.sentenceEmbeddings = async (embedder) => {
    if (vecPromise) return vecPromise;
    vecPromise = Promise.all(doc.sentences.map(s => embedder.embed(s)));
    return vecPromise;
  };

  return doc;
};
