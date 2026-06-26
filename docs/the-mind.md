# The mind — a read corpus, held as memory and pointed at its source

> The document is what eoreader is *reading*. The mind is what it has *read*.
> The two are kept epistemically apart on purpose.

eoreader grounds its answers in a document you give it. The **mind** is a
second, optional ground: a large corpus (the ~3,400-book English Project
Gutenberg set, a 608 MB parquet) that the reader has already read and can
consult — separate from, and never mixed into, the document under discussion.

Because inference is local, an answer that leans on the mind is fully
accountable: every span it draws on is a real sentence in a named book, with a
URI back to the source. There is no opaque weight to trust — only memories that
point at where they came from.

## Three commitments

**It fires precisely the same as the reader always does.** The mind is not a
new retrieval mechanism. A query is tokenised by the same `tok`, scored by the
same `hits / qLen` with the same fuzzy term seam as `retrieve/lexical.js`. The
only difference is *where* the score is computed: the live reader scans an
in-memory `tokensBySentence`; the mind, which cannot hold 1.5 GB of text in a
tab, computes the identical number from an inverted index. The equivalence is
asserted directly — `tests/mind.test.js` builds a corpus both ways and checks
the per-sentence scores match to 1e-9.

**No LLM embeddings.** Embedding ~1.5 GB of text in a browser would take hours
and cache poorly. The reader's hot path is already lexical and deterministic,
which is exactly what makes the mind's provenance exact. The semantic channel
simply stays cold over the mind (the retrieval code already degrades to
lexical-only when MiniLM isn't warm). Structural (Level-2) and significance
(Level-3) readings stay **document-only** — the mind keeps only the Level-1
memory, which is the honest state.

**Memories, not books.** The mind never stores a copy of the corpus. What it
persists is the inverted index (which sentence holds which token) and a book
table mapping each text to its source URI. A cited span is **materialised on
demand**: fetch the book from its source, re-segment it (segmentation is pure,
so sentence indices are stable), slice out the line. This mirrors the repo's
core tenet — *the source is truth; everything you see is a projection of it* —
and shrinks the on-disk footprint to the irreducible memory.

## How it is built

The corpus is read **once** and cached. The first load streams the parquet a
row group at a time (hyparquet + hyparquet-compressors, loaded from a CDN the
way `model/embed.js` loads transformers.js), segments and tokenises each book,
and flushes that group's postings to the Origin Private File System. The
manifest carries a group cursor, so an interrupted load **resumes** at the
first group it had not yet flushed — the survives-interruption property a holon
owes (`docs/architecture.md`). Every later load hydrates from OPFS with no
network and no reparse, the same once-per-profile pattern as the model cache
(`docs/large-models.md`).

A build is not cheap — ~200 books is ~2 M sentences. The progress is reported
honestly (group, book and sentence counts), never a spinner that hides the
cost.

### Preparsing instead

If you would rather not read 1.5 GB in a browser, build the index offline and
host it:

```sh
npm i -D hyparquet hyparquet-compressors
node scripts/preparse-corpus.mjs            # → ./mind-index (the exact OPFS layout)
node scripts/preparse-corpus.mjs <url> <outDir> --buckets 64 --groups 2   # partial smoke test
```

The output directory is byte-for-byte the OPFS layout (`manifest.json`,
`vocab.json`, `idx/g*/b*.json`), so it can be hosted and hydrated into a tab's
OPFS rather than built there.

## The holon

`src/mind/` is a holon — a single `index.js`, its own test, swappable parts:

| File | Role |
|------|------|
| `store.js` | The backend-agnostic memory store (postings + book→URI table). In-memory backend for tests, OPFS backend for the browser. No raw text. |
| `parquet.js` | The corpus as a book source — streams row groups over range requests; resolves one book's text on demand. Decoder injectable. |
| `build.js` | The one-pass, resumable build: stream → segment → tokenise → flush shards. Reuses the reader's own `segmentSentences`/`tok`. |
| `retrieve.js` | The reading against the index — reproduces `retrieve/lexical.js` exactly, materialises the top-k spans with provenance. |
| `index.js` | The holon surface: `createMind({ url }).status() / build(onProgress) / retrieve(query, k)`. |

## What is not done yet

The engine is built, tested, and verified against the real corpus. How the mind
**surfaces in an answer** is the open design choice: shown as a distinct "from
the mind" evidence block beside the document-grounded answer, versus folded into
the model's grounded prompt as labelled background context. Both keep the
epistemic separation; they differ in UX and in how far they touch the
golden-parse-sensitive turn pipeline. That wiring is intentionally left for a
focused pass.
