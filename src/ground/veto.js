// The veto battery. Each veto is a pure predicate over
// (draft, bound, spans, question). Vetoes flag; they don't substitute.
//
// Adding a veto is the only honest way to tighten grounding: add it here,
// it shows up in the audit's `vetoes` field, and the user can see exactly
// why an answer was refused or flagged.

import { CONTRADICTION_REFUSE_FLOOR } from '../factcheck/correspond.js';
import { CONTACT_FLOOR } from './bind.js';

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
    // Every veto is an EVALUATION (EVA) of the talker's output against what the engine holds
    // — a reading with an AMPLITUDE, never a fact that holds. `gates: true` is the HARD FLOOR:
    // the turn stage substitutes a typed decline for the draft (turn/stages.js), not merely a
    // pill. Vetoes differ not in KIND but in AMPLITUDE — how far the un-groundedness reading
    // beats its null — and the action is proportional to it:
    //   • empty / declined / echo are EVAs at the HIGH-AMPLITUDE LIMIT — there is no noise
    //     model under which an empty string, a refusal, or the echoed question is an answer,
    //     so the reading overwhelms every null. They gate (the limit case enacted). This was
    //     once typed as a "structural certainty" distinct from a fallible measurement; that
    //     was a category error — `bound.every(b => !b.citation)` is not a fact ABOUT the
    //     output, it is the engine EVALUATING its output, at the limit where the reading is
    //     overwhelming. The gate is that limit, not a certainty the floor is owed.
    //   • unbound (no lexical contact with ANY span — prose from nowhere) is the same limit
    //     on the binding amplitude: score ≤ CONTACT_FLOOR for every claim → substitute.
    //   • unbound-contact (a claim made contact yet could not clear MIN_OVERLAP — a paraphrase)
    //     is a FAINT reading: flag, ride, NEVER substituted — enacting a faint amplitude as
    //     certainty is the over-refusal hazard.
    //   • a contradiction is a fallible MEASUREMENT carrying its own confidence; it degrades to
    //     indeterminate under the hash organ and may speak truly from memory against a document
    //     that is merely silent or mis-typed, so edge-contradicted is refuses:true (a serious
    //     pill) but flag-and-tell, never gated. Substitution is reserved for the limit where no
    //     paraphrase could clear the null.
    id: 'empty',
    test: ({ draft }) => String(draft || '').trim().length === 0,
    refuses: true,
    gates: true,
    message: 'Empty response.',
  },
  {
    id: 'declined',
    test: ({ draft }) =>
      /^(i (don'?t|cannot|can'?t) (answer|know|tell))/i.test(String(draft || '').trim()),
    refuses: true,
    gates: true,
    message: 'Model declined.',
  },
  {
    id: 'echo',
    test: ({ draft, question }) =>
      normalize(draft) === normalize(question) && normalize(draft).length > 0,
    refuses: true,
    gates: true,
    message: 'Model echoed the question.',
  },
  {
    // The honest abstention — "the document does not say." With the void no longer
    // auto-answered (P0.2), the talker itself declines when the excerpts don't cover the
    // question, and that decline now flows through bind/veto. It is the CORRECT void
    // response, not a grounding failure: it makes no claims precisely because there is
    // nothing to claim. Recognise it as a benign, non-refusing outcome so the grounding
    // vetoes below (unbound, low-coverage) don't mislabel an abstention as an unbound
    // answer. Anchored to the document/text/excerpts subject so a real claim that merely
    // contains "does not say" ("the clerk does not say goodbye") is untouched.
    id: 'abstained',
    test: ({ draft }) => isAbstention(draft),
    refuses: false,
    message: 'The talker declined: the excerpts do not cover the question.',
  },
  {
    // The from-nowhere LIMIT: every claim is uncited AND made no lexical contact with any
    // span (score ≤ CONTACT_FLOOR for all). Prose grounded in nothing — the bullshitter case.
    // The un-groundedness reading beats every null, so the floor substitutes (gates:true).
    id: 'unbound',
    test: ({ bound, draft }) =>
      bound.length > 0 &&
      bound.every(b => !b.citation) &&
      bound.every(b => (b.score || 0) <= CONTACT_FLOOR) &&
      !isAbstention(draft),
    refuses: true,
    gates: true,
    message: 'No claim could be tied to a source sentence, and none made lexical contact with one.',
  },
  {
    // The FAINT sibling: every claim is uncited, but at least one made lexical contact with a
    // span (CONTACT_FLOOR < score < MIN_OVERLAP) — a paraphrase the lexical binder cannot tie
    // to a single sentence. Flag, RIDE — never substituted. A faint amplitude has no business
    // being enacted as certainty (the over-refusal guard); the binder cannot tell a reword from
    // coincidence, so the meaning reader, not the floor, is what closes this residual. It is
    // refuses:true (a serious pill — the answer cites nothing) but rides, the way a denied-but-
    // -from-memory contradiction does.
    id: 'unbound-contact',
    test: ({ bound, draft }) =>
      bound.length > 0 &&
      bound.every(b => !b.citation) &&
      bound.some(b => (b.score || 0) > CONTACT_FLOOR) &&
      !isAbstention(draft),
    refuses: true,
    gates: false,
    message: 'No claim could be tied to a single source sentence, though the prose made lexical contact with one — a paraphrase that rides, flagged.',
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
    test: ({ bound, task, draft }) => {
      const total = bound.length;
      if (total === 0 || isAbstention(draft)) return false;   // an abstention claims nothing — not under-covered
      const cited = bound.filter(b => b.citation).length;
      return cited / total < groundingFloor(task);
    },
    refuses: false, // flag-only; the cited claims still ride
    message: 'Fewer of the claims are tied to a source than this kind of question needs.',
  },
];

const normalize = (s) =>
  String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

// An honest void abstention — the talker declining because the excerpts don't cover the
// question. Anchored to the document/text/excerpts (or a bare "no information") subject,
// so it recognises "the document does not say" / "the text does not mention X" but NOT a
// real claim that happens to contain the words ("the clerk does not say goodbye").
const ABSTAIN = /^\s*(?:the\s+(?:document|text|excerpts?|passage)|it|this(?:\s+(?:document|text))?)\s+(?:does\s*n['’]?t|does\s+not|do\s+not|is\s+silent|says?\s+nothing)\b[^.?!]*?\b(?:say|says|mention|mentions|state|states|specify|specifies|cover|covers|address|addresses|indicate|indicates|contain|contains|tell)?\b|^\s*no\s+(?:information|mention|indication|details?|record)\b/i;
const isAbstention = (draft) => ABSTAIN.test(String(draft || '').trim());

export const runVetoes = (ctx) => {
  const fired  = [];
  let refuse = false, gate = false;
  for (const v of VETOES) {
    if (v.test(ctx)) {
      fired.push({ id: v.id, message: v.message, refuses: !!v.refuses, gates: !!v.gates });
      if (v.refuses) refuse = true;   // serious-pill marker (display + audit)
      if (v.gates)   gate = true;     // hard floor — the turn stage substitutes the answer
    }
  }
  return { fired, refuse, gate };
};
