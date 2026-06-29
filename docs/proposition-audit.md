# The proposition channel — the DEF/claim-grain veto

> Sibling of the edge-grounding veto (`edge-grounding.md`). The edge veto translates
> the talker's prose into CON/SIG **edges** and checks each against the document
> reading. It is, by construction, **edges-only**. This channel closes the other
> half: the **DEF proposition** — a single-argument predication a person *is* — which
> makes no edge and slipped the check whole.

## The miss it closes

A deep-research answer called Freddie O'Connell "a Metro Council member." The very
sources it stood on say **Mayor** Freddie O'Connell — O'Connell became mayor in 2023;
the council seat is a former role. The answer was wrong, and nothing caught it:

- The lexical web check (`verifyAgainstWeb`) passed — "council" *does* appear in the
  corpus (in the sentence describing his **former** role).
- The edge veto never looked — "O'Connell is a council member" is one entity and a
  predicate. No second figure, no edge, nothing to grade.

The fix the engine needed, in the user's words: *a process by which every
proposition is evaluated, and those evaluations checked against the sources at the
correct cursor.* This channel is that process for DEF propositions.

## Two readings, at the correct cursor

Like the edge veto, this is a **correspondence between two readings, never a claim
against truth**: it makes the answer faithful to the sources at the cursor, not the
sources faithful to the world.

1. **Evaluate every proposition the answer asserts.** `parseProps` (the same parser
   the page is read with) reads the answer into resolved props; this channel takes
   the **DEF** ones. The answer is also parsed standalone, so a named subject the
   corpus never wrote verbatim ("Freddie O'Connell" when the sources only ever wrote
   "Mayor O'Connell") still yields its claim; a **surname `personKey`** reconciles the
   two readings to one person.

2. **Check each against the sources at the correct cursor.** The document's own DEF
   propositions are read **sentence by sentence, each at the cursor where it sits**
   (`documentOffices`). So "*as a council member, he **was** a critic*" — a past frame
   at its own line — is read as a **former** role, distinct from "*he **is** the
   mayor*" read at the line that asserts it. A claim is graded against the source
   reading that governs it, not a bag of words pooled across the corpus. Two
   witnesses are mined: copular DEF predicates, and **appositive titles carried in
   the entity label** ("Mayor Freddie O'Connell" — the title the SVO parser folds
   into the id, which would otherwise never register).

## The verdicts

Beside `corroborated` (the office is currently witnessed) and `unsupported` (no
witness):

| Verdict | Condition | Surface |
|---|---|---|
| `superseded` | the answer asserts an **exclusive office** as current, but the sources currently witness a **different** exclusive office for this person, and not the claimed one | flag-and-tell, names the current office + its citation |
| `stale` | the answer asserts an office as current, but the sources mark **that** office former and never current ("is a council member" vs "former council member") | flag-and-tell, names the role as former |

An **exclusive office** is a seat a person holds one of at a time — mayor, council
member, governor, senator, president, CEO. A transition between two of them (council
member → mayor) is exactly the supersession this catches. The one-at-a-time judgement
is consulted from the **attribute-conflict oracle** (`core/relation-types.js`
`attributesConflict`), so the conflict semantics live in the one injected place — the
same discipline `evaluateSameAs` follows. Co-occurring titles (chair, director,
founder) are recognised but **never** supersede.

## A proposition is not a fact — it is scoped, dated, sourced

"Freddie is a council member" cannot be asserted because it appears once: he is not
that forever, and he was never that in Salt Lake City. So the unit is not
`Freddie → council member` but **`Freddie [referent] · council member · in Nashville ·
current · per N sources`**, and a claim missing or mismatched on any axis is not stated
as a bare fact. The channel grounds an office claim on four things:

| Axis | How |
|---|---|
| **Identity** | The subject is resolved to its **referent** — `parseProps` reads each clause's subject through the document field (the same binding the edge veto uses), not a surface string. The surname `personKey` is only the cross-source bridge when separate admissions leave a referent unmerged. |
| **Time** | The role is read **at the cursor where it sits**, with its tense — "as a council member he *was* a critic" is former, distinct from "he *is* the mayor". A stale role asserted as current is `superseded` / `stale`. |
| **Space** | The role carries its **jurisdiction** (`readPlace`: "mayor *of Nashville*", "council member *in Salt Lake City*"). A role placed where the sources never place it is `place-mismatch`; a Salt Lake City mention can never corroborate a Nashville seat. Generic admin words (Metro, City) are not jurisdictions and cannot false-mismatch. |
| **Corroboration** | A witness is a **(source · text)** pair. Two witnesses are the same when they share a source *or* say the same thing verbatim — syndicated wire copy on three sites is one witness, not three (`meaningfulSupport`, Jaccard ≥ .7). A current role with **one** meaningful witness is `single-source` — surfaced as a hedge and the trigger to go seek a second, never laundered into a flat fact; **≥2** meaningfully-different sources is `corroborated`. |

The `single-source` set (`audit.weak`) is precisely the queue for an active evidence-seeking
loop: the propositions that have a footing but not yet a *corroborated* one.

## Flag-and-tell, never refusal

Like the edge-unsupported flag, this only ever **surfaces** — it never gates, rewrites,
or refuses the answer. The talker's words ride; the correction rides beside them ("*the
sources give O'Connell's current office as mayor [s3], not council member*"), with the
citation that grounds it. The veto is the catch; the answer is the user's to read.

## Where it lands

- `src/factcheck/propositions.js` — the holon: `auditPropositions`, `documentOffices`,
  `readOffice`, `personKey`.
- `src/turn/stages.js` (`factcheck` stage) — runs the channel beside the edge veto on
  every grounded turn; the record rides out as `ctx.propositions`. Additive: it touches
  neither the edge verdicts the veto battery reads nor the refusal gate, so the existing
  pipeline is byte-identical.
- `src/turn/pipeline.js` — the corrections ride out as non-refusing `flags`, and the
  per-proposition record on `turn.propositions`.
- `src/turn/deep-research.js` — the report carries an `audit` block.
- `src/ui/chat.js` — the correction renders inline beneath the answer.

## Honest seams

- **Scope is offices.** The channel grades the **office/title** DEF — the one with a
  one-at-a-time semantics the oracle can judge. A general DEF ("O'Connell is a critic
  of surveillance") is recorded `unsupported` but not fired: there is no exclusivity to
  supersede it. Widening to other functional biographical keys (birthplace, employer)
  is the same shape (`attributesConflict` already takes injected `functionalVias`) and
  is future work, not a silent over-claim.
- **The surname bridge is conservative and fallible.** Two distinct people sharing a
  surname would merge here. It is the cheap coref the answer path needs across separate
  admissions; the cost is a possible false reconciliation, the gain is catching the
  variant the real failure turned on.
- **The lexicon is finite.** An office outside the exclusive set is a false negative —
  honest silence, never a false catch. A false **refusal** is the one thing the channel
  must never do, so it only flags.
- **The reader product runs its own answer path.** The self-contained reader
  (`src/reader/app.dc.js` / `index.html`) composes its answers outside this pipeline and
  does not yet consume this channel; wiring it there is a parallel, separate change.
