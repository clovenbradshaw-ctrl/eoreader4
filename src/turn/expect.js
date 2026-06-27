// The answer expectation — the question read as a PREDICTION of its own answer.
// (docs/answer-expectation.md)
//
// The predictive-processing move: comprehending a question already instantiates a typed
// answer-slot, BEFORE any content arrives. "What is her name?" predicts a single proper
// noun, short, standing in an "X is named ___" relation to the figure in focus. A good
// answer is the one that fills that slot and discharges the prediction error the question
// opened. So "knowing what a good answer looks like" is not a separate faculty — it is the
// question's own forward model with an unfilled variable.
//
// This is the missing mirror of intent.js. intent.js reads the TASK (how long, which
// guard); this reads the SHAPE the answer must take to count as an answer at all — and
// with what PRECISION, so the turn can tell a flagrant miss (a "what is her name?"
// answered with no name) from a soft one (a loose summary). The shape is what the revise
// loop error-corrects toward, and what the veto battery flags when the correction does not
// land. OPEN (precision 0) on every question that does not type its answer sharply, so the
// default turn is byte-identical — the gate arms only where the question is precise.

import { namedReferents } from '../perceiver/index.js';
import { isAbstention } from '../ground/veto.js';

const norm = (s) => String(s || '').trim();

// A NAME lookup — "what is her name?", "what's his name", "what is it called", "what is
// the name of …", "name of the …". The highest-precision slot: the answer is a proper
// noun and almost nothing else satisfies it. Deliberately narrow so it never captures a
// "what is this about" (a summary) or a "what is a chrysalis" (a definition).
const NAME = new RegExp(
  '\\bwhat(?:\'s| is| was| are| were)\\s+(?:his|her|their|its|the)\\s+names?\\b' + // what is her name
  '|\\bwhat\\s+(?:is|was|are|were)\\s+(?:he|she|it|they)\\s+called\\b' +           // what is she called
  '|\\bwhat(?:\'s| is)\\s+the\\s+name\\s+of\\b' +                                  // what is the name of
  '|\\bname\\s+of\\s+(?:the|this|that|his|her|their|its)\\b',                      // (the) name of the …
  'i',
);

// A WHO / identity lookup — "who is X?", "who was the …". A good answer NAMES the figure
// and gives its role; lower precision than NAME (a role-only answer can be acceptable), so
// it is detected but does NOT gate a restart — it rides as a flag the user can weigh.
const WHO = /\bwho\s+(?:is|was|are|were|'s)\b/i;

export const SLOT = Object.freeze({
  NAME: 'name',   // a proper noun, cardinality 1, high precision — gates
  WHO:  'who',    // an identity (name + role), medium precision — flags only
  OPEN: 'open',   // any well-formed answer; no shape gate — the default
});

// expectAnswer(question) → { slot, precision, gates }. `precision` in [0,1] is how sharply
// the question types its answer (the reliability of the prediction); `gates` is whether a
// miss is severe enough to STOP and answer again, reserved for the high-precision slot.
export const expectAnswer = (question) => {
  const q = norm(question);
  if (NAME.test(q)) return { slot: SLOT.NAME, precision: 0.9, gates: true };
  if (WHO.test(q))  return { slot: SLOT.WHO,  precision: 0.5, gates: false };
  return { slot: SLOT.OPEN, precision: 0, gates: false };
};

// A proper NAME, not a description. "Grete", "Gregor Samsa" → yes; "his sister", "the
// chief clerk", "her" → no. The discriminator is a leading capital that is not a pronoun
// or article — the same line the reader draws between a figure's name and its epithet.
const DESCRIPTOR = /^(?:his|her|their|its|the|a|an|this|that|these|those|my|your|our|he|she|it|they)\b/i;
export const isProperName = (label) => {
  const s = norm(label);
  return s.length > 0 && /^\p{Lu}/u.test(s) && !DESCRIPTOR.test(s);
};

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// answerSlotError(expectation, answerText, { doc, referent }) → null when the answer FILLS
// the predicted slot (or the slot does not gate), else a { slot, reason, expectedName? }
// describing the miss — the prediction error the revise loop corrects toward and the veto
// battery flags.
//
// For a NAME slot the answer must NAME the referent the question asks about, not merely
// mention it by description:
//   • An honest abstention ("I did not find her name") FILLS it — reporting the typed gap
//     is the correct terminal, the tip-of-the-tongue move, not a miss to retry.
//   • When the reading resolved the referent's proper name (referent.label is a name, e.g.
//     "Grete"), the answer fills the slot iff it gives that name. This is the load-bearing
//     case: the engine KNOWS the name (coref folded "his sister" → Grete) and checks the
//     answer against it — the knowledge the answer path used to throw away.
//   • When no proper name is resolvable, the answer must at least offer SOME document-
//     admitted name; an answer that names nobody dodged the question. Reuses namedReferents
//     — the same admitted-figure matcher the fold turns on — so it cannot fuzz onto an
//     un-admitted noun, and it stays embedder-free.
export const answerSlotError = (expectation, answerText, { doc = null, referent = null } = {}) => {
  if (!expectation?.gates) return null;
  const text = norm(answerText);
  if (!text) return null;                 // an empty answer is the `empty` veto's job
  if (isAbstention(text)) return null;    // the honest "I did not find it" fills the slot
  if (expectation.slot !== SLOT.NAME) return null;

  const expectedName = referent && isProperName(referent.label) ? norm(referent.label) : null;

  if (expectedName) {
    // Match on the leading token so "Grete" matches whether the answer says "Grete" or
    // "Grete Samsa"; case-insensitive, word-bounded so it cannot match inside a longer word.
    const head = expectedName.split(/\s+/)[0];
    const gives = new RegExp(`\\b${escapeRe(head)}\\b`, 'i').test(text);
    return gives ? null : {
      slot: SLOT.NAME, expectedName,
      reason: `asked for a name; the reading resolved it as “${expectedName}”, but the answer does not give it`,
    };
  }

  if (!doc) return null;                   // no name resolved and no doc to judge by → silent
  const names = namedReferents(doc, text);
  if (names.length === 0) return {
    slot: SLOT.NAME,
    reason: 'asked for a name; the answer names no one — it describes instead of naming',
  };
  return null;
};
