# Reference by reading

Reference resolution is not a new subsystem. It is the reader, run on the
conversation, with the question as the last unit on the same reading line. The
pronoun is not a query to repair; it is reference to a referent that is already
warm, and the engine already keeps warmth over a cast (`readingAt`,
`src/perceiver/reading.js`). The conversation was simply never put on that line.

This replaces the regex/wordlist repair in `src/converse/focus.js` (a `PRONOUN`
regex, a `CORRECTION` regex, an `ATTRIBUTE` wordlist, a `needsContext` ladder, a
`resolveRetrievalQuery` that folds prior content words into the query string).

## The design

1. **The conversation is the tail of the reading line.** A turn is one or more
   units. They run through the same parse the document ran through
   (`perceiver/parse/pipeline.js`), observed by the same admission and the same
   `corefField`, so they append to one log in one id-space. The γ-prior makes
   recency correct without a rule: the document's early sentences are faded by
   the time the cursor reaches the question, and the referents the conversation
   just named are warm. The standing mass the reader already computes is the
   activation, read at the question.

2. **A turn is a surf; each pivot is a DEF target.** `surfFold` over the turn's
   span returns its stops; each stop carries its warmest figure (`surf.field`),
   so the DEF targets are read straight off it (as `surfToPlan` reads a per-stop
   focus today). A single-frame turn surfs to one stop; a multi-pivot turn surfs
   to several. `horizon: 'entity'` collapses the prior onto the DEF target's own
   arc.

3. **Each pivot seeds its own search.** The DEF target anchors a document surf at
   its locus (`localeOf` — the referent's strongest INS / incident-edge index,
   which `figureSurface` returns weight-ranked). RAG drops to one cheap channel
   that **nominates referents to warm the line**, not the thing that picks the
   subject.

4. **The correction is read, not detected.** "no the musician" is a unit on the
   line; the talker's prior reply ("Curtis Yarvin") was a unit too. The redirect
   is read as surprise against the prior, through the me-ness door
   (`readingAt` `opts.expect`), not matched by a `CORRECTION` opener.

## P0 findings — `scripts/reference-measure.mjs`

"Measure, and let it come back negative." A fixture reproduces the audit's
structure: a musician (Monk) introduced **early then faded**, a "His name is
Curtis Yarvin" distractor the word *name* retrieves, and Nietzsche / Dostoevsky /
Oedipus. The document **ends on Oedipus**, so the figure it hands the conversation
is *not* Monk — only the conversation can re-warm him. Each audit turn is parsed
onto the line and its span surfed. The result is nuanced, and it sharpens the
spec rather than confirming it whole:

| finding | evidence |
|---|---|
| **Parse-onto-the-line alone is NOT enough for a definite description.** "who is the musician?" carries no capitalised entity and "musician" binds to no CON edge, so warmth falls back to the document's stale handover (Oedipus), not Monk. | parse-warmest = *Old Oedipus* (·) for "who is the musician?" / "no the musician" |
| **Embedding nomination supplies the referent — no CON needed.** Retrieval points the line at Monk for "the musician". This is the load-bearing channel for definite descriptions (§3). | RAG-nominates = *Thelonious Monk* (✓) for both |
| **Putting the TALKER's reply on the line warms the right referent**, so the *pronoun* follow-up binds by warmth — where RAG misleads. | "but what is his name?": parse-warmest = *Thelonious Monk* (✓) once the T1 reply is a unit; RAG = *Curtis Yarvin* (✗) |
| **The correction is the residual hard case.** The talker's wrong answer (Curtis Yarvin) is warm on the line one unit back; only RAG re-nomination of "musician"→Monk re-weights it. Pure warmth picks the corrected (wrong) referent. | "no the musician": parse-warmest = *Curtis Yarvin* (·), RAG = *Monk* (✓) |
| **Pivots per turn = 1** in every realistic (single-sentence) turn. The multi-pivot path (§2/§3 flat-map over pivots) is **inert** by the spec's own P0 gate — build the single-target read. | pivots/turn: `1 1 1 1 1` |

**Conclusion.** The fix is wiring, but the wiring is *warmth ⊕ embedding
nomination*, not parse-alone. The reader holds the conversation on the line
(user **and** talker turns — §1, §4); RAG nominates referents that **warm** the
same field (§3); the **warmest figure at the question cursor is the single DEF
target**, which then anchors the document surf at its `localeOf`. Multi-pivot is
deferred (inert). The me-ness correction ("no the musician") is the documented
residual: warmth alone picks the talker's just-committed wrong answer, and only
embedding re-nomination overrides it.
