// The veto battery. Each veto is a pure predicate over
// (draft, bound, spans, question). Vetoes flag; they don't substitute.
//
// Adding a veto is the only honest way to tighten grounding: add it here,
// it shows up in the audit's `vetoes` field, and the user can see exactly
// why an answer was refused or flagged.

import { CONTRADICTION_REFUSE_FLOOR } from '../factcheck/correspond.js';

// How much of a grounded answer must be tied to a source before the coverage
// veto flags it — a per-task prior, not one flat 0.5. A direct answer should be
// tightly grounded (most claims cited); a SUMMARY is a synthesis whose connective
// claims legitimately have no single witnessing sentence, so it tolerates a
// looser floor; an explanation sits between. The number was a magic constant
// standing in for exactly this question-type prior. The default (and `answer`)
// keep the old 0.5, so nothing a direct question did changes.
export const GROUNDING_FLOOR = Object.freeze({
  summary: 0.34,
  explain: 0.40,
  list:    0.50,
  answer:  0.50,
});
export const groundingFloor = (task) => GROUNDING_FLOOR[task] ?? GROUNDING_FLOOR.answer;

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
  // The diagonal guard's verdicts (P1, core/cube.js `coherence`) — a specific
  // (Figure-grain) claim asserted where the reading typed Ground. Both are FLAG-ONLY:
  // under the rewrite-then-tag rule the turn already gave the talker a corrective pass
  // (turn/stages.js `revise`); a confabulation that survived it is not suppressed, it
  // ships with the span tagged so the record shows the figure-at-a-void and that a
  // rewrite was tried. Inert when no fact-check ran (no `off_diagonal` verdict present).
  {
    // The confabulation proper: a figure at a measured Void.
    id: 'off-diagonal-void',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(
      v => v.verdict === 'off_diagonal' && v.terrainGrain === 'Ground' && v.void),
    refuses: false,
    message: 'A specific claim was made where the document marks an absence (a figure at a void); a rewrite did not clear it, so it ships tagged.',
  },
  {
    // The softer category error: a figure-grain claim at a Ground terrain that is not a
    // Void (a site / atmosphere locus) — pitched finer than the passage supports.
    id: 'off-diagonal-grain',
    test: ({ edgeVerdicts }) => (edgeVerdicts || []).some(
      v => v.verdict === 'off_diagonal' && !v.void),
    refuses: false,
    message: 'A claim is pitched at a finer grain than the passage supports.',
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
    test: ({ bound, task }) => {
      const total = bound.length;
      if (total === 0) return false;
      const cited = bound.filter(b => b.citation).length;
      return cited / total < groundingFloor(task);
    },
    refuses: false, // flag-only; the cited claims still ride
    message: 'Fewer of the claims are tied to a source than this kind of question needs.',
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
