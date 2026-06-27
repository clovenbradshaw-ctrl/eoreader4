// The prompt-assembly contract — what the talker is handed.
//
// THE SUBJECTIVE FRAME (docs/subjective-frame.md). The talker is not handed
// "sources" and asked to report over them; it is positioned as the one who just
// READ some lines, and its prose is its reading of them. There is exactly one
// channel in the prompt — the verbatim lines, the only thing it read — and the
// boundary is stated as a fact about the reader ("they are all you read"), not a
// rule about sources. This retires VOID-as-coercion: if those lines are all the
// reader saw, speaking past them is incoherent rather than forbidden, and "I did
// not find that" becomes the honest report of an absence, not a refusal.
//
// What this REVERSES from the earlier (prompt-assembly.md) contract, per the
// June 20 correction and docs/subjective-frame.md:
//   §2 — the fold's ARROWS leave the prompt. A model reads `A --rel--> B` as a
//        causal claim even when the edge encodes only adjacency (the post-hoc
//        fallacy); the arrows shipping today are degraded verb-fragments, noise
//        not spine. Relational structure now rides in span SELECTION and ORDER
//        (the grounder's job), never as arrows in the talker's input.
//   §3 — NO recognition. Orientation is filename · type · length only — never an
//        extracted title or author. A talker that knows it is reading a famous
//        book narrates the book it remembers, not the lines it read; this is the
//        exact leak the metamorphosis battery puts under test. The front matter
//        is still ANSWERABLE — a metadata question routes to a metadata answer
//        (turn/stages.js) — it is just no longer AMBIENT in a content turn.
//   §1 — stop calling the spans "memory." A reader read some lines; that framing
//        is what makes the boundary hold with no refusal instruction behind it.
//
// Structure stays in the grounder: in selection, in order (§3 below), and in the
// edge-grounding veto on the way back. `serializeNotes` / the substrate stay
// alive — they feed the grounder and the veto — they just never reach the talker.
//
// The system message carries the stable boundary + voice (prefix cache holds);
// the per-turn user block carries the lines, the conversation so far, the
// question, and the absence clause last, where a small model attends hardest.

// The verbatim lines the reader read sit under this header. Exported so the echo
// backend (and pleias's RAG re-extraction) can find them. Recognition-free, and
// in the reader's register — never "excerpts from the document."
export const EXCERPTS_HEADER = 'What you read:';

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
  'They want a summary: say what it is about in your own words, drawing the lines ' +
  'together — never reword a single line as the whole answer.';

// THE SUBJECTIVE FRAME (§1). The talker is positioned as the one who just read the
// lines below — not a reporter handed sources. The boundary is a FACT about the reader
// ("they are all you read"), so abstention is coherent, not forbidden: there is no
// refusal instruction here, and none is needed. The words "sources / context /
// passages / documents / memory" are deliberately kept OUT — a reader read some lines,
// and that framing is what holds the boundary. The voice is stable across turns so the
// prefix cache holds; the per-turn absence clause rides last in the user block, where a
// small model attends hardest (buildGroundedMessages).
export const SYSTEM_GROUND = `You just finished reading some lines — the ones below. They are all you read; you have not seen the rest of it.

Speak as the one who read them. Answer the user in your own words — say what you found, don't quote the lines back or tell them to go look. Write natural prose; don't write citations or tags, those are added for you.`;

export const SYSTEM_CHAT = `You are a helpful, knowledgeable assistant. Answer the user's question directly and accurately, drawing on the conversation and your general knowledge. Be clear and concise.`;

// The STRICT grounded register — "only what you read" (the Grounded chip). The same
// subjective frame, with one thing added: do not reach past the lines into outside
// knowledge. The frame already makes "I did not find that" coherent; strict only forbids
// filling the gap from elsewhere. A faithful "it wasn't in what I read" is the right
// answer here, never a failure.
export const SYSTEM_GROUND_STRICT = `You just finished reading some lines — the ones below. Answer from them first.

Speak as the one who read them. If the lines cover the question, answer from them. If they don't, you may answer from your general knowledge — just make clear that part isn't from the document (the grounding is marked for you, so don't claim the lines said something they didn't). Write natural prose; don't write citations or tags, those are added for you.`;

// The FREE register — general-knowledge chat that ignores the document (the Free form
// chip). Distinct from SYSTEM_CHAT, which is the conversation-only fallback: this one
// explicitly invites outside knowledge and labels itself ungrounded.
export const SYSTEM_FREE = `You are a helpful, knowledgeable assistant. Answer the user's question directly and accurately, drawing on your general knowledge. Be clear and concise.

(This reply is free-form — it is not grounded in any document the user may have loaded.)`;

// The current-moment line. A small talker, asked "what is today's date?", confabulates the
// "I have no real-time clock" boilerplate — true of its weights, false of the running app,
// which knows the moment exactly. This hands it that one fact so a date/time question is
// answered directly, no web hop needed (the browser clock is the ground truth here). Off by
// default (`now` null → '' → byte-identical prompts and golden tests); the live turn passes
// `new Date()`. Formatted from LOCAL components — the user's wall clock, the date they mean —
// with named day/month arrays so the wording is locale-independent and deterministic to test.
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const pad2 = (n) => String(n).padStart(2, '0');
export const currentMomentLine = (now = null) => {
  if (now == null) return '';
  let d;
  try { d = now instanceof Date ? now : new Date(now); } catch { return ''; }
  if (!d || Number.isNaN(d.getTime())) return '';
  const date = `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `For reference, the current date and time (the user's local clock) is ${date}, ${time}. ` +
    `Use this to answer any question about the date, day, year, or time directly — do not say you lack a clock.`;
};

// The orientation line: filename, type, length — and NOTHING that lets the talker
// narrate a famous text from memory (§3). No title, no author, no genre: the epistemic
// position of a reader who just set a file down. The front matter stays ANSWERABLE — a
// metadata question routes to a metadata answer (answerMetadata, turn/stages.js) — it is
// simply no longer AMBIENT in a content turn, where it invites narration-from-memory.
export const orientationLine = ({ filename, type, length } = {}) => {
  const parts = [filename || 'the document', type || 'text'];
  if (length != null) parts.push(`${length} sentences`);
  return parts.join(' · ');
};

// The document's own front-matter metadata, rendered as a labeled block (doc.metadata,
// by canonical key — omnimodal: text harvests it from labeled lines, an image from EXIF,
// a score from ID3). This NO LONGER rides the grounded content prompt (§3 — title/author
// are the recognition leak the battery tests). It feeds the METADATA ANSWERER instead
// (answerMetadata), which answers "who wrote this / when" from the front matter as a
// distinct fact. Known keys lead in a stable reading order (title, then author, then the
// rest); any extra key follows under a title-cased label. Empty string when none.
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

// Order the lines for the frame (§3, position bias — Lost in the Middle / Context Rot):
// strongest first (the cursor's argmax takes primacy), second-strongest last (the span
// that most needs retaining takes recency), the weakest buried in the middle. Four to
// eight lines. A read-only permutation over a fixed span set — the verbatim text is
// untouched, only its order. Surfed spans (score 0) sort to the middle, as they should.
export const orderSpansForFrame = (spans = [], { max = 8 } = {}) => {
  const ranked = [...spans].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, max);
  if (ranked.length <= 2) return ranked;
  const first = ranked[0];                 // primacy — the argmax
  const last  = ranked[1];                 // recency — the second-strongest
  const middle = ranked.slice(2);          // the rest, weakest at the tail of this desc list
  // Bury the weakest in the CENTRE: deal the middle outside-in, so the smallest lands
  // in the middle of the middle and the stronger of the rest sit at the edges.
  const left = [], right = [];
  middle.forEach((s, i) => (i % 2 === 0 ? left : right).push(s));
  return [first, ...left, ...right.reverse(), last];
};

// Build the grounded user turn as the SUBJECTIVE FRAME (§1–§3). One channel — the
// verbatim lines, the only thing the reader read — framed as a reading, with the
// question and the absence clause LAST where a small model attends hardest. No arrows
// (§2): relational structure rode into span selection and order upstream, never as
// `A --rel--> B` in the talker's input. No recognition (§3): orientation is
// filename · type · length, never a title or author. The conversation rides in the same
// reader's register (this reading so far), the USER's thread only — the talker's prior
// answers stay withheld (the poisoning channel), and an unbound one never folds in (§7).
export const buildGroundedMessages = ({
  question,
  spans = [],
  orientation = '',
  task = 'answer',
  budget = DEFAULT_BUDGET,
  conversation = {},
  corrective = '',
  exemplar = '',
  strict = false,
  now = null,
  graph = '',
} = {}) => {
  const blocks = [];

  // What it was — filename · type · length, no recognition (§3).
  if (orientation) blocks.push(`What it was: ${orientation}.`);

  // THE MEANING GRAPH — what the lines MEAN, folded into typed relations (subject —relation→
  // object; a `not-` prefix is negation). This deliberately REINSTATES the fold's arrows that
  // §2 strips from the default reading: a caller opts in (the web path) when it wants the talker
  // to reason over the extracted MEANING of what was read, not just restate the raw lines. The
  // graph leads, the verbatim lines follow as its grounding — so the answer is built from the
  // structure and cited to the text.
  if (graph)
    blocks.push(`What it means — the relations you read, as a graph (subject —relation→ object; ` +
      `“not-” = negation). Reason over THESE; the lines below are their grounding, not a list to recite:\n${graph}`);

  // What you read — the verbatim lines, ordered for the frame (§3). The ONE channel.
  if (spans.length)
    blocks.push(`${EXCERPTS_HEADER}\n${orderSpansForFrame(spans).map(s => s.text).join('\n')}`);

  // The conversation so far, in the reader's register — never document content (§1, §6).
  // The prior turns ride as CONTEXT, not as a checklist: a small talker fed bare
  // "You asked: …" lines answers every one of them (the audit's t5 regurgitated the
  // whole thread as bullets), so the block names them as already-handled and points the
  // talker at the single live question below.
  if (conversation.notes)
    blocks.push(`Earlier in this reading:\n${conversation.notes}\n(Those came before — for context only; answer just their latest question below.)`);
  if (conversation.pastTurns?.length)
    blocks.push(`They had asked you:\n${conversation.pastTurns.join('\n')}`);

  // A SHAPE exemplar — the nearest sample answer the form library matched (turn/shape.js),
  // offered so the FIRST draft is laid out in the right register and length. It is a FORM
  // model only: it is about a different text, so the talker must copy its shape, never its
  // facts. Empty (→ no block) on every turn with no library threaded — byte-identical.
  if (exemplar)
    blocks.push(`For the SHAPE only — here is the kind of answer this question wants (it is ` +
      `about a different text; copy its register and length, NOT its facts):\n“${exemplar}”`);

  // The live question — last of the material, just before the closing clause.
  blocks.push(`They asked you: ${question}`);

  // A confabulation-rewrite corrective, when the talker is re-prompted after the
  // diagonal guard caught a figure-at-a-void (turn/stages.js `revise`).
  if (corrective) blocks.push(corrective);

  // The summary guard rides on a summary task only — faithfulness, not length.
  if (task === 'summary') blocks.push(SUMMARY_GUARD);

  // No length line by default (budget empty); a caller may re-impose a cap for a turn.
  const budgetStr = budgetLine(budget);
  if (budgetStr) blocks.push(budgetStr);

  // Strict mode with nothing to read: the reader had no lines on this at all. Name that
  // absence so the talker says it plainly rather than reaching past the frame for outside
  // knowledge (the strict system message already forbids that; this is the in-register cue).
  if (strict && !spans.length)
    blocks.push('You read no lines bearing on their question. Say the document does not cover it, then, if you can, answer from general knowledge — just make clear that part is not from the document.');

  // The ANSWER CLAUSE, last (§1) — where a small model attends hardest. The restriction is
  // lifted: the talker answers, from the lines when they cover it and from general knowledge
  // when they don't (saying which). Not from document is FLAGGED downstream, not forbidden here.
  //   When a prior thread rode above, the clause names the live question outright so the talker
  //   answers THAT one and not the earlier turns it just saw.
  blocks.push(conversation.notes
    ? `Answer their latest question now — “${question}” — in your own words. If the lines don't ` +
      'cover it, answer from general knowledge and say it is not from the document.'
    : 'Answer them now, in your own words. If the lines don\'t cover it, answer from general ' +
      'knowledge and say it is not from the document.');

  const sysBase = strict ? SYSTEM_GROUND_STRICT : SYSTEM_GROUND;
  const moment = currentMomentLine(now);
  return [
    { role: 'system', content: moment ? `${sysBase}\n\n${moment}` : sysBase },
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
export const buildChatMessages = ({ question, history = [], notes = '', free = false, now = null } = {}) => {
  const base   = free ? SYSTEM_FREE : SYSTEM_CHAT;
  const moment = currentMomentLine(now);
  const withMoment = moment ? `${base}\n\n${moment}` : base;
  const system = notes
    ? `${withMoment}\n\nNotes about our conversation before this:\n${notes}`
    : withMoment;
  return [
    { role: 'system', content: system },
    ...history,
    { role: 'user',   content: question },
  ];
};
