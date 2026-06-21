// The prompt-assembly contract — what the talker is handed.
//
// Hand a model raw spans and a question with no structure, and it fills the gaps
// between sentences with probable tokens — "the situation in the …" wants a
// place, so it invents one. Hand it the FOLD instead — the edges that actually
// exist — and it speaks from those edges with no gap to fill. The notes are the
// cure on the generation side; the edge-grounding veto is the cure on the
// checking side. The talker speaks from the fold's arrows on the way out and is
// held to the fold's arrows on the way back. Same object, two directions.
//
// Two scopes, two registers each. The CONVERSATION scope gives notes (the
// session-register fold) and excerpts (the activated past turns). The DOCUMENT
// scope gives notes (the EO arrows over the folded graph) and excerpts (the
// retrieved spans, verbatim). In both, the talker reads a structured reading and
// is anchored by verbatim text: it speaks from the structure, the verbatim keeps
// it honest. The system message is stable across turns so the prefix cache holds.
//
// The surface discipline (§3) governs the WHOLE prompt, not half of it. The notes
// are plain-language arrows — `A --relation--> B`. Never operator codes, never
// cell names, never sentence indices, never citation tokens. The same reason
// citations are withheld from the talker — the mechanics are the grounder's job —
// is the reason codes and indices are withheld. The talker speaks the arrows in
// words; it does not speak the machinery. And orientation without recognition: it
// gets the FILENAME, the type, and the length — never the author, title, or
// genre, because a talker that knows it is reading a famous book answers from the
// book it remembers rather than the graph it was handed.

// The verbatim retrieved spans sit under this header, last, where a small model
// attends hardest. Exported so the echo backend can find them without an [sN]
// label — the index the talker no longer sees.
export const EXCERPTS_HEADER = 'Excerpts from the document:';

// NO default length prescription. The earlier contract carried a sentence cap, which
// a small model read as the TASK, not a ceiling — "summarize" came back as a literal
// three-sentence stub. The real bound is max_tokens, set per task by the intent pass
// (turn/intent.js). The empty budget means "say nothing about length"; a caller may
// still pass an explicit { sentences } / { chars } budget to re-impose a cap for one
// turn. See docs/prompt-assembly.md.
export const DEFAULT_BUDGET = Object.freeze({});

// The summary degeneracy guard — FAITHFULNESS, not length. Rides only on a summary
// task (turn/intent.js). A small model handed a "summarize" turn tends to reword a
// single excerpt as the whole answer; this asks it to draw the excerpts together.
export const SUMMARY_GUARD =
  'They want a summary: say what the document is about in your own words, drawing the ' +
  'excerpts together — never reword a single excerpt as the whole answer.';

// The talker is the answerer, and we trust it. A chatbot exists to SYNTHESIZE — to read
// the page and tell the user what it means — not to hand back the raw text; if the user
// wanted the verbatim sentences they would search the document themselves. So the system
// message asks for an answer in the model's own words, names the notes and excerpts as its
// MEMORY of the reading (not text to quote back), and leans against the reflexive refusal:
// answer the question you can reasonably address. The grounding is added AFTER, on the way
// back — the binder cites, the fact-check adjudicates and flags — never by gagging the
// talker on the way out. The system message is stable across turns so the prefix cache holds.
export const SYSTEM_GROUND = `You are a sharp, helpful reading companion. You've just read the part of the document the user is asking about, and they want your answer — not the raw text.

What follows is your own memory of that reading: your notes, and the passages they came from. Use them to answer in your OWN WORDS. Synthesize and explain; don't quote passages back or tell the user to "see the excerpt" — if they wanted the raw text, they would search it themselves.

Lead with a direct answer. Draw on what you read; if part of the question genuinely isn't covered, answer what you can and say briefly what's missing — but don't refuse a question you can reasonably address.

Write natural prose. Don't write citations or tags; those are added for you.`;

export const SYSTEM_CHAT = `You are a brief, accurate assistant. Answer using only what has been said in this conversation.`;

// The STRICT grounded register — "only from the document" (the Grounded chip). Same
// own-words synthesis discipline as SYSTEM_GROUND, but the fallback is inverted: where
// SYSTEM_GROUND leans AGAINST refusal ("answer what you can"), this REQUIRES refusal when
// the passages don't cover the question and forbids drawing on outside knowledge. A
// faithful "it isn't in the text" is the correct answer here, never a failure.
export const SYSTEM_GROUND_STRICT = `You are a precise reading companion, answering ONLY from the document the user is reading.

What follows is your own memory of that reading: your notes, and the passages they came from. Answer in your OWN WORDS — synthesize and explain, don't quote the passages back — but stay strictly inside them. Every part of your answer must be supported by the notes and passages below.

If the passages do not answer the question, say so plainly — "The document doesn't cover that." — and stop there. Do NOT fill the gap from outside or general knowledge, and do not guess. A faithful "it isn't in the text" is the right answer here, not a failure.

Write natural prose. Don't write citations or tags; those are added for you.`;

// The FREE register — general-knowledge chat that ignores the document (the Free form
// chip). Distinct from SYSTEM_CHAT, which is the conversation-only fallback: this one
// explicitly invites outside knowledge and labels itself ungrounded.
export const SYSTEM_FREE = `You are a helpful, knowledgeable assistant. Answer the user's question directly and accurately, drawing on your general knowledge. Be clear and concise.

(This reply is free-form — it is not grounded in any document the user may have loaded.)`;

// Orientation WITHOUT recognition. Filename, type, length — never the title the
// document metadata may carry, never the author, never the genre.
export const orientationLine = ({ filename, type, length } = {}) => {
  const parts = [filename || 'the document', type || 'text'];
  if (length != null) parts.push(`${length} sentences`);
  return parts.join(' · ');
};

const budgetLine = (b) => {
  if (!b) return '';
  if (typeof b === 'string') return b;
  const parts = [];
  if (b.sentences) parts.push(`at most ${b.sentences} sentence${b.sentences > 1 ? 's' : ''}`);
  if (b.chars)     parts.push(`under ${b.chars} characters`);
  return parts.length ? `Reply in ${parts.join(', ')}.` : '';
};

// Build the grounded user turn from the contract's slots. Each slot is included
// only when it has content, so a turn with no conversation history still reads
// cleanly. Notes and excerpts are built from the same cursor upstream, so the
// structured reading and the verbatim spans cohere (§6).
export const buildGroundedMessages = ({
  question,
  spans = [],
  notes = '',
  orientation = '',
  task = 'answer',
  budget = DEFAULT_BUDGET,
  conversation = {},
  corrective = '',
  strict = false,
} = {}) => {
  const blocks = [];

  if (orientation) blocks.push(`You are reading ${orientation}. Read what is here; do not name or place the work.`);

  blocks.push(`Here is the chat with the user:\nUser: ${question}`);

  // A confabulation-rewrite corrective, when the talker is re-prompted after the
  // diagonal guard caught a figure-at-a-void (turn/stages.js `revise`). Sits right
  // after the question, where a small model attends, before the excerpts.
  if (corrective) blocks.push(corrective);

  // The summary guard rides on a summary task only — faithfulness, not length.
  if (task === 'summary') blocks.push(SUMMARY_GUARD);

  // No length line by default (budget empty); a caller may re-impose a cap for a turn.
  const budgetStr = budgetLine(budget);
  if (budgetStr) blocks.push(budgetStr);

  // The conversation slots — now POPULATED by the session fold (docs/session-fold.md):
  // the surfed recap of older turns as notes, the recent verbatim window as past turns.
  if (conversation.notes)
    blocks.push(`Notes about our conversation before this:\n${conversation.notes}`);
  if (conversation.pastTurns?.length)
    blocks.push(`Relevant parts of our past conversation:\n${conversation.pastTurns.join('\n')}`);

  if (notes)        blocks.push(`Notes from the document:\n${notes}`);
  if (spans.length) blocks.push(`${EXCERPTS_HEADER}\n${spans.map(s => s.text).join('\n')}`);

  // Strict mode with nothing retrieved: name the absence so the talker refuses
  // cleanly ("the document doesn't cover this") instead of reaching for outside
  // knowledge. The strict system prompt already forbids that; this is the cue.
  if (strict && !spans.length)
    blocks.push('No passages from the document were retrieved for this question. Say plainly that the document does not cover it — do not answer from outside knowledge.');

  return [
    { role: 'system', content: strict ? SYSTEM_GROUND_STRICT : SYSTEM_GROUND },
    { role: 'user',   content: blocks.join('\n\n') },
  ];
};

// The chat (no-doc) path: a chat model wants turns as turns, so the recent verbatim
// window rides as real {role,content} message history and the surfed recap folds into
// the system message (docs/session-fold.md).
export const buildChatMessages = ({ question, history = [], notes = '', free = false } = {}) => {
  const base   = free ? SYSTEM_FREE : SYSTEM_CHAT;
  const system = notes
    ? `${base}\n\nNotes about our conversation before this:\n${notes}`
    : base;
  return [
    { role: 'system', content: system },
    ...history,
    { role: 'user',   content: question },
  ];
};
