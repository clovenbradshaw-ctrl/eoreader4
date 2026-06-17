// Text ingestion. Reads the file, parses it, attaches a lazy sentence-
// embedding cache. Anything beyond plain text (PDF, audio, OCR) belongs
// in an adapter that turns its modality into text; the spine stays the same.

import { parseText }    from '../parse/index.js';
import { projectGraph } from '../core/index.js';

export const ingestText = async (file) => {
  const text  = typeof file === 'string' ? file : await file.text();
  const name  = typeof file === 'string' ? `doc-${Date.now()}` : (file.name || `doc-${Date.now()}`);
  const doc   = parseText(text, { docId: name });

  // The graph is a fold of the log. Expose it as a frame-parameterised
  // projection so the UI can re-weight around a reading cursor (γ decay)
  // without the parse holon knowing the UI exists. Memoised in core.
  doc.projectGraph = (frame = {}) => projectGraph(doc.log, frame);

  // Sentence embeddings are computed lazily and cached on the doc, keyed by
  // embedder id so swapping the organ (hash → MiniLM) recomputes rather than
  // serving stale vectors. The hot lexical path never invokes this.
  const vecCache = new Map(); // embedder.id → Promise<Float32Array[]>
  doc.sentenceEmbeddings = async (embedder) => {
    const key = embedder?.id || 'default';
    if (vecCache.has(key)) return vecCache.get(key);
    const p = Promise.all(doc.sentences.map(s => embedder.embed(s)));
    vecCache.set(key, p);
    return p;
  };

  return doc;
};
