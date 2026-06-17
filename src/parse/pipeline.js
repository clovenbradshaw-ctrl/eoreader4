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
import { createEntityAdmission, induceProperNouns } from './entities.js';
import { parseRelations }       from './relations.js';
import { contentHash }          from './hash.js';
import { createCorefField }     from './coref.js';
import { tok }                  from './tokenize.js';
import { createConventions, induceAttributionVerbs } from '../conventions/index.js';

export const createParser = ({
  languageModules    = {},
  transcriptHandler  = null,
  chromeHint         = null,   // optional (sentence) → score nudge toward chrome
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
    // Pass: learn the document's names distributionally (a word capitalised
    // mid-sentence is a name), then admit only against that learned set — no
    // blocklist of non-names. The high (a learned convention) sets the
    // probabilities for the low (what the per-sentence loop may admit).
    const properWords = induceProperNouns(sentences);
    const admission = createEntityAdmission({ properWords });

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

    // ── The log is the entire source, cited verbatim ──────────────────────
    // Every unit is held in the log as itself (NUL — non-transformation),
    // content-addressed by hash (git for the hashes). The document now lives
    // in the log: lose it, replay the log, get it back. Every transformation
    // below is logged on top and *cites* the source hash it was read from.
    const srcHash = [];
    sentences.forEach((sent, sentIdx) => {
      const hash = contentHash(sent);
      srcHash[sentIdx] = hash;
      log.append({ op: 'NUL', kind: 'source', sentIdx, text: sent, hash });
    });

    // ── Then every transformation on the source is a logged event ─────────
    // Pass 0 — learn the document's conventions (induced attribution verbs)
    // as REC entries, so how *this* text marks speech biases the reading.
    const conventions = createConventions();
    for (const { token, count } of induceAttributionVerbs(sentences)) {
      conventions.learnAttribution(token, count);
    }
    for (const r of conventions.rules) log.append(r);
    const isSpeech = (verb) => conventions.isAttributionVerb(verb);

    // Coreference is a field, not a decision. Each mention feeds a decaying
    // referent trace; a subject pronoun reads the field *as it stood before
    // this sentence* and the strongest candidate's weight becomes the bond's
    // coupling. Nothing is committed — the weight carries the uncertainty.
    const corefField = createCorefField();

    sentences.forEach((sent, sentIdx) => {
      // A held/chrome unit gets no transformation — it stays at its source
      // citation (the NUL above). Degenerate structure and, later, semantic
      // sites are held; everything else is read.
      if (isChrome(sent, chromeHint ? chromeHint(sent) : 0)) return;

      // Snapshot the field before this line's own entities are folded in, so
      // a subject pronoun looks backward for its antecedent.
      const priorField = corefField.field(sentIdx);

      const cites = srcHash[sentIdx];
      for (const obs of admission.observe(sent, sentIdx)) {
        // INS on every sighting. Admission *mints* a referent — the first INS
        // brings the id into existence (kind:'mint'); later sightings are
        // re-instantiations (kind:'sight'). Edge weight tracks the sightings.
        if (obs.status === 'admit' || obs.status === 'present') {
          log.append({ op: 'INS', kind: obs.status === 'admit' ? 'mint' : 'sight',
                       id: obs.id, label: obs.label, sentIdx, cites });
          corefField.note(obs.id, sentIdx);
        }
        // A name-containment alias is a synthesis (SYN): the duplicate referent
        // is annihilated into the established one — minting's antimatter. (A
        // SEG retract / DEF-to-VOID is the general annihilation primitive.)
        if (obs.status === 'admit' && obs.aliasOf && obs.rawId !== obs.id) {
          log.append({ op: 'SYN', kind: 'alias', from: obs.rawId, to: obs.id, label: obs.label, sentIdx, cites });
        }
      }

      // The relations parser reads coref two ways: `field()` for a leading
      // subject pronoun, and `resolve()` for a possessive owner pronoun in a
      // kinship apposition ("his sister Grete"). Both look backward through the
      // same pre-line field and take the strongest prior candidate. `resolve`
      // had no implementation, so that call site got nothing and pronoun-owned
      // kinship bonds dropped silently — only named owners survived. Wired now.
      const coref = {
        field:   () => priorField,
        resolve: () => priorField[0]?.id ?? null,
      };
      for (const rel of parseRelations(sent, admission, coref, { isSpeech })) {
        log.append({ ...rel, sentIdx, cites });
      }
    });

    const tokensBySentence = sentences.map(s => new Set(tok(s)));

    return {
      docId, text, sentences, log,
      tokensBySentence,
      admission,
      conventions,                  // the learned-rules ledger (REC)
      mentions: admission.mentions, // id → unit indices
      // Modality-neutral contract: `units` is the reading sequence the spine
      // walks (here, sentences). An image adapter fills the same field with
      // regions; the operators, log, graph and reading levels are unchanged.
      units: sentences,
      modality: 'text',
      state, // exposed for inspection; not for outside mutation
    };
  };

  return { parse, state };
};

// One-shot convenience. Tests and the default ingest path use this form.
export const parseText = (text, opts = {}) =>
  createParser(opts).parse(text, opts);
