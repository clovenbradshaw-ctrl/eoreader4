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
// words; it does not speak the machinery.
//
// Orientation now INCLUDES the document's own front-matter metadata — title, author,
// date — handed to the talker as facts beside the filename and length (`metadataBlock`,
// from doc.metadata, omnimodal). An earlier discipline WITHHELD these, for fear a
// talker that recognized a famous book would answer from the book it remembers rather
// than the graph it was handed. We lift that: the metadata IS the document (its front
// matter), so when chatting about a document this is exactly the kind of thing to
// include — and honesty is kept by the grounding check, not a blindfold. A claim the
// talker makes that the GRAPH also holds is corroborated, not a leak
// (factcheck/correspond.js); the answer is held to the reading on the way back.

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

// The orientation line: filename, type, length. The document's front-matter metadata
// (title, author, date) rides SEPARATELY, as facts — see `metadataBlock` and the
// header note on why recognition is no longer withheld.
export const orientationLine = ({ filename, type, length } = {}) => {
  const parts = [filename || 'the document', type || 'text'];
  if (length != null) parts.push(`${length} sentences`);
  return parts.join(' · ');
};

// The document's own front-matter metadata, rendered as a labeled block for the
// grounded prompt (doc.metadata, by canonical key — omnimodal: text harvests it from
// labeled lines, an image from EXIF, a score from ID3). Known keys lead in a stable
// reading order (title, then author, then the rest); any extra key follows under a
// title-cased label. Empty string when the document carries no metadata, so the slot
// simply does not appear.
const META_LABEL = {
  title: 'Title', subtitle: 'Subtitle', author: 'Author', editor: 'Editor',
  translator: 'Translator', illustrator: 'Illustrator', contributor: 'Contributor',
  composer: 'Composer', director: 'Director', artist: 'Artist', performer: 'Performer',
  producer: 'Producer', publisher: 'Publisher', date: 'Date', updated: 'Updated',
  language: 'Language', source: 'Source', subject: 'Subject', genre: 'Genre',
  series: 'Series', volume: 'Volume', edition: 'Edition', rights: 'Rights',
  isbn: 'ISBN', doi: 'DOI', from: 'From', to: 'To', cc: 'Cc',
};
const META_ORDER = ['title', 'subtitle', 'author', 'editor', 'translator', 'illustrator',
  'composer', 'director', 'artist', 'performer', 'producer', 'publisher', 'date', 'updated',
  'language', 'source', 'subject', 'genre', 'series', 'volume', 'edition', 'isbn', 'doi',
  'from', 'to', 'cc', 'rights'];
const titleCase = (k) => String(k).replace(/\b\w/g, (c) => c.toUpperCase());

export const metadataBlock = (metadata = {}, header = 'About this document (its own front matter):') => {
  const keys = Object.keys(metadata || {});
  if (!keys.length) return '';
  const ordered = [...META_ORDER.filter(k => k in metadata),
                   ...keys.filter(k => !META_ORDER.includes(k))];
  const lines = ordered
    .filter(k => metadata[k] != null && String(metadata[k]).trim())
    .map(k => `- ${META_LABEL[k] || titleCase(k)}: ${metadata[k]}`);
  return lines.length ? `${header}\n${lines.join('\n')}` : '';
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
  details = '',
  task = 'answer',
  budget = DEFAULT_BUDGET,
  conversation = {},
  corrective = '',
  strict = false,
} = {}) => {
  const blocks = [];

  if (orientation) blocks.push(`You are reading ${orientation}.`);
  // The document's own front-matter metadata (title, author, date, …) — handed as
  // facts so a metadata question is answerable. Content still comes from the notes
  // and excerpts below; this is the document telling you what it is.
  if (details) blocks.push(details);

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

// ── The cursor contract (SPEC §5, §11) ───────────────────────────────────────
// The generation membrane. Where the reading path answers a question, the writing
// path realizes ONE beat of a longer piece: the substrate hands the model a locally
// resolved impression — the integral name per argument Site (identity fixed), the
// open questions held OUT (unsettled, do not assert), the typed edge in surface, the
// grounded spans — and the model collapses it to one fluent sentence. The substrate
// OVER-specifies the input (full integral, to kill mis-binding); the model
// UNDER-specifies the output (natural form, he/Gregor, no repetition). Same relaxed
// renderer posture as SYSTEM_GROUND; the surface discipline (§3) governs the whole
// prompt — no hashes, no codes, no indices ever reach the model.
export const SYSTEM_CURSOR = `You are a sharp reading companion writing one beat of a longer piece. You've read this document. Write in your OWN WORDS — synthesize, don't quote the passage back. Use what you've established so far; you don't need to reintroduce people already named. Refer to people naturally once they're established (he, she, by name) — don't repeat their full description.

Write natural prose. Don't write citations, tags, or codes; those are added for you.`;

// buildCursorMessages — assemble the prompt for ONE cell from the cursor's slots.
// Every argument Site arrives as its INTEGRAL (full standing name, surface form);
// the open (void) attributes arrive named as unsettled. A void-resolved beat (§3b)
// carries a HEDGE instruction so the renderer withholds rather than overclaims. The
// returned shape is the {system,user} pair model.phrase(messages, opts) consumes.
export const buildCursorMessages = ({
  orientation = '',
  established = '',
  integrals = [],          // [{ name }] — the full integral per argument Site (surface)
  open = [],               // [string]  — void attributes, held open
  edge = '',               // the typed relation in surface: A --tends--> B
  beat = '',               // OR a beat instruction (free prose target)
  spans = [],              // grounded substance for this beat (exafference)
  target = '',             // the shape instruction ("one plain past-tense sentence…")
  band = 'firm',           // 'void' → hedge; 'firm' → assert (the propagated Resolution)
  corrective = '',         // a forward correction the previous beat's seam carried (§3c)
} = {}) => {
  const blocks = [];
  if (orientation) blocks.push(`You are reading ${orientation}. Read what is here; do not name or place the work.`);
  if (established)  blocks.push(`Established so far: ${established}.`);

  // Identity, collapsed AT THE CURSOR — the integral per argument Site (§5). A lone
  // referent is the Focus (cursor.mjs); a relation labels Subject / Object so the
  // model binds each slot to the right integral.
  if (integrals.length) {
    const focusLines = integrals
      .map((g, i) => {
        const label = integrals.length === 1 ? 'Focus'
          : i === 0 ? 'Subject' : i === integrals.length - 1 ? 'Object' : 'Also';
        return `  ${label}: ${g.name}`;
      })
      .join('\n');
    blocks.push(`Who this beat is about (already established — refer to them naturally):\n${focusLines}`);
  }
  // The void attributes, named as unsettled — do not assert (§2 FIRM-ONLY, §5).
  if (open.length)
    blocks.push(`Unsettled — do NOT assert as fact, leave open: ${open.join('; ')}.`);

  // The beat itself: a typed edge in surface, or a free instruction.
  if (edge) blocks.push(`What happens (from the document):\n  ${edge}`);
  if (beat) blocks.push(`The beat: ${beat}`);

  // A forward correction the prior beat's seam carried (§3c): the reading drifted
  // past the noise null, so the NEXT sentence acknowledges it in prose rather than
  // un-saying the last one. Plain language, no machinery — the talker just writes
  // the qualifier into its own sentence.
  if (corrective) blocks.push(corrective);

  if (spans.length)
    blocks.push(`${EXCERPTS_HEADER}\n${spans.map(s => s.text).join('\n')}`);

  // The SOFT gate, surfaced as posture (§3b): a void synthesis must hedge.
  if (band === 'void')
    blocks.push('This connection is not settled by the document — write it as a holding-open (suggests, stages, leaves open), never as a proven claim.');

  if (target) blocks.push(`Write: ${target}.`);

  return [
    { role: 'system', content: SYSTEM_CURSOR },
    { role: 'user',   content: blocks.filter(Boolean).join('\n\n') },
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
