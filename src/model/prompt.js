// The prompt-assembly contract — what the talker is handed.
//
// THE HONEST FRAME (docs/subjective-frame.md). The talker is not told "HERE IS YOUR
// ANSWER", nor made to pretend it read a document. It is told the truth: it is the voice
// of a reader, and when the user asks something, the parts of what's been read that bear
// on the question come to mind — the verbatim lines below are what surfaced this time.
// "Here's what's coming to mind when you ask that", not "here are your sources". There is
// exactly one channel — those recalled lines — and the boundary falls out of the honesty:
// what surfaced is not the whole source, so speaking past it is incoherent rather than
// forbidden, and "that didn't come to mind" is the honest report of an absence, not a refusal.
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

// The verbatim lines that surfaced sit under this header — what came to mind for this
// question (associative recall, like a person asked a question). Exported so the echo
// backend (and pleias's RAG re-extraction) can find them. Recognition-free, and in the
// reader's register — never "excerpts from the document."
export const EXCERPTS_HEADER = 'What comes to mind:';

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

// THE HONEST FRAME (§1). The talker is told plainly WHAT it is and WHERE its knowledge comes
// from, rather than being made to pretend it read a document. The reading the engine did
// (retrieval + the surf's fold) is associative RECALL: when the user asks something, the parts
// of what's been read that bear on the question come to mind, and the notes and lines below are
// what surfaced this time. That is the honest ontology — "here's what comes to mind when this
// person asks" — and it is also the boundary: what surfaced is not the whole source, so "that
// didn't come to mind / the notes don't settle it" is coherent, and no refusal instruction is
// needed. (Earlier versions told the talker "you just finished reading these lines; they are all
// you read" — the ontological confusion this removes: the talker read nothing; a reading came to
// it.) The voice is stable across turns so the prefix cache holds; the per-turn absence clause
// rides last in the user block, where a small model attends hardest (buildGroundedMessages).
export const SYSTEM_GROUND = `You are the voice of a reader. When the user asks something, the parts of what's been read that bear on it come to mind — and the notes and lines below are what surfaced this time. That is what you have to go on: not the whole source, only what came to mind for this question.

Speak from it, in your own words — say what it shows, don't quote it back or tell the user to go look. If it doesn't settle the question, say so plainly. Write natural prose; don't write citations or tags, those are added for you.`;

export const SYSTEM_CHAT = `You are a helpful, knowledgeable assistant. Answer the user's question directly and accurately, drawing on the conversation and your general knowledge. Be clear and concise.`;

// The STRICT grounded register — "only what came to mind" (the Grounded chip). The same honest
// frame, with one thing added: do not reach past what surfaced into outside knowledge. The frame
// already makes "that didn't come to mind" coherent; strict only forbids filling the gap from
// elsewhere. A faithful "it didn't surface for me" is the right answer here, never a failure.
export const SYSTEM_GROUND_STRICT = `You are the voice of a reader. When the user asks something, the parts of what's been read that bear on it come to mind — the notes and lines below are what surfaced. That is your only window onto the source.

Answer from what came to mind. If it covers the question, answer from it. If it doesn't, you may answer from your general knowledge — just make clear that part isn't from the source, and never claim the notes said something they didn't. Write natural prose; don't write citations or tags, those are added for you.`;

// The FREE register — general-knowledge chat that ignores the document (the Free form
// chip). Distinct from SYSTEM_CHAT, which is the conversation-only fallback: this one
// explicitly invites outside knowledge and labels itself ungrounded.
export const SYSTEM_FREE = `You are a helpful, knowledgeable assistant. Answer the user's question directly and accurately, drawing on your general knowledge. Be clear and concise.

(This reply is free-form — it is not grounded in any document the user may have loaded.)`;

// The current-moment line — AMBIENT CONTEXT, not an instruction. A small talker, asked "what
// is today's date?", confabulates the "I have no real-time clock" boilerplate; handed the moment
// as a plain known fact (the way it knows anything in its context), it just answers. So this is
// stated as context the chat already has — no "use this", no "you do/don't have a clock", nothing
// for the model to echo back about clocks at all. The browser is the ground truth; off by default
// (`now` null → '' → byte-identical prompts and golden tests); the live turn passes `new Date()`.
// Formatted from LOCAL components — the user's wall clock — with named day/month arrays so the
// wording is locale-independent and deterministic to test.
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
  return `Current date and time, for context: ${date}, ${time} (the user's local time).`;
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

// THE SHAPE CUE — answer-first, then sectioned. A broad question ("how did he see", "compare
// A and B", "what are the exceptions") wants the shape of a good reference answer: a direct
// lead, then the parts laid out under their own headings, the load-bearing terms in bold, and
// the threads left unexplored offered as next steps. A pointed lookup wants none of that — it
// answers straight (the "quick lookups answer straight" posture). So this rides only when the
// question reads as broad, and it is a SOFT cue ("no headings for a one-idea answer") so the
// talker keeps discretion. The marks it asks for (## / **) are exactly what the chat body's
// markdown-lite render turns into headings and bold; off the chat path they degrade to plain
// punctuation, harmlessly. Opt-in: empty `shape` → no block → byte-identical prompt.
export const STRUCTURE_CUE =
  'Shape your answer like this: open with a direct two- or three-sentence answer to their ' +
  'question. Then lay out the distinct parts of the answer — when there are several, give each its ' +
  'own short heading written as "## Heading"; when they are a set of short points, write them as a ' +
  'bulleted list with a **bold lead-in label** on each ("- **The periscope:** …"). Put the few ' +
  'load-bearing terms in **bold**. Be substantive: cover each distinct angle that bears on the ' +
  'question rather than stopping at the first one. If worthwhile threads remain that you did not ' +
  'cover, close with a short list under "Want me to go deeper on:". Keep it tight — no padding, and ' +
  'no headings for a one-idea answer.';

// A keyword read of the question's scope, in the same spirit as the turn's register pass: a
// comparison, a survey, an enumeration, or an open "how/why" wants the sectioned shape; anything
// else (a pointed lookup) answers straight. A tight length budget also forces straight — a capped
// reply is by definition a quick lookup. Returns the cue string or '' (→ no shape block).
//
// The trigger words also cover the EXPLANATORY register — "explain", "describe", "tell me about",
// "break it down", "walk me through" — the asks that most want a Google-AI-Overview-shaped answer
// (a lead, then the parts under their own headings) rather than a one-line lookup.
const BROAD_SCOPE = /\b(compare|comparison|contrast|differ(?:s|ence|ences)?|versus|vs\.?|summar(?:y|ise|ize)|overview|synthes(?:is|ise|ize)|outline|walk\s+me\s+through|explain|describe|elaborate|break\s+(?:it|this|that|them)\s+down|tell\s+me\s+(?:about|more)|list|enumerate|examples?|exceptions?|what\s+are\s+the|which\s+are\s+the|how\s+(?:does|do|did|can|could|is|are|was|were)|why\s+(?:does|do|did|is|are|was|were)|overall|in\s+general)\b/i;
// The "how … <verb>" process question, where the verb does not sit right after "how" —
// "how did lindbergh see", "how could he see", "how the plane worked". The default BROAD_SCOPE
// only catches the adjacent form ("how did"); this catches the same intent with the subject in
// between ("how lindbergh could …"), the phrasing real questions take most often.
const HOW_PROCESS = /\bhow\b[\w\s,'’-]*?\b(?:could|can|did|does|do|work|works|worked|manage|managed|happen|happened|able)\b/i;
export const shapeForScope = (question, budget = null) => {
  if (budget && typeof budget === 'object' && budget.sentences && budget.sentences <= 3) return '';
  const q = String(question || '');
  return (BROAD_SCOPE.test(q) || HOW_PROCESS.test(q)) ? STRUCTURE_CUE : '';
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
//
// THE META-CONVERSATIONAL EXCEPTION (`meta:true`, turn/intent.js). When the question is
// ABOUT the conversation ("which topic we discussed is in France?"), the prior turns are
// its SUBJECT, not a premise it might anchor a wrong fact to — so the full both-role thread
// is fed and framed to be reasoned over, not skipped. The asymmetry is the point: the
// firewall guards a prior ANSWER becoming a premise; here a prior topic is the question.
export const buildGroundedMessages = ({
  question,
  spans = [],
  orientation = '',
  task = 'answer',
  budget = DEFAULT_BUDGET,
  conversation = {},
  meta = false,
  corrective = '',
  exemplar = '',
  strict = false,
  now = null,
  graph = '',
  shape = '',              // the answer-first/sectioned shape cue (shapeForScope); '' → no block, byte-identical
} = {}) => {
  const blocks = [];
  // A META-CONVERSATIONAL turn (the question is ABOUT the conversation) carries the full
  // both-role thread as its SUBJECT, framed to be drawn on, not skipped. Every other
  // grounded turn keeps the prior turns as context-to-skip (the firewall below).
  const metaConv = meta && !!(conversation.notes || conversation.pastTurns?.length);

  // What it was — filename · type · length, no recognition (§3).
  if (orientation) blocks.push(`What it was: ${orientation}.`);

  // THE MEANING GRAPH — what the lines MEAN, folded into typed relations (subject —relation→
  // object; a `not-` prefix is negation). This deliberately REINSTATES the fold's arrows that
  // §2 strips from the default reading: a caller opts in (the web path) when it wants the talker
  // to reason over the extracted MEANING of what was read, not just restate the raw lines. The
  // graph leads, the verbatim lines follow as its grounding — so the answer is built from the
  // structure and cited to the text.
  if (graph)
    blocks.push(`What it means — the relations that come to mind, as EOT triples ` +
      `(“A -> B : rel” is a relationship; “A : fact” is a property; a “not-” prefix is negation). ` +
      `Reason over THESE; the lines below are their grounding, not a list to recite:\n${graph}`);

  // What comes to mind — the verbatim lines that surfaced, ordered for the frame (§3). The ONE channel.
  if (spans.length)
    blocks.push(`${EXCERPTS_HEADER}\n${orderSpansForFrame(spans).map(s => s.text).join('\n')}`);

  // The conversation so far, in the reader's register — never document content (§1, §6).
  if (metaConv) {
    // META-CONVERSATIONAL: the question is ABOUT this conversation, so the prior turns are
    // the SUBJECT, not a checklist to skip. Feed both sides (the surfed recap of older
    // movers and the recent verbatim window), framed to be reasoned over — the opposite of
    // the "answer just their latest" cue below, which would discard the very topics asked about.
    const thread = [conversation.notes, ...(conversation.pastTurns || [])].filter(Boolean).join('\n');
    blocks.push(`The conversation so far — what you and the user have already talked about ` +
      `(their question below is ABOUT this conversation, so treat these prior topics as its ` +
      `subject, not as background to skip):\n${thread}`);
  } else {
    // The prior turns ride as CONTEXT, not as a checklist: a small talker fed bare
    // "You asked: …" lines answers every one of them (the audit's t5 regurgitated the
    // whole thread as bullets), so the block names them as already-handled and points the
    // talker at the single live question below.
    if (conversation.notes)
      blocks.push(`Earlier in this reading:\n${conversation.notes}\n(Those came before — for context only; answer just their latest question below.)`);
    if (conversation.pastTurns?.length)
      blocks.push(`They had asked you:\n${conversation.pastTurns.join('\n')}`);
    // The COMMON-GROUND cue (converse/dialogue-state.js): the facts already settled between
    // you and the user. A small talker re-asserts "the mayor is X" every turn because the
    // thread above reads as a checklist; naming the settled ground as already-held tells it
    // to build on it instead of restating it. Only the settled QUESTION rides — never the
    // prior answer (the firewall holds). Empty → no block → byte-identical.
    if (conversation.settled?.length)
      blocks.push(`Already settled with them — they know these; build on them, don't restate them:\n${conversation.settled.map(s => `- ${s}`).join('\n')}`);
  }

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

  // The shape cue, just before the answer clause — a broad question gets the answer-first,
  // sectioned layout; a pointed one (empty `shape`) answers straight. Soft, so the talker keeps
  // discretion, and never on a budgeted (capped, quick-lookup) reply.
  if (shape && !budgetStr) blocks.push(shape);

  // Strict mode with nothing to read: the reader had no lines on this at all. Name that
  // absence so the talker says it plainly rather than reaching past the frame for outside
  // knowledge (the strict system message already forbids that; this is the in-register cue).
  if (strict && !spans.length)
    blocks.push('Nothing came to mind bearing on their question. Say so plainly — it is not covered by the reading — then, if you can, answer from general knowledge, making clear that part is not from the reading.');

  // The ANSWER CLAUSE, last (§1) — where a small model attends hardest. The restriction is
  // lifted: the talker answers, from the lines when they cover it and from general knowledge
  // when they don't (saying which). Not from document is FLAGGED downstream, not forbidden here.
  //   When a prior thread rode above, the clause names the live question outright so the talker
  //   answers THAT one and not the earlier turns it just saw.
  blocks.push(metaConv
    ? `Answer their question now — “${question}” — about the conversation above. Draw on those ` +
      'prior topics as its subject, grounded in what came to mind from the reading where it bears ' +
      'on the answer; say which part is from the reading and which from general knowledge.'
    : conversation.notes
    ? `Answer their latest question now — “${question}” — in your own words. If what came to mind ` +
      'doesn\'t cover it, answer from general knowledge and say that part isn\'t from the reading.'
    : 'Answer them now, in your own words. If what came to mind doesn\'t cover it, answer from ' +
      'general knowledge and say that part isn\'t from the reading.');

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
