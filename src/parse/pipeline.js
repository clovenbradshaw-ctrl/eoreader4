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
import { argumentSpanSeg }      from './proposition.js';
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
    const log         = createLog({ docId });
    // Conventions first — the home for the language-specific stuff. The splitter
    // reads its abbreviation list from the ledger, so segmentation already honours
    // "Mr. Darcy" before a single word is classified, and the relation parser
    // reads its copula/modifier/speech lists from the same place.
    const conventions = createConventions();
    const sentences   = segmentSentences(text, { isAbbreviation: conventions.isAbbreviation });
    const admission   = createEntityAdmission();

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

    // Pass 0 — learn the document's conventions before reading it. Induced
    // attribution verbs become REC entries in the ledger and are written into
    // the log, so how *this* text marks speech biases every later sentence.
    // (The conventions ledger was created above, before segmentation.)
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

    // Candidate relations are collected here and emitted AFTER the pass, so each
    // can be weighed by how often its verb recurs across the whole document (the
    // recurrence gate, move 3). INS/SYN still emit inline, in reading order.
    const candidates = [];

    sentences.forEach((sent, sentIdx) => {
      // Chrome-ness is a weight: the mechanical score plus an optional nudge
      // (a mini-LLM's chrome probability) decides whether the line is held.
      if (isChrome(sent, chromeHint ? chromeHint(sent) : 0)) {
        // NUL is non-transformation — the line is *held*, not cleared. It is
        // simply not turned into entities or relations. (Voiding a fact would
        // be a DEF to VOID, an assertion; NUL asserts nothing.)
        log.append({ op: 'NUL', kind: 'chrome', sentIdx, text: sent });
        return;
      }
      // Snapshot the field before this line's own entities are folded in, so
      // a subject pronoun looks backward for its antecedent.
      const priorField = corefField.field(sentIdx);

      for (const obs of admission.observe(sent, sentIdx)) {
        // INS on every sighting (admit and present) so edge weights track how
        // often a figure actually appears, not just that it exists.
        if (obs.status === 'admit' || obs.status === 'present') {
          log.append({ op: 'INS', id: obs.id, label: obs.label, sentIdx });
          corefField.note(obs.id, sentIdx);
        }
        // A name-containment alias is a synthesis (SYN): "Gregor" folded into
        // the "Gregor Samsa" referent. Recorded for audit; the ids were
        // already unified at admission, so the projection needs no second merge.
        if (obs.status === 'admit' && obs.aliasOf && obs.rawId !== obs.id) {
          log.append({ op: 'SYN', kind: 'alias', from: obs.rawId, to: obs.id, label: obs.label, sentIdx });
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
      const relOpts = { isSpeech, isCopula: conventions.isCopula, isModifier: conventions.isModifier };
      for (const rel of parseRelations(sent, admission, coref, relOpts)) candidates.push({ rel, sentIdx });
    });

    // Move 3 — the relation recurrence gate (ReVerb's lexical constraint). A real
    // relation recurs; a verb seen once is suspect. We gate relations the way the
    // referent table gates entities — by recurrence — but HOLD WEAK rather than
    // drop, because many one-off verbs are real (walked, made, told): the
    // uncertainty rides along as reduced coupling, the same physics the pronoun
    // field already uses. A recurrent verb is learned into the conventions ledger
    // (a 'relation' REC), so the document's own relation vocabulary joins what it
    // taught the reader.
    const viaCount = new Map();
    for (const { rel } of candidates)
      if (rel.op === 'CON' || rel.op === 'SIG') viaCount.set(rel.via, (viaCount.get(rel.via) || 0) + 1);
    for (const [via, n] of viaCount) if (via && n >= 2) conventions.learn('relation', via, n);

    for (const { rel, sentIdx } of candidates) {
      const { args, ...edge } = rel;
      // The recurrence coupling: a one-off relation verb is held weak (×0.5),
      // compounding with any pronoun coupling already on the edge. A bond on a
      // recurrent verb keeps full coupling. The argument-span SEG is still written
      // before the bond and cited by it, so a CON walks back to the text (§3).
      if (edge.op === 'CON' || edge.op === 'SIG') {
        const recurrent = (viaCount.get(edge.via) || 1) >= 2;
        const base = edge.w == null ? 1 : edge.w;          // existing (pronoun) coupling
        const w = Math.round(base * (recurrent ? 1 : 0.5) * 1000) / 1000;
        if (w < 1) edge.w = w; else delete edge.w;         // sub-unit coupling rides along
      }
      if (args) {
        const seg = log.append(argumentSpanSeg(args, sentIdx));
        log.append({ ...edge, sentIdx, argspan: seg.seq });
      } else {
        log.append({ ...edge, sentIdx });
      }
    }

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
