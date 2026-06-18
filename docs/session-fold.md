# The session-register fold — feeding the conversation back

> The prompt contract always had conversation slots; nothing populated them, so
> the talker answered every turn cold. This fills them. The document fold reads
> the page; the session fold reads the **conversation**, and hands the talker the
> same two registers it gets for the document — the recent turns **verbatim**, and
> a **surfed fold** of everything older. This is `foldConversation` in the
> `converse` holon and the `converse` turn stage.

## Two registers, mirroring the document

| register | is | carries |
|---|---|---|
| recent verbatim window | the newest turns, word-for-word, within a token budget | exact wording — the activated past |
| surfed fold | a significance-selected recap of older turns | the gist, so the session stays oriented without replaying every word into a small model's window |

A `minRecent` floor guarantees continuity even when one huge turn would overflow
the budget. The fold engages only **beyond the token count** — short sessions ride
entirely verbatim.

## The fold is surfed, not truncated

eoreader3 condensed every old turn uniformly. Here the older turns run through the
same cursor axis the document surfer rides: per-turn surprise as divergence from
the γ-decayed prior of the turns before it. Only the turns where the conversation
**moved** are kept — a new topic, a question, a turn in the thread. A turn that
merely confirmed or acknowledged is assimilated and folded away. Kept turns are
condensed and tagged with their **absolute index** (`#7 You: …`), so an exact
earlier wording can still be recalled mechanically by index.

## Per-turn surprise, and the seam

| reader | surprise is |
|---|---|
| MiniLM (`measuresMeaning`) | cosine distance of the turn from the γ-decayed prior direction — meaning-distance (the `buildMeaningRead` shape, over turns) |
| hash organ (fallback) | **content added** — the count of new non-stopword tokens against the decaying vocabulary |

The fallback measures content *added*, not novelty *fraction*, for a reason worth
recording: fraction is the TV-snow trap at the token level. A one-word "ok" is
100% novel yet adds nothing — measured by fraction it reads as a mover and crowds
out real answers. Counting new content tokens ranks a substantive question far
above an acknowledgment. Spelling not meaning; under MiniLM the same selection runs
on meaning, with no shape change.

## Selecting the movers: a bimodal mean

A conversation's per-turn surprise is **bimodal** — inert turns (acks,
confirmations) near zero, movers (topics, questions, turns) high. The separator is
the **mean** content-add: keep turns above it. (The loop's `calibrateReader`
median — right for a strain band — lands *on* the movers in a bimodal
distribution and drops them; the mean splits the two clusters cleanly.) A
single-peak fallback guards the all-flat case; a `maxNoteTurns` cap keeps a long
backlog from blowing the notes budget, the strongest movers winning the slots.

## The two prompt paths

```
foldConversation(history) → { recentMessages, pastTurns, notes, lastReply, stats }
```

- **grounded** — `pastTurns` (the verbatim window, formatted) rides as a text block
  and `notes` (the surfed recap) as another, both inside the single user turn that
  keeps the prefix cache stable.
- **chat** (no doc) — `recentMessages` ride as real `{role,content}` message
  history; `notes` folds into the system message. A chat model wants turns as
  turns.

The `converse` stage sits in the pipeline right after `route`:

```
route → converse → retrieve → fold → prompt → llm → bind → veto → settle
```

It runs for both grounded and chat turns and is independent of the document. The
mechanical short-circuits (smalltalk, math) terminate at `route` and never reach
it — they need no history. The UI keeps the running transcript (`STATE.history`)
and feeds it back each turn; the audit records `converse`: how many turns verbatim,
how many folded, the recap length.

## The open seam

The recap surfs on content/meaning novelty over **whole turns** — the turn-level
analogue of the document reader's figure-shift. It does not yet thread the
*document figures* a turn activated into the same warmth field the document reader
maintains. The plumbing for that exists (`depositConversational`, the
conversational channel in `parse/coref.js`, conversational-provenance.md): warming
the document prior from what the conversation keeps returning to, the talker as the
weakest reader in the room. Wiring it would let the conversation and document folds
share one activation field rather than run in parallel. Left separate for now.

## Where it lives

| concern | file |
|---|---|
| the fold | `src/converse/history.js` (`foldConversation`) |
| the turn stage | `src/turn/stages.js` (`converse`) |
| the two prompt builders | `src/model/prompt.js` |
| the running transcript | `src/ui/app.js` (`STATE.history`) |
| tests | `tests/history.test.js` |
