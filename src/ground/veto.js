// The veto battery. Each veto is a pure predicate over
// (draft, bound, spans, question). Vetoes flag; they don't substitute.
//
// Adding a veto is the only honest way to tighten grounding: add it here,
// it shows up in the audit's `vetoes` field, and the user can see exactly
// why an answer was refused or flagged.

import { CONTRADICTION_REFUSE_FLOOR } from '../factcheck/correspond.js';

export const VETOES = [
  {
    id: 'empty',
    test: ({ draft }) => String(draft || '').trim().length === 0,
    refuses: true,
    message: 'Empty response.',
  },
  {
    id: 'declined',
    test: ({ draft }) =>
      /^(i (don'?t|cannot|can'?t) (answer|know|tell))/i.test(String(draft || '').trim()),
    refuses: true,
    message: 'Model declined.',
  },
  {
    id: 'echo',
    test: ({ draft, question }) =>
      normalize(draft) === normalize(question) && normalize(draft).length > 0,
    refuses: true,
    message: 'Model echoed the question.',
  },
  {
    id: 'unbound',
    test: ({ bound }) => bound.length > 0 && bound.every(b => !b.citation),
    refuses: true,
    message: 'No claim could be tied to a source sentence.',
  },
  // The edge-grounding checks — the LINK-shaped sibling of `unbound`. `unbound`
  // catches a claim with no node-level witness; these catch a claimed RELATION
  // with no edge-level witness, the shape the invented-location lie wore. They
  // read the four-way verdict the factcheck holon computed (`ctx.edgeVerdicts`)
  // and stay inert when no fact-check ran. The split is the journalism: a claim
  // the document DENIES is refused; a claim the document is merely silent on is
  // flagged. Under the hash organ every relational verdict is indeterminate, so
  // neither fires — the honest inert state until the meaning reader is wired.
  {
    // The likelihood gate, mirrored from the factcheck holon: a contradiction
    // hard-refuses only when its joint typing confidence clears the floor. A
    // verdict with no confidence is treated as certain (the geometric VOID path,
    // already embedder-gated), so a bare {verdict:'contradicted'} still refuses.
    id: 'edge-contradicted',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(
      v => v.verdict === 'contradicted' && (v.confidence ?? 1) >= CONTRADICTION_REFUSE_FLOOR),
    refuses: true,
    message: 'A claimed relation is denied by the document reading.',
  },
  {
    // A contradiction that exists but rests on a weakly-typed relation: flagged,
    // not refused — the human is told, the answer rides.
    id: 'edge-contradicted-weak',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(
      v => v.verdict === 'contradicted' && (v.confidence ?? 1) < CONTRADICTION_REFUSE_FLOOR),
    refuses: false,
    message: 'A claimed relation conflicts with the document reading, but the relation typing is too uncertain to refuse on.',
  },
  {
    id: 'edge-unsupported',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(v => v.verdict === 'unsupported'),
    refuses: false, // flag-only; the claim rides, marked unwitnessed
    message: 'A claimed relation has no witness in the document reading.',
  },
  {
    // The reader measured its own referential confidence (read/referent.js): the
    // concentration of the coref posterior at the answer cursor. A diffuse field —
    // no figure clearly dominant — means the passage the answer draws on does not
    // settle who it is about. Flag-only: the answer rides, the uncertainty is no
    // longer discarded at the last step. Inert when no field was measured.
    id: 'referent-ambiguous',
    test: ({ referential }) => !!referential && referential.id != null && !referential.concentrated,
    refuses: false,
    message: 'The passage this answer draws on does not settle which figure it is about.',
  },
  {
    id: 'low-coverage',
    test: ({ bound }) => {
      const total = bound.length;
      if (total === 0) return false;
      const cited = bound.filter(b => b.citation).length;
      return cited / total < 0.5;
    },
    refuses: false, // flag-only; the cited claims still ride
    message: 'Fewer than half the claims are tied to a source.',
  },
];

const normalize = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export const runVetoes = (ctx) => {
  const fired  = [];
  let refuse = false;
  for (const v of VETOES) {
    if (v.test(ctx)) {
      fired.push({ id: v.id, message: v.message, refuses: v.refuses });
      if (v.refuses) refuse = true;
    }
  }
  return { fired, refuse };
};
