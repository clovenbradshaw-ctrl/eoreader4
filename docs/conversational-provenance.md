# Conversational provenance — the talker as the weakest reader

> Follow-up to the phasepost spec, extending §6 (Readers and the fold). The
> talker's output is not barred from the fold. It enters as a different kind of
> event with a different witness, and the witness fixes how far it can travel.

The talker can serve as prior-conversation context and it can strengthen the
field. It can **never** be cited as document provenance, **never** originate a
committed reading on its own, and **never** author a typed relation. This wires
the model-facing doors as *depositions*, never as *injections*.

## The event (`src/converse/`)

`conversationalEvent({ text, cursor, turn, referents })` records that the talker
said this, at this cursor, in this turn — verbatim, append-only, witnessed by
the **talker**, not the page. It is a provenance distinction, not a content one:
"X is in the USA" witnessed by a span is a grounded claim; the identical string
witnessed by the talker's own prior turn is a record that the talker once said
it. Two events, two addresses. The second can never be promoted to the first.

The event carries the referents it mentions — never an operator. The talker's
mention says *look here*; the measuring readers say *what is here*.

## Two channels in the field (`src/parse/coref.js`)

The activation field is provenance-aware. Each referent tracks two channels:

| Channel | Deposited by | Coupling | Use |
|---|---|---|---|
| grounded | span-witnessed sightings (`note`) | up to 1.0 | the witness that can clear the commit floor |
| conversational | talker-witnessed mentions (`noteConversational`) | ≤ 0.6 (the model reader's cap) | warmth and salience, never floor-clearing alone |

- `field(cursor)` → total mass (grounded + conversational), each candidate
  tagged with its channel split. The warmth used for ranking and pronoun
  resolution — the talker can warm the room.
- `fieldGrounded(cursor)` → grounded mass only. **Invariant under conversational
  deposits** — talker warmth cannot move this number. This is the read the fold
  uses for the subtract-and-check.

Both channels decay with cursor distance (conversational at least as fast). Only
the tag and the coupling differ.

## The three constraints (every weak reader obeys these)

1. **Tip, never originate.** Talker mass can lift a perception other readers
   already weakly support across the floor; it cannot originate a committed
   reading alone. A relation whose only witness is that the talker said it twice
   stays *held*, not laid.
2. **Decay and stay tagged.** Talker mass carries its provenance into the field,
   so the fold can always ask how much of a referent's warmth is span-grounded
   and how much is conversational echo, and discount the echo. This is the
   protection over a long conversation — without it the field would slowly fill
   with the reader's own echoes and the reading would drift toward what the
   talker kept saying. The tag is what prevents a system talking itself into a
   belief.
3. **Never type the relation.** Talker mass can make two referents warm
   together, raising the prior that some bond exists; it cannot supply the
   operator of that bond. The phasepost stays a measurement against the cells by
   the geometric reader, never read off what the talker chose to say.

## The witness-type firewall

The firewall that keeps a talker turn out of citations is the **witness type**,
not a rule the assembler remembers. The binder (`ground/bind.js`) cites only
span-witnessed evidence; a talker event has the talker as its witness, so it is
*structurally* uncitable as document provenance — `isCitableAsDocument(event)`
is false for it, by witness alone. There is no separate guard and no flag to
check; the talker cannot be cited for the same reason the geometric reader's
nearness cannot be cited — the witness is wrong for citation.

## The doors, redrawn as depositions (§6)

Two model-facing doors were defined and left inert, each flagged in its own
source as awaiting this path:

- `coref.js#reinforce` (the model-nudges-the-field door) now routes to
  `noteConversational`: a talker mention deposits capped, tagged conversational
  mass. It never writes grounded mass.
- `reading.js#expect` (the model-adds-to-the-prior door) now enters as capped,
  tagged conversational prior, surfaced as `conversationalPrior` on the reading
  so it stays separable. It warms the prediction of who acts next; it cannot
  manufacture surprise past the cap.

In both cases the model writes an event and the field reads it. The model never
reaches into the field and sets a number — the witness-does-not-decide rule
holding at the field, the same way it holds at the graph.

## The fold-time invariant — subtract-and-check

`commitSurvives(field, id, cursor, floor)` (and `field.survivesSubtraction`)
recompute the reading with talker mass subtracted, using `fieldGrounded()`, and
check whether it survives. If a committed reading near the floor stands on
grounded mass alone, the talker mass was warmth and nothing more. If it depends
on talker mass to clear the floor, the conversation has talked itself into
something — refuse it, demote to *held*. The check is cheap because the channels
are already separate; run it at commit time on any reading near the floor.

## The decisive echo test

`tests/converse.test.js` includes it: repeat a false relation across several
talker turns and confirm (1) it never crosses the floor on talker mass alone,
and (2) the document reading survives subtraction of the talker mass unchanged.
If either fails, the coupling is too high or the tag is not being read at commit
time. This is the same shape as the empty-cell discipline: keep the channel
separable and prove the reading does not lean on it.

## Honest seams / what is next

The mechanism is built and tested at the holon boundary. The remaining
integration:

- **Live wiring** — in the turn pipeline, record each talker turn as a
  `conversationalEvent` and `depositConversational` its referents into a
  session-scoped field, so the warmth is real across a conversation. The
  mechanism is ready; this is the plumbing into `runTurn`.
- **Audit display** — show the grounded-vs-conversational split per referent so
  a human can watch echo accumulate (the human reader's subtract-and-check).
- **Tuning** — the coupling (≤ 0.6) and decay are values to set against the echo
  test, not constants of the design.
