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
import { induceBoundaries }     from './boundaries.js';
import { isChrome }             from './chrome.js';
import { createEntityAdmission }from './entities.js';
import { parseRelations, scanDescriptors } from './relations.js';
import { argumentSpanSeg }      from './proposition.js';
import { createCorefField }     from './coref.js';
import { discoverNamings }      from './naming.js';
import { tok }                  from './tokenize.js';
import { createConventions, induceAttributionVerbs } from '../conventions/index.js';

// A pronoun-resolved descriptor owner ("his sister") is taken only when the prior
// field's top candidate outweighs the runner-up by this ratio — an unambiguous
// winner. Below it the descriptor is held with no owner, never a confident guess.
const DESC_OWNER_MARGIN = 2;

export const createParser = ({
  languageModules    = {},
  transcriptHandler  = null,
  chromeHint         = null,   // optional (sentence) → score nudge toward chrome
  // The role-conflict predicate for the standing-descriptor trigger. INJECTED by
  // the assembly layer (ingest), which is allowed to see both holons and backs it
  // with the typing bridge's areDisjoint. Parse never imports the algebra; the
  // default asserts no conflict, so a bare parse has no descriptor exclusivity.
  rolesConflict      = undefined,
  // The coref field's tuning — the CONFINEMENT WINDOW. The reach over which a
  // pronoun resolves (`maxDist`) and a standing role epithet can still bind a name
  // (`descMaxDist`, `descGamma`). INJECTED so a harness can sweep it without the
  // parser knowing why: too wide and wrong-owner relations bind, too narrow and the
  // long-range descriptor (a sibling named long after its epithet) never reaches.
  // The default is the coref field's own (a bare parse is unchanged).
  corefOpts          = undefined,
  // The coherence-strain threshold at which the boundary-induction loop RECs a
  // punctuation mark into a sentence boundary (parse/boundaries.js). The default is
  // deliberately conservative (a rare crisis); exposed so a test or a known dialect
  // can set its own sensitivity. Undefined → the loop's own default.
  boundaryThreshold  = undefined,
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
    // Before the first cut, let MEANING revise SYNTAX (parse/boundaries.js): the
    // DEF·EVA·REC coherence loop learns whether THIS document uses ':'/';' as
    // sentence boundaries — promoting one only when leaving it ignored fuses
    // propositions into run-on units that will not cohere (the KJV genealogies). The
    // learned marks are recorded as 'boundary' conventions, exactly as learned
    // abbreviations are, and flow into the splitter.
    const { extraBoundaries, recs: boundaryRecs } =
      induceBoundaries(text, {
        isAbbreviation: conventions.isAbbreviation,
        thresholds: boundaryThreshold != null ? { segmentation: boundaryThreshold } : undefined,
      });
    for (const r of boundaryRecs) conventions.learn('boundary', r.token, r.fused || 1);
    const sentences   = segmentSentences(text, { isAbbreviation: conventions.isAbbreviation, extraBoundaries });
    // Admission reads its language-specific word-classes (starters, prepositions,
    // role words, function words, auxiliaries) from the same conventions ledger the
    // splitter and relation parser use — seed ∪ what this document taught.
    const admission   = createEntityAdmission({ conventions });

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
    const corefField = createCorefField({ ...corefOpts, ...(rolesConflict ? { rolesConflict } : {}) });
    // Derived descriptor edges (owner --role--> bearer) accumulate here and are
    // logged after the candidate relations — they are the trigger's output, marked
    // `derived` so the graph and the edge-grounding veto read them as defeasible.
    const derivedEdges = [];

    // Candidate relations are collected here and emitted AFTER the pass, so each
    // can be weighed by how often its verb recurs across the whole document (the
    // recurrence gate, move 3). INS/SYN still emit inline, in reading order.
    const candidates = [];

    // The arrow of time, tracked at instantiation: the LAST INS referent activated,
    // in reading order. A clause that resolves no subject defaults to it (the
    // genealogy's "and begat …" continues the patriarch just named, not whatever
    // has the most accumulated mass). Snapshotted before each line so a subjectless
    // clause looks strictly backward, and bounded by the activation reach so a
    // long-dead referent never reaches forward to claim a verb.
    const INHERIT_REACH = 8;
    let lastIns = null;                         // { id, sentIdx } in reading order

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
      // a subject pronoun looks backward for its antecedent. The last-INS register
      // is snapshotted the same way — a subjectless clause defaults to the referent
      // activated before this line, never one this line introduces.
      const priorField = corefField.field(sentIdx);
      const priorLastIns = lastIns;

      for (const obs of admission.observe(sent, sentIdx)) {
        // INS on every sighting (admit and present) so edge weights track how
        // often a figure actually appears, not just that it exists.
        if (obs.status === 'admit' || obs.status === 'present') {
          log.append({ op: 'INS', id: obs.id, label: obs.label, sentIdx });
          corefField.note(obs.id, sentIdx);
          lastIns = { id: obs.id, sentIdx };       // the arrow of time advances
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
        // The last INS referent activated before this line, for a subjectless
        // clause to default to — within the activation reach, weight decayed by how
        // many lines back it was instantiated (the same γ kernel, as coupling).
        lastIns: () => {
          if (!priorLastIns) return null;
          const d = sentIdx - priorLastIns.sentIdx;
          if (d < 0 || d > INHERIT_REACH) return null;
          return { id: priorLastIns.id, w: Math.round(Math.pow(0.7, d) * 1000) / 1000 };
        },
      };
      const relOpts = { isSpeech, isCopula: conventions.isCopula, isModifier: conventions.isModifier,
                        referents: true };   // open the NP object slot for the page (move 2)
      for (const rel of parseRelations(sent, admission, coref, relOpts)) candidates.push({ rel, sentIdx });

      // Standing descriptors — the third coref channel (extraction half). A role
      // epithet with no adjacent name ("his sister", "Gregor's sister") is a HELD
      // role: it deposits into NO name's channel here. A named owner is sticky and
      // authoritative; a pronoun owner is taken only when it is the unambiguous
      // winner of the PRIOR field (the Frame-A margin guard — a wrong-but-weak
      // owner is worse than none). Binding a name to the role is the trigger's job.
      for (const desc of scanDescriptors(sent)) {
        let ownerId = null, named = false;
        if (desc.owner.kind === 'name' && admission.isAdmitted(desc.owner.name)) {
          ownerId = admission.idOf(desc.owner.name); named = true;
        } else if (desc.owner.kind === 'pron') {
          const [top, second] = priorField;
          if (top && (!second || top.w >= DESC_OWNER_MARGIN * second.w)) ownerId = top.id;
        }
        corefField.noteDescriptor(desc.roleKey, sentIdx, ownerId, { named });
      }

      // The unify trigger (phase b): once this sentence's admissions and
      // descriptors are folded in, bind any role whose bearer is now uniquely
      // determined by elimination. Each binding becomes a derived owner→bearer
      // edge (e.g. Gregor --sister--> Grete), typed downstream as the sibling
      // primitive — the apposition-free hop the channel exists to recover.
      for (const b of corefField.bindDescriptorsByElimination([...admission.admitted.values()], sentIdx))
        derivedEdges.push({ op: 'CON', src: b.owner, tgt: b.id, via: b.role, sentIdx, w: b.w, derived: true });
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
    const nounCount = new Map();   // NP-referent head → document-wide occurrences
    for (const { rel } of candidates)
      if (rel.op === 'CON' || rel.op === 'SIG') {
        viaCount.set(rel.via, (viaCount.get(rel.via) || 0) + 1);
        if (rel.tgtKind === 'np') nounCount.set(rel.tgt, (nounCount.get(rel.tgt) || 0) + 1);
      }
    for (const [via, n] of viaCount) if (via && n >= 2) conventions.learn('relation', via, n);

    for (const { rel, sentIdx } of candidates) {
      const { args, ...edge } = rel;
      // The recurrence coupling: a one-off relation verb is held weak (×0.5),
      // compounding with any pronoun coupling already on the edge. A bond on a
      // recurrent verb keeps full coupling. The argument-span SEG is still written
      // before the bond and cited by it, so a CON walks back to the text (§3).
      if (edge.op === 'CON' || edge.op === 'SIG') {
        const recurrent = (viaCount.get(edge.via) || 1) >= 2;
        let factor = recurrent ? 1 : 0.5;
        // An NP referent rides the SAME recurrence gate as the verb and the figure: a
        // common noun seen once across the document is held weak, never dropped — the
        // uncertainty rides as reduced coupling, the physics the pronoun field uses.
        if (edge.tgtKind === 'np' && (nounCount.get(edge.tgt) || 1) < 2) factor *= 0.5;
        const base = edge.w == null ? 1 : edge.w;          // existing (pronoun) coupling
        const w = Math.round(base * factor * 1000) / 1000;
        if (w < 1) edge.w = w; else delete edge.w;         // sub-unit coupling rides along
        // Type the predicate (move 3): the raw verb stays as `via` (the citation and
        // the talker's arrow label); the closed-vocab type rides beside it as
        // `relType`, the comparable grouping key. Additive — an untyped real verb
        // keeps no relType and still projects.
        const relType = conventions.relationType(edge.via);
        if (relType) edge.relType = relType;
      }
      if (args) {
        const seg = log.append(argumentSpanSeg(args, sentIdx));
        log.append({ ...edge, sentIdx, argspan: seg.seq });
      } else {
        log.append({ ...edge, sentIdx });
      }
    }

    // The derived descriptor edges, after the witnessed candidates. They carry
    // `derived: true` so the projection and the edge-grounding veto treat them as
    // defeasible (e.g. they never satisfy the functional-axiom's witnessed-filler
    // requirement) — the apposition-free binding, held as a weak, citable bond.
    for (const e of derivedEdges) {
      const relType = conventions.relationType(e.via);   // a role via → 'kinship'
      log.append(relType ? { ...e, relType } : e);
    }

    // The naming-scene discovery (parse/naming.js) — coreference by direct address.
    // A role epithet is a referent; the name that answers it as a vocative ("Grete!"
    // … "his sister called") is the SAME referent. We materialise the role referent,
    // bond the owner to it (Gregor → his sister), and SYN it to the name — the
    // projection's union-find then carries the kinship edge onto Grete with no
    // cascade, the apposition-free hop the elimination trigger could not bootstrap.
    // Guarded by owner-distinctness, the injected disjointness algebra, and sticky
    // abstention; a role no scene names is left as an UNNAMED referent, not guessed.
    for (const m of discoverNamings(sentences, { admission, corefField, conventions, rolesConflict })) {
      const roleRef    = `role:${m.role}@${m.ownerId}`;
      const ownerLabel = admission.labelOf(m.ownerId) || m.ownerId;
      const relType    = conventions.relationType(m.role);
      log.append({ op: 'INS', id: roleRef, label: `${ownerLabel}’s ${m.role}`, sentIdx: 0 });
      log.append({ op: 'CON', src: m.ownerId, tgt: roleRef, via: m.role, sentIdx: 0, ...(relType ? { relType } : {}) });
      log.append({ op: 'SYN', kind: 'merge', from: roleRef, to: m.name, sentIdx: 0 });
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
      corefField,    // the referent field, incl. held standing descriptors (inspection)
      state, // exposed for inspection; not for outside mutation
    };
  };

  return { parse, state };
};

// One-shot convenience. Tests and the default ingest path use this form.
export const parseText = (text, opts = {}) =>
  createParser(opts).parse(text, opts);
