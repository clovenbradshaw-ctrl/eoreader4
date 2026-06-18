# Prompt-assembly contract — what the talker is handed

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
pass as the smalltalk and math answerers, no model. It sets two things: the prompt
register (does the summary degeneracy guard ride?) and the token ceiling — the
real length bound.

| task | matched by | `max_tokens` |
|---|---|---|
| summary | summari{se,ze}, tl;dr, recap, gist, "what is this about" | 512 |
| list | list, enumerate, "what are the…", "name every…" | 448 |
| explain | explain, why, how, "walk me through", "in detail" | 448 |
| answer (default) | everything else | 384 |

The budget stays empty (no sentence line) for every task; it exists only so a
caller can re-impose a hard cap deliberately. The summary task adds one line — the
degeneracy guard ("say what the document is about in your own words, drawing the
excerpts together — never reword a single excerpt as the whole answer") — which is
faithfulness, not length.

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
- **The conversation scope is wired but unfed.** The prompt builder renders the
  conversation notes and past-turn excerpts when supplied; the turn does not yet
  populate them — that is the conversational-provenance follow-up's session-field
  plumbing into `runTurn`, the same seam that doc named. The document scope ships
  now.
