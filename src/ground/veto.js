// The veto battery. Each veto is a pure predicate over
// (draft, bound, spans, question). Vetoes flag; they don't substitute.
//
// Adding a veto is the only honest way to tighten grounding: add it here,
// it shows up in the audit's `vetoes` field, and the user can see exactly
// why an answer was refused or flagged.

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
    id: 'edge-contradicted',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(v => v.verdict === 'contradicted'),
    refuses: true,
    message: 'A claimed relation is denied by the document reading.',
  },
  {
    id: 'edge-unsupported',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(v => v.verdict === 'unsupported'),
    refuses: false, // flag-only; the claim rides, marked unwitnessed
    message: 'A claimed relation has no witness in the document reading.',
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
