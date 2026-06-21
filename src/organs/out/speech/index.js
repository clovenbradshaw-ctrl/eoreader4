// organs/out/speech — the speech output organ (reshape §6): props → language,
// with the gate at the inner face. The talker is the Significance faculty
// rendering the core's emergent currency back into a modality.
//
// Grounding moves from a flag AFTER speech (ground/veto.js standing alone) to
// the SELECTION of speech (gate.js), and from the claim-string to the
// proposition, because only a proposition can be true (Frege/Codd). The backend
// gains `propose` beside `phrase` (model/interface.js) — the next-token
// distribution, no internal sampling, no weights touched. SEG cuts the murmur
// into candidate SVOs (segment.js). The gate measures each against a grounded
// basis by relational correspondence (props.js, lifting bind.js off lexical
// overlap), multiplies model-amplitude by support, relevance and non-redundancy,
// and collapses what beats the null at alpha into speech (gate.js) — appending
// it to the committed edge, rolling back what fails, collapsing to VOID where
// the basis is empty.
//
// The whole path is FLAGGED and golden-gated. RULES_REV off (the default) leaves
// the phrase()+veto path byte-identical; the gated path is opt-in until it beats
// the Metamorphosis battery (docs §10), then becomes default with phrase() kept
// as the no-logit fallback.

import { segment }    from './segment.js';
import { runGate, VOID_TOKEN } from './gate.js';
import { buildBasis } from './basis.js';
import { parseProps } from './props.js';

export { segment }    from './segment.js';
export { runGate, VOID_TOKEN } from './gate.js';
export { buildBasis } from './basis.js';
export { parseProps, correspondProp, propKey } from './props.js';

// The grounded-speech flag (§10). Read once from the environment so a script or
// a bench can flip it (RULES_REV=1) without touching code; defaults OFF, so the
// golden phrase()+veto path is unchanged until the gated path wins the battery.
export const RULES_REV =
  (typeof process !== 'undefined' && process.env && /^(1|true|on)$/i.test(process.env.RULES_REV || '')) || false;

// Can this turn take the gated path? It needs a backend that exposes `propose`
// (logit access), a document, and the surfer's reading. Absent any of these the
// talker falls back to the golden phrase()+veto path — non-breaking by
// construction (model/interface.js).
export const canGroundedSpeak = (model, ctx) =>
  RULES_REV && typeof model?.propose === 'function' && !!ctx?.doc && !!ctx?.surf;

// groundedSpeak — run the full talker holon for one turn: build the basis from
// the surfer's reading, drive the proposal under the gate, and return the
// collapsed speech. The answer is selected by grounding, not flagged after it.
//
//   { model, messages, doc, surf, question, alpha } → gate result
//     { answer, emitted, committed, voided, audit, basis }
//
// `alpha` is the one knob (§9) — the same tolerance the reader's VOID boundary
// uses (read/answerable.js ANSWERABLE_ALPHA), wired in here, not a new constant.
export const groundedSpeak = async ({ model, messages, doc, surf, question, alpha = 0.05, opts = {} } = {}) => {
  const basis = buildBasis(surf, doc, question);
  const parseProp = (surface) => parseProps(surface, doc, basis.cursor)[0] || null;

  const distStream = model.propose(messages, opts);
  const candidates = segment(distStream, { parseProp });
  const result = await runGate(candidates, basis, { alpha });

  return Object.freeze({ ...result, basis });
};
