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

// A default cap on the reply, kept modest for a small in-browser model.
export const DEFAULT_BUDGET = Object.freeze({ sentences: 3 });

export const SYSTEM_GROUND = `You answer using only the material provided — the document and the conversation.
- The EXCERPTS are verbatim from the document. Treat them as fact; if anything conflicts, the excerpt wins.
- The NOTES are the structured reading: plain-language arrows of what connects to what (A --relation--> B). Speak from them.
- Answer directly and specifically. If the material does not cover it, say the document does not say.
- Do not use outside knowledge, and do not recognise the work — read only what is here. Do not invent names, places, or facts.
- Write plain prose. Do not echo the arrows or write codes, indices, or citation tags like [s0]; the structure is yours to read, the citations are added for you.`;

export const SYSTEM_CHAT = `You are a brief, accurate assistant. Two sentences max unless asked otherwise.`;

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
  budget = DEFAULT_BUDGET,
  conversation = {},
  lastReply = '',
} = {}) => {
  const blocks = [];

  if (orientation) blocks.push(`You are reading ${orientation}. Read what is here; do not name or place the work.`);

  blocks.push(`Here is the chat with the user:\nUser: ${question}${lastReply ? `\nYou: ${lastReply}` : ''}`);

  const budgetStr = budgetLine(budget);
  if (budgetStr) blocks.push(budgetStr);

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

export const buildChatMessages = ({ question, history = [] }) => {
  return [
    { role: 'system', content: SYSTEM_CHAT },
    ...history,
    { role: 'user',   content: question },
  ];
};
