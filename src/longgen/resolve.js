// resolve — the plan→proposition step, minimal form (spec-generation.md Piece 1).
//
// The predictor draws a move-TYPE ("next is a CON"); a move-type with no content
// is exactly the open slot a small model confabulates into. So we resolve it to a
// concrete PROPOSITION before the talker ever sees it. The full resolver selects
// an edge on the referent-and-relation graph that realizes the specific move-type;
// this first cut resolves against ranked spans — pick the most salient span the
// continuation has not yet covered, and hand it over as the next sub-claim with
// its own span as the only thing the floor will let the unit cite.
//
// Monotone in coverage by construction: each call removes one span from the
// uncovered set, so the supply is finite and `ground-exhausted` is a real stop —
// length is emergent, never a token target (the arc's discipline, §5.7).

import { ceilingFor, FLOOR_TOKENS } from '../arc/index.js';

// Resolve `move` against the ground pool, skipping covered spans. Returns the
// section-shaped object generateSection/bindAndVeto consume, or null when the
// ground is spent. `move` is preserved on the result so the unit records the
// move-type it realized (the seam to the full resolver — the loop is unchanged
// when the resolution gets richer).
export const resolveProposition = ({ move, ground = [], covered = new Set() } = {}) => {
  // Highest score first; the ground pool is the ranked supply (mirrors the arc's
  // bindable spans). Ties keep input order — stable, so a run is reproducible.
  const ranked = ground
    .map((s, idx) => ({ ...s, idx: s.idx ?? idx }))
    .filter(s => !covered.has(s.idx))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const span = ranked[0];
  if (!span) return null;

  const mass = span.score || 0;
  return {
    move,
    subClaim: subClaimOf(span),
    spans: [span],
    spanSet: [span.idx],
    floor: FLOOR_TOKENS,
    ceiling: ceilingFor({ mass, spans: [span] }),
  };
};

// The sub-claim is the span's own text, trimmed to a topic hint — the same role
// the arc's cluster sub-claim plays: it stands in for the raw question so the
// unit speaks the turn's language, grounded on this one span.
const subClaimOf = (span) => {
  const t = String(span.text || '').replace(/\s+/g, ' ').trim();
  return t.length <= 120 ? t : t.slice(0, 120).replace(/\s+\S*$/, '') + '…';
};
