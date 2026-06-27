// The web-search PROPOSER — the model proposes, it never fetches (docs/web-search.md).
//
// When a turn measures a gap the document cannot close — a void, an answer bound to nothing,
// an unsettled referent, thin coverage — that gap is a question addressed to the world. The
// proposer turns it into a query a confirmed user action (or an explicit auto mode) can run.
// Proposer-only by construction: this returns a proposal; the fetch happens elsewhere, behind
// a go-ahead. Null when the answer is well-grounded — a sound turn never reaches for the net.

import { isUnbound } from '../ground/index.js';

// The cost the user is told before any hop — the query reaches public engines via the proxy.
export const COST_NOTICE =
  'Searching the web sends this query to public search engines through the proxy. ' +
  'Nothing is sent without your go-ahead.';

// proposeWebSearch(ctx) → { query, rationale, trigger, cost } | null. Reads the SAME gaps the
// answer loop already measures, scoped to the pointed `answer` task (a whole-document task's
// connective gaps are not lookups to the world).
export const proposeWebSearch = (ctx) => {
  if (!ctx) return null;

  // A CHAT turn answers from the model's own general knowledge — and that is fine. We do not
  // replace it; we CHECK it. The proposal is a `verify` trigger: witness the answer against the
  // web and flag whether the result supports it, leaving the answer itself alone. At the
  // followup, the model's own currency check (turn/void-check.js) may UPGRADE this verify to a
  // gap-fill when it judges the answer stale or time-sensitive as of today — then live pages are
  // fetched and the turn re-answers on them. (Every turn now reaches the talker — the mechanical
  // smalltalk / math / metadata short-circuits at `route` were retired — so a chat turn here is
  // a real general-knowledge question.)
  if (ctx.route === 'chat') {
    const q = String(ctx.question || '').trim();
    return q ? { query: q, rationale: 'answered from general knowledge — checking it against the web',
      trigger: 'verify', cost: COST_NOTICE } : null;
  }

  if (ctx.route !== 'grounded') return null;
  if (ctx.task && ctx.task !== 'answer') return null;

  const flags = new Set((ctx.vetoes || []).map(v => v.id));

  // GAP triggers — the document cannot close it, so reach out to FILL it.
  const reasons = [];
  if (ctx.voidMeasure) reasons.push('the document does not cover it');
  if (isUnbound(ctx.bound || [], ctx.rawOutput || '')) reasons.push('the answer ties to nothing in the document');
  if (ctx.referential && ctx.referential.id != null && ctx.referential.concentrated === false)
    reasons.push('the passage does not settle who it is about');
  if (flags.has('low-coverage')) reasons.push('few of the claims are grounded in the document');

  // WITNESS trigger — the answer is grounded but only on the engine's OWN reading (reafference,
  // e.g. an EOT/notes source); reach out to CONFIRM it against the world. A gap, if present,
  // dominates (fill before confirm); interpretation-only proposes a witness-seek.
  let trigger = reasons.length ? 'gap' : null;
  if (flags.has('interpretation')) {
    reasons.push('the answer rests on the engine’s own reading, not on anything witnessed');
    trigger = trigger || 'witness';
  }
  if (!reasons.length) return null;

  // The query: the question, sharpened with the figure the reading centres on when we have a
  // proper name for it and the question does not already carry it. Without this, a bare
  // question like "what happens at the end?" goes to the world with no subject and matches
  // whatever shares its words — a film called "What Happens Later", not the document — and
  // those irrelevant pages then pollute the answer scope. The reading's surf `focus` (the
  // figure the fold settled on, e.g. "Gregor Samsa") is the subject when no prediction or
  // referent target named one, so it backstops the fallback chain.
  const q = String(ctx.question || '').trim();
  const figure = ctx.refTarget?.label || ctx.prediction?.primaryName || ctx.surf?.focus || '';
  const query = (figure && !q.toLowerCase().includes(String(figure).toLowerCase()))
    ? `${q} ${figure}`.trim() : q;

  return { query: query || q, rationale: reasons.join('; '), trigger, cost: COST_NOTICE };
};
