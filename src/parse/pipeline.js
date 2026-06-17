// parseText / createParser — text → doc.
//
// The factory form is the engine reality: the parser instance owns its
// language module state and transcript-active flag. The state stays at
// the holon boundary, never at module scope. (engine.js:4228 mutates
// LANGUAGE_MODULES and TRANSCRIPT_ACTIVE from a module-scoped `let` —
// that's what we don't do here.)
//
// `parseText(text, opts)` is the one-shot convenience: it spins up a
// fresh parser and parses once. Use `createParser(opts)` when the same
// configuration needs to be applied to multiple texts in sequence, or
// when state ownership matters for testing.

import { createLog }            from '../core/log.js';
import { segmentSentences }     from './sentences.js';
import { isChrome }             from './chrome.js';
import { createEntityAdmission }from './entities.js';
import { parseRelations }       from './relations.js';
import { tok }                  from './tokenize.js';

export const createParser = ({
  languageModules    = {},
  transcriptHandler  = null,
} = {}) => {
  // State owned by this parser instance. Mutated by parse(); the mutation
  // is visible only inside the holon. Tests construct one parser per case.
  const state = {
    languageModules:  { ...languageModules },
    transcriptActive: false,
  };

  const parse = (text, { docId } = {}) => {
    const log       = createLog({ docId });
    const sentences = segmentSentences(text);
    const admission = createEntityAdmission();

    // Transcript detection — the handler is injected, not imported.
    if (transcriptHandler && transcriptHandler.detect && transcriptHandler.detect(text)) {
      state.transcriptActive = true;
      state.languageModules['transcript-v1'] = { enabled: true };
    } else {
      state.transcriptActive = false;
      if (state.languageModules['transcript-v1']) {
        state.languageModules['transcript-v1'] = {
          ...state.languageModules['transcript-v1'], enabled: false,
        };
      }
    }

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
      docId, text, sentences, log,
      tokensBySentence,
      admission,
      state, // exposed for inspection; not for outside mutation
    };
  };

  return { parse, state };
};

// One-shot convenience. Tests and the default ingest path use this form.
export const parseText = (text, opts = {}) =>
  createParser(opts).parse(text, opts);
