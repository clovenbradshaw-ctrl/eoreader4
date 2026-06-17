// parseText — text → doc.
//
// Pure. No model, no embedder. Deterministic given the same text.
// Emits events on a fresh log. The doc keeps the log and a forward
// token-set index per sentence (the hot retrieval path).
//
// The low: this defines the ceiling on what the rest can do. Until parse
// admits an entity, retrieval has nothing to surface and the model has
// nothing to be cited for.

import { createLog } from '../core/log.js';
import { segmentSentences } from './sentences.js';
import { isChrome } from './chrome.js';
import { createEntityAdmission } from './entities.js';
import { parseRelations } from './relations.js';
import { tok } from './tokenize.js';

export const parseText = (text, { docId } = {}) => {
  const log = createLog({ docId });
  const sentences = segmentSentences(text);
  const admission = createEntityAdmission();

  sentences.forEach((sent, sentIdx) => {
    if (isChrome(sent)) {
      log.append({ op: 'NUL', kind: 'chrome', sentIdx, text: sent });
      return;
    }

    for (const obs of admission.observe(sent)) {
      if (obs.status === 'admit') {
        log.append({ op: 'INS', id: obs.id, label: obs.label, sentIdx });
      }
    }

    for (const rel of parseRelations(sent, admission)) {
      log.append({ ...rel, sentIdx });
    }
  });

  const tokensBySentence = sentences.map(s => new Set(tok(s)));

  return {
    docId,
    text,
    sentences,
    log,
    tokensBySentence,
    admission,
  };
};
