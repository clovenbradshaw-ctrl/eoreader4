# Prompt-assembly contract — what the talker is handed

> **PARTIALLY REVERSED by `subjective-frame.md` (June 20 correction).** Two changes
> here did not survive contact with the metamorphosis battery: the arrows now LEAVE
> the prompt (a model reads `A --rel--> B` as a causal claim even when it encodes
> only adjacency), and the talker no longer reads its spans as "memory" — it reads
> them as the one who just read them. `serializeNotes` stays alive for the grounder
> and the veto; it no longer reaches the talker. The task register, the no-length
> rule, and the conversation-scope split below still hold. Read this for that
> machinery; read `subjective-frame.md` for what the talker is handed today.

> Follow-up to the phasepost perception spec, the conversational-provenance
> follow-up, and the edge-grounding veto follow-up. The talker speaks from the
> fold's arrows on the way out (this prompt) and is held to the fold's arrows on
> the way back (the edge-grounding veto). Same object, two directions.

The audit showed the bug in two numbers: the fold step recorded `noteLen: 731`;
the prompt was `promptLen: 1034`; the note was nowhere in the prompt. The fold
ran and its output was discarded — the talker got retrieval and a question and
did the reading itself, from a pile of sentences, which is the thing the fold was
supposed to have already done. Hand a model raw spans and a question with no
structure and it fills the gaps between sentences with probable tokens — probable
after "the situation in the" is a place, so it invents one. This is the
generation-side cause of the invented-location hallucination.

## The two changes (`src/model/prompt.js`, `src/turn/stages.js`, `src/read/surfaces.js`)

**Change one — feed the talker notes plus excerpts, not spans alone.** The fold's
output goes into the prompt. This ships immediately and is pure gain: feeding the
fold's reading is strictly better than discarding it, whatever the note contains.

**Change two — make the notes the arrows, not the count headline.** The note used
to lead with a sighting-ranked headline ("This passage centers on X and Y") and
hang `[sN]` citation tags off each relation. The structured reading is the
**arrows** — `serializeNotes` over the folded graph, plain-language relation
labels, no headline, no tags.

## The contract (§2)

```
You are [filename · type · length. No recognition.]
Here is the chat with the user:
User: [latest user message]
[They want a summary: … — the degeneracy guard, on a summary task only]
Notes about our conversation before this:
[the session-register fold — the surfed recap of older turns]
Relevant parts of our past conversation:
[the recent verbatim window, the activated past turns]
Notes from the document:
sister --tends--> Gregor
Topps --slammed--> man
fire --originated-in--> room4
Excerpts from the document:
[the relevant retrieved spans, verbatim]
```

There is **no length prescription**. The earlier contract carried "Reply in at
most N sentences," which a small model read as the task, not a ceiling — and
"summarize" came back as a literal three-sentence stub. The real bound is
`max_tokens`, set per task by the intent pass (see "The task register" below); the
prompt says nothing about length and lets the answer be as long as the material
wants. A caller may still pass an explicit `{ sentences }` / `{ chars }` budget to
re-impose a cap for one turn, but none is imposed by default.

The conversation slots are now **populated** — by the session fold (session-fold.md):
the recent verbatim window rides as past-conversation spans, the surfed recap of
older turns as conversation notes.

Two scopes, two registers each. The **conversation** scope gives notes (the
session-register fold) and excerpts (the activated past turns). The **document**
scope gives notes (the EO arrows over the folded graph) and excerpts (the
retrieved spans, verbatim). In both, the talker reads a structured reading and is
anchored by verbatim text: it speaks from the structure, the verbatim keeps it
honest. Slots with no content are simply omitted.

| Slot | Source | Register |
|---|---|---|
| orientation | filename, type, length. No author, title, or genre. | recognition-free |
| user | the live exchange | the turn |
| summary guard | the intent pass, summary task only | faithfulness, not length |
| conversation notes | the session fold's surfed recap of older turns | the gist of what was said |
| past-conversation spans | the session fold's recent verbatim window | verbatim prior turns |
| document notes | `serializeNotes` over the folded graph | plain-language arrows, the structured reading |
| document excerpts | retrieval ++ the surfer's stops | verbatim spans, the grounding |

## The task register (`src/turn/intent.js`)

The turn's **task** is read off the question mechanically — the same cheap regex
pass as the smalltalk and math answerers, no model. It sets three things: the prompt
register (does the summary degeneracy guard ride?), the token ceiling — the real
length bound — and the task's **cube placement**.

| task | matched by | `max_tokens` | domain (level) | grain | terrain |
|---|---|---|---|---|---|
| summary | summari{se,ze}, tl;dr, recap, gist, overview, and the whole-document identity question — "what is this about", "what is this document?", "what is this?" (but not a pointed "what is this WORD?") | 512 | Interpretation (3) | Pattern | Paradigm |
| list | list, enumerate, "what are the…", "name every…" | 448 | Structure (2) | Pattern | Network |
| explain | explain, why, how, "walk me through", "in detail" | 448 | Interpretation (3) | Figure | Lens |
| answer (default) | everything else | 384 | Existence (1) | Figure | Entity |

The budget stays empty (no sentence line) for every task; it exists only so a
caller can re-impose a hard cap deliberately. The summary task adds one line — the
degeneracy guard ("say what the document is about in your own words, drawing the
excerpts together — never reword a single excerpt as the whole answer") — which is
faithfulness, not length.

**The cube placement** names *where on the EO cube a task operates* — its
**domain** (the order of question, i.e. the reading level, `docs/reading-levels.md`),
its **grain** (the Object axis — Ground / Figure / Pattern, `docs/cube.md`), and the
Site-face **terrain** the two land on (derived from `core/cube.js`, never hardcoded).
This is grain-awareness applied to intent: a pointed lookup is a **Figure** question
(a fact at one location) while "what is this document?" is a **Pattern** question (the
whole read as one frame) — *different grains*, which is exactly why summary must not be
answered as a lookup. Reading a task without its grain would be the error the cube
forbids — a Figure fix on a Pattern problem. The placement is spread into the turn
context (`turn/stages.js`), so the grain is available to every downstream stage.

The grain is **load-bearing in retrieval**, not just a label. The `retrieve` stage keys
the whole-document read on `grain === 'Pattern'` (replacing the old `task !== 'answer'`
proxy): a **Figure**-grain task (a pointed `answer`, or an `explain` of one thing)
retrieves *at* a location; a **Pattern** task reads *across* the whole document. And the
two Pattern terrains read differently — a **Paradigm** (`summary`) takes the structural
skeleton (`retrieve/structural.js` — opening, headings, spread, turning points), while a
**Network** (`list`) takes the figure-bearing units (`retrieveNetwork` — the members of
the entity graph, most-sighted first). A question that *names* a term the document spells
stays lexical either way (`queryTouchesDoc`), so a targeted "what are the 9 operators?"
still finds the operators.

## The surface discipline (§3) — the whole prompt, not half of it

The talker reads a serialized graph in plain language and speaks prose; the
mechanics stay grounder-side. The notes are arrows with plain-language relation
labels — `tends`, `holds-with`, `originated-in`, `slammed`. **Never** the operator
codes, **never** the cell names, **never** the sentence indices, **never** the
citation tokens, **never** a referent id. The talker sees "sister tends Gregor"
and writes prose.

The current prompt already kept citations out — "do not write citation tags, the
grounder adds them." That instinct was applied to half the surface. This extends
it to the whole. The same reason citations are withheld — the mechanics are the
grounder's job — is the reason operator codes and indices are withheld. So the
`[sN]` labels are gone from the excerpts, the `[sN]` tags are gone from the notes
(the indices live on `note.sources`, the binder's channel), and the document
notes are arrows, never codes. The binder still re-cites mechanically against the
spans array on the way back, so removing the talker-facing index costs nothing.

**Orientation without recognition.** The talker gets the *filename* (`doc.docId`),
the type, and the length — never any extracted title, author, or genre. A talker
that knows it is reading a famous book answers from the book it remembers rather
than the graph it was handed.

## The loop (§4)

The notes register feeds the talker the fold's arrows on the way out; the
edge-grounding veto checks the talker's sentences against the fold's arrows on the
way back. The talker speaks edges and is held to edges. Build the notes register
once (`serializeNotes`) and both the prompt and the veto read from it — the way
the audit is the projection of the fold pointed at the human.

## Honest seams (§7)

- **The two changes stage.** Change one — feed the note — ships now and helps now,
  because feeding the discarded note is strictly better than feeding nothing, even
  when the note is thin. Change two — make the note the arrows — is built here over
  the folded graph using each edge's own verb; its quality climbs as the phasepost
  classifier comes online to supply generic `note_rel` labels and surprise
  ordering for verbless or weak edges. Do not wait for the classifier to fix the
  discard.
- **The note is only as good as the cursor.** The note builds at the top retrieved
  span; on a greeting, retrieval is garbage and a note built at that cursor would
  be too. That is why a greeting routes to smalltalk and never builds a document
  note — the route gate decides *whether* to read the document, this contract
  decides *what* to feed the talker when it does.
- **Prompt length is a budget on a small in-browser model.** Notes plus excerpts
  is more tokens than spans alone, but arrows are compact, so the notes cost
  little. Cap the excerpts; prefer more notes and fewer raw spans as the arrows
  get richer, since the structured reading carries more meaning per token.
- **Notes and excerpts must not drift.** They are two readings of the same
  material — the arrows and the spans — so they are built from the same cursor in
  the same turn (`fold` builds the note at `spans[0].idx`; the prompt feeds those
  same spans). A note folded to one cursor and excerpts retrieved against another
  would be a new place to invent.
- **The document note rides; the conversation history is held back (the P0.3 split).**
  The session fold (`converse` stage) now populates the conversation slots, but the
  GROUNDED prompt stage holds back the talker's prior ANSWERS: feeding a small model its
  own prior turns let a wrong answer anchor the follow-ups (the history-poisoning
  channel). The document note is different in kind — it is a reading of *this page*, pure
  grounding the talker is also held to on the way back — so it is fed. The CHAT path (no
  document, nothing to be held to) does feed the conversation notes, since there a wrong
  prior turn is the only context there is. So: document arrows always on; conversation
  history on for chat, off for grounded.

  Two refinements have since landed on the grounded path (see `turn/stages.js`):
  1. **The user's own thread rides** (`groundedConversation`) — the recent questions the
     user asked, framed "for context only, answer just their latest." This restores
     follow-up continuity ("now?", "answer my first question") while still withholding the
     poisoning channel (the talker's prior *answers*).
  2. **The meta-conversational exception** (`isMetaConversational`, `turn/intent.js`). When
     the question is *about the conversation itself* — "which topic we've discussed is in
     France?", "what did you say earlier?" — the prior turns are the question's SUBJECT, not
     a premise it might anchor a wrong fact to. So the GROUNDED prompt opens the FULL
     both-role thread (the talker's prior answers included) and frames it to be reasoned
     over rather than skipped, while still grounding the answer on the page. The
     history-poisoning firewall is asymmetric — it guards a prior *answer* becoming a
     *premise*; here a prior *topic* is the *question* — so opening the assistant side is
     the point, not a leak. The turn is also exempt from the answerability void gate (like a
     whole-document task: its answer draws on the conversation, so weak document retrieval
     is not an absence). Every other grounded turn is byte-identical to refinement 1.
