// bindCitations — re-cite the model's draft mechanically against the
// spans it was given. The model never writes [sN] tags; we do.
//
// Memoized per claim sentence: the converge loop re-binds 3–5 near-
// identical drafts; without this each re-bind would be O(claims × spans).

import { tok } from '../parse/tokenize.js';

const MIN_OVERLAP = 0.25;

export const bindCitations = (draft, spans) => {
  const claims = splitClaims(draft);
  const cache  = new Map();
  const bound  = [];
  for (const claim of claims) {
    const key = claim.toLowerCase();
    let best = cache.get(key);
    if (best === undefined) {
      best = bestMatch(claim, spans);
      cache.set(key, best);
    }
    bound.push({
      claim,
      citation: best ? `s${best.idx}` : null,
      score:    best ? best.score : 0,
    });
  }
  return bound;
};

const splitClaims = (draft) =>
  String(draft || '')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

const bestMatch = (claim, spans) => {
  const claimTokens = new Set(tok(claim));
  if (claimTokens.size === 0) return null;
  let best = null;
  for (const s of spans) {
    const sTokens = new Set(tok(s.text));
    let overlap = 0;
    for (const t of claimTokens) if (sTokens.has(t)) overlap++;
    const score = overlap / claimTokens.size;
    if (score > 0 && (!best || score > best.score)) best = { ...s, score };
  }
  return (best && best.score >= MIN_OVERLAP) ? best : null;
};

export const renderBound = (bound) =>
  bound
    .map(b => (b.citation ? `${b.claim} [${b.citation}]` : b.claim))
    .join(' ');
