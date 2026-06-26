// The active-inference re-read, in-turn (surfing-next.md §3) — the not-knowing the surfer
// MEASURED, run forward as the next retrieval.
//
// When the surf could not SETTLE on a figure at the peak — the stance-reserve guard, the
// field supported only a Ground move, so committing to a figure would be the confabulation
// — answering from the thin reading is the wrong move. The honest one is the same the
// engine already makes in `inquire` (write/think.js), brought in-turn: READ MORE of the
// document on the figure the reading kept circling, then fold again from the wider evidence.
// Attention is steered by the standing not-knowing, not by a fixed budget.
//
// Bounded to ONE extra pass (like revise's one rewrite) and dependency-injected — the
// retriever is passed in, so this stays a pure decision over (surf, spans) testable without
// the retrieve holon. Inert unless the surf actually under-settled and a fresh span is found.

// unsettled — the trigger: a pointed turn whose surf reserved at the peak (a Ground-grain
// commit) and that has a figure it circled. A summary legitimately rides the Ground grain,
// so this fires only on the `answer` task (or an untyped turn).
export const unsettled = (surf, task) =>
  (task === 'answer' || task == null) && surf?.stance?.guard === true && surf?.focus != null;

// rereadOnUnsettled({ doc, spans, surf, task, query, retrieve, k }) → { spans, added, asked }
//   retrieve(query, k) → [{ idx, text, ... }]   more of the SOURCE on the open figure.
// Returns the widened span set (originals + any fresh hits, deduped by idx), how many were
// added, and the figure asked about. A no-op (spans unchanged, added 0) when the surf
// settled, no figure was circled, no retriever was injected, or nothing fresh came back.
export const rereadOnUnsettled = async ({ doc, spans = [], surf, task, query, retrieve, k = 4 }) => {
  if (!unsettled(surf, task) || typeof retrieve !== 'function') return { spans, added: 0, asked: null };
  const focus = surf.focus;
  // The open question, as a retrieval query: the figure the reading circled, beside the
  // turn's own resolved query — so the widening reads the source ABOUT that figure.
  const q = `${query || ''} ${focus}`.trim();
  const more = (await retrieve(q, k)) || [];
  const have = new Set(spans.map((s) => s.idx));
  const added = more.filter((s) => s && s.idx != null && !have.has(s.idx));
  if (!added.length) return { spans, added: 0, asked: focus };
  return { spans: [...spans, ...added], added: added.length, asked: focus };
};
