// The task register — the turn's task, read off the question mechanically.
// (docs/prompt-assembly.md, "The task register")
//
// The same cheap regex pass as the smalltalk and math answerers, no model. It sets
// two things, and ONLY these two:
//
//   1. the prompt register — whether the summary degeneracy guard rides (summary
//      task only); a faithfulness instruction, NOT a length instruction.
//   2. the token ceiling (max_tokens) — the REAL length bound. The old contract
//      carried "Reply in at most N sentences," which a small model read as the task
//      ("summarize" came back as a literal three-sentence stub). There is no length
//      prescription in the prompt now; the answer is as long as max_tokens allows.
//
// Order matters: summary is read before list/explain because "what is this about"
// must not be captured by explain's "how/why".

export const TASK_MAX_TOKENS = Object.freeze({
  summary: 512,
  list:    448,
  explain: 448,
  answer:  384,   // the default
});

const SUMMARY = /\b(summar(?:y|ies|ise|ize|ising|izing)|tl;?dr|recap|gist|overview)\b|\bwhat(?:'s| is| are)\s+(?:this|it)\s+(?:mainly\s+)?about\b/i;
const LIST    = /\b(list|enumerate|bullet(?:s|ed)?|name\s+(?:every|all|each)|what\s+are\s+the)\b/i;
const EXPLAIN = /\b(explain|elaborate|walk\s+me\s+through|in\s+detail|why|how)\b/i;

export const readTask = (question) => {
  const q = String(question || '');
  if (SUMMARY.test(q)) return 'summary';
  if (LIST.test(q))    return 'list';
  if (EXPLAIN.test(q)) return 'explain';
  return 'answer';
};

// The full register for a turn: the task name and its token ceiling. The budget
// stays empty by default — no sentence line — so the only bound is max_tokens.
export const taskOf = (question) => {
  const task = readTask(question);
  return { task, maxTokens: TASK_MAX_TOKENS[task] ?? TASK_MAX_TOKENS.answer };
};
