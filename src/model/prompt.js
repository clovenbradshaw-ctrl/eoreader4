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

// P0.3: the talker is handed the excerpts ALONE — no notes block, no conversation
// block — so the system message names only the excerpts. The abstention line is now
// load-bearing: with the void auto-text gone (the void rides as terrain, not as a
// pre-emptive answer), the talker itself must decline when the excerpts do not cover
// the question, rather than invent on the empty field.
export const SYSTEM_GROUND = `You answer using only the EXCERPTS provided — verbatim sentences from the document.
- Treat the excerpts as fact; answer directly and specifically from them.
- If the excerpts do not cover the question, say the document does not say. Do not guess.
- Do not use outside knowledge and do not recognise the work. Do not invent names, places, or facts.
- Write plain prose, no codes or citation tags.`;

export const SYSTEM_CHAT = `You are a brief, accurate assistant. Answer using only what has been said in this conversation.`;

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

  return [
    { role: 'system', content: SYSTEM_GROUND },
    { role: 'user',   content: blocks.join('\n\n') },
  ];
};

// The chat (no-doc) path: a chat model wants turns as turns, so the recent verbatim
// window rides as real {role,content} message history and the surfed recap folds into
// the system message (docs/session-fold.md).
export const buildChatMessages = ({ question, history = [], notes = '' } = {}) => {
  const system = notes
    ? `${SYSTEM_CHAT}\n\nNotes about our conversation before this:\n${notes}`
    : SYSTEM_CHAT;
  return [
    { role: 'system', content: system },
    ...history,
    { role: 'user',   content: question },
  ];
};
