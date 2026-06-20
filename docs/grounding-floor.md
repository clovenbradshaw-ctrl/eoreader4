# The grounding floor: the talker's vow, made operational

The floor is the fourth and last gate between a question and a surfaced answer.
It sits *after* the talker has spoken, before the word is shown: the engine reads
its own output against what it holds and acts on the reading. It is the
`bind → factcheck → revise → veto` tail of the turn, over `src/ground/veto.js`,
`src/turn/stages.js`, `src/turn/pipeline.js`.

The floor is the **wave fold turned reflexive** (surfing-the-fold.md): the same
collapse over an activation field the engine already runs on the document, aimed
now at the engine's reading of its own output.

| the fold's property | the floor's commitment |
|---|---|
| the substrate is **retained**, re-formable | **suppress, never erase**: the superseded word survives beside its decline (`revisions`) |
| collapse is **operator-aware**, grain-selective | the verdict is an **EVA, not a SIG**: an evaluation against a frame, not an identity that holds |
| collapse is **amplitude-weighted** (Born rule) | **action is proportional to amplitude**: substitute at the limit, flag in the middle, nothing below |
| the order is **append-only** | **no ground, total record**: the self-verdict orients the next turn, never hardens into fact |

## The vow

The keepable vow is narrow: **the talker may never surface a word that stands in
no faithful relation to what the engine holds, and may never edit what it holds
to make a past word true.** Truthfulness, not infallibility. What the engine
holds is the append-only record of evaluations (the log of EVAs), not a store of
beliefs that could be overwritten before a monitor sees the gap.

## The verdict is an evaluation (EVA), not an identity (SIG)

"This is ungrounded" is not an identity of the output; it is the engine
**evaluating** its output against the frame of the grounded reading. The
gate-versus-flag cut is not certain-versus-fallible — there is no certain member.
Every veto is one operator firing across a field at different amplitudes:

- `empty` / `declined` / `echo` are EVAs **at the high-amplitude limit** — no
  noise model makes an empty string an answer, so the reading overwhelms every
  null. The limit case of the same reading, not a separate "structural" category.
- `unbound` over a lexical binder is an EVA at **low, noisy amplitude**.

One rule: evaluate the output against the record, REC the evaluation, and act
**in proportion to how far the reading beats the null** — substitution only at the
overwhelming limit, a flag in the noisy middle, nothing when it does not clear.

## Graded naming

A verdict earns the name it reaches: **EVA** always; **amplitude** wherever there
is a real magnitude; **null-relative** wherever there is a real background to beat;
**Born rule** only where there is a real quantile (voidnull's extreme-value
calculation against a measured background with α). The binder's score is an
idf-weighted overlap fraction — named as that, not a Born-rule amplitude, until
the meaning reader gives it a real distribution. The void gate has earned
Born-rule language; the binder has not yet.

## The contradiction's evaluation: grounded denial must clear its null — *done*

A contradiction is the assertive dual of a void: grounded *denial*, the
libel-grade verdict, where a false positive calls the talker a liar. Two paths:

- **Symbolic** (disjoint-axiom; `relation-types.js`). Amplitude is
  `relationPrior(noun) * relationPrior(via)`, the joint typing prior — exact and
  embedder-free, no instance distribution to beat. The honest amplitude of an
  exact rule *is* its reliability prior. It does not reach Born-rule naming and
  does not claim it. **Unchanged.**
- **Geometric** (void-denial; `correspond.js` `voidDenial`). Now attaches a
  `confidence` equal to the margin by which the denial's cell assignments **beat
  the derived null** — `deriveNull` over the cell-assignment margins of the
  document's *non-denying* relations (the chosen background population). The
  amplitude is `min(void-margin, talker-margin)` (the weakest link); the null is
  the (1-α) extreme-value bound; the confidence is centred on that bound so the
  threshold maps to the refusal floor exactly (at the null → 0.5, above →
  refuses, below → degrades to `edge-contradicted-weak`). When the null is
  unmeasurable (a thin document), the denial cannot be certified at all and
  degrades to a flag — the geometric path no longer defaults to certainty. **This
  path earns Born-rule language: it computes a real quantile.**

## The self-fold: read the past with its verdicts — *done*

The session fold feeds the conversation back. The **self-model-defended** failure
was the talker reading its prior outputs back as authoritative `Me:` lines and
anchoring on them. The fix is not to withhold the history (protect-by-absence)
but to re-enter it as a **judged assertion**: the prior turn welded to its EVA.

The completed turn's verdicts (`flags`) are threaded into the history record
(`{ role, content, flags }`, `ui/app.js`), carried through `foldConversation`,
and rendered inline in the `Me:` line (`Me: [read as unbound] …`,
`converse/history.js`) — in **both** read paths, the recent verbatim window and
the surfed recap. There is no read path that surfaces "I said X" without its
evaluation in the same unit. A judged turn carries its verdict into the
mover-selection surprise, so it cannot be folded silently away. This is the same
firewall as the gate's self-verdict: an evaluation of self orients, never grounds.

## Suppress, never erase

A substitution is not a deletion. The talker said the word; that is an event, and
the log is append-only. The floor supersedes the word's *status as the answer*,
never the fact that it was said. The superseded draft is recorded **beside** its
decline in `revisions` (`{ draft, refusedBy, replacedBy }`, `stages.js`).

## The sentinels

| obligation | the case it pins | test |
|---|---|---|
| the limit substitutes | an output with no lexical contact (and `empty`/`echo`/`declined`) substitutes the shown answer | `tests/gate.test.js` |
| the faint reading does not | a contact-but-uncitable output rides, flagged | `tests/gate.test.js` |
| the draft survives | the superseded draft is present in `revisions` | `tests/gate.test.js` |
| fluency is not an argument | terse and eloquent ungrounded drafts gate identically | `tests/gate.test.js` |
| denial clears its null | a geometric denial that beats the derived null refuses; one that does not degrades to a flag; the symbolic path unchanged | `tests/factcheck.test.js` |
| the self-fold carries its verdict | every `Me:` read path renders the prior reply welded to its EVA | `tests/history.test.js` |

## Where it lives

| concern | file |
|---|---|
| the veto battery | `src/ground/veto.js` |
| the groundedness amplitude (binding score) | `src/ground/bind.js` |
| substitution + draft preservation | `src/turn/stages.js`, `src/turn/pipeline.js` |
| the contradiction evaluation + its null | `src/factcheck/correspond.js`, `src/read/relation-types.js`, `src/read/voidnull.js` |
| the self-fold | `src/converse/history.js`, `src/converse/provenance.js`, `src/ui/app.js` |

## Honest seams

- The re-typing is committed; the code is mid-migration. The veto battery still
  treats `empty`/`echo` as a `gates` category and the binder still binarises at
  `MIN_OVERLAP`. The target is one amplitude reading with the limit cases falling
  out of it. The current discretisation is the first honest step.
- The binder's amplitude is an overlap fraction, not a quantile, and is named as
  one. It earns no Born-rule claim until the meaning reader gives it a real
  distribution.
