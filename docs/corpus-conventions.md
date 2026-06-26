# Corpus conventions — the language's HOW, kept apart from the WHAT

This is the split an LLM cannot hold.

An LLM has one set of weights, and those weights fuse two things it has no way to tell
apart: **the conventions of the language** (how a relation is written, how a sentence is
shaped, which verbs name which kind of bond) and **the content of what it read** (who did
what, what is true, what happened in a particular book). When it writes, both come out of
the same place, and it cannot say which part of a sentence is form it learned and which is
fact it absorbed. That is why it confabulates: there is no line inside it to hold.

eoreader keeps the line. The corpus is where we take **tokens and conventions** from — the
HOW of writing. It is **not** what we make predictions about. Prediction is always about the
document under reading; the corpus is never folded into it. The `mind/` holon already draws
this line for retrieval (its spans carry book provenance, tagged `via:'mind'`, so a
corpus-grounded claim is always distinguishable from a document-grounded one). This draws
the same line for **generation conventions**: what we learn from the corpus is how language
is structured, written to a file as data — and not one fact from any book is stored.

## What the file is

`data/conventions/corpus-relations.json`, produced by `scripts/learn-conventions.mjs`
reading the 3400-book Gutenberg corpus. It holds only conventions:

- **`relationVerbs`** — the relation-predicate vocabulary: which verbs recur as links
  across the corpus, each with its dominant operator (CON/SIG) and the seed bucket it falls
  in when the shipped vocabulary types it (motion, perception, affect, possession, spatial,
  speech, kinship). Verbs are kept only if they are content predicates by the engine's own
  conventions (not function words, not determiners) — no invented stoplist.
- **`operationalShape`** — how sentences are operationally structured across the corpus: the
  mass on each of the nine operators (the cube's Act face). This is the structural HOW of
  prose, as a prior.
- **`learnedLinkTypes`** — verbs the structural learner promoted to a more-specific type
  because their links cohere beyond a *family-corrected* same-operator null (see below).
- **`totals` / `coverage`** — honest accounting: how many books were read, how much of each
  (front matter is skipped, long books are sampled to a bound — stated, never silent), and
  what fraction of links the shipped vocabulary could type.

The engine stays pure: it ships only its hand-seeded conventions
(`core/conventions` `SEED_RELATION_TYPES`), byte-identical. This file is the corpus-grounded
companion, as data.

## Using it as a prior (opt-in)

`corpusRelationsInherit(json)` turns the file into an `inherit` array for
`createConventions`, carried into a reading as `parseText(text, { conventionsOpts: { inherit } })`.
The effect lands in one place — the recurrence gate (`perceiver/parse/pipeline.js`): a
relation verb met only **once** in a short new document is normally held weak (×0.5
coupling) until it recurs, but a corpus-attested verb is held **firm** instead, because the
corpus already watched it bond hundreds of times. With no prior, `conventions.isRelation` is
empty there and the gate is byte-identical.

The generation effect is direct. `speakConcept(doc, { minCoupling })` lets the generator
**speak only what it holds firmly**. On a fresh scene whose relations are each glimpsed once
(`Anna saw Ben. Ben left Anna. Anna gave Maria.`):

- **without** the prior, at `minCoupling: 0.75`, the generator is **silent** — nothing is
  held firmly enough to say;
- **with** the prior, the same verbs are firm, so the whole scene is spoken.

The corpus changed *what the self can confidently say*, and gave it no content to say it
with — it never said "Anna saw Ben", only that "saw" is a relation worth holding. The
conjecture and the commit stay the self's (the enactor gate); the corpus is only the HOW it
brings to the page.

## The finding the corpus made plain

Two numbers carry the whole result.

1. **Most relation verbs are untyped.** Only a small fraction of corpus relation-links fall
   into the shipped semantic buckets; the rest (`made`, `know`, `seemed`, `found`, `got`,
   `began`, `knew`…) recur constantly and have no type. These are the verbs that *do the
   work of prose* and that the hand-seeded taxonomy does not reach.

2. **Structure alone cannot type them.** The learner (`surfer/learn-links.js`) gives each
   recurring untyped verb a candidate more-specific type and asks whether its links cohere
   in structural feature space — operator, coupling, target kind, polarity, operational
   context, but **never the verb itself** — beyond a same-operator null. Corrected for the
   thousands of verbs tested at once (the null's family-wise `N`, the engine's own
   multiple-comparison discipline), **almost nothing is promoted.** The verbs that survive
   are the structurally rigid ones (`seemed`, a copula taking adjective complements), not
   the semantic ones.

That is the empirical case for the split, and against the distributional bet. The meaning of
`gave` versus `took` versus `made` is not recoverable from the structure of their bonds; it
is a convention the corpus *names* but does not *contain* as separable form. To type it, the
engine needs the semantic push (the seed vocabulary, or VOX) — exactly what the structural
basis was built to keep at arm's length. The corpus gives us the vocabulary and the shape of
how to write; it does not give us the meanings, and it was never supposed to.

## Regenerating

```
node scripts/learn-conventions.mjs                      # whole corpus → data/conventions/corpus-relations.json
node scripts/learn-conventions.mjs --groups 2           # a quick 400-book sample
node scripts/learn-conventions.mjs --chars 20000 --top 600   # read more per book, keep more verbs
```

Requires the `hyparquet` / `hyparquet-compressors` dev dependencies (the same ones `mind/`
uses to read the parquet in place over range requests).
