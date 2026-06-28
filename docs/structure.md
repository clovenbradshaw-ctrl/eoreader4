# Document structure — a best guess, read by the engine

The reader's table of contents and the section-to-section cursor jumps are not a
hand-list of "Chapter" matches. They are a **guess at structure** the engine makes from
its own reading, the same way the music/vision probes let categories *emerge* from the
signal rather than being told them. The implementation is `detectStructure(p, paras)` in
[`src/reader/app.dc.js`](../src/reader/app.dc.js).

## Why a regex TOC is not enough

A pure heading match (`/^chapter\b/i`, bare numerals, all-caps lines) was the first cut.
Tested across document types it failed in both directions:

| Document | Heading-regex only |
|---|---|
| *Metamorphosis* (real PG, parts I·II·III) | 2/3 — missed the first "I" |
| Classic `CHAPTER I/II/III` | 3/3 ✓ |
| Descriptive titles ("The Boy Who Lived") | **0** — no keyword to match |
| Non-English (`Chapitre`, `Capítulo`, `Kapitel`) | **0** |
| Essay with a stray `42`, a dateline, a `MIX` line | **4 false headings** |

Body prose is multilingual, titles often carry no keyword, and a lone numeral is as likely
to be a page number as a chapter. Matching strings can't tell these apart.

## Two signals, arbitrated

`detectStructure` combines a weak lexical prior with the engine's own reading:

1. **Heading candidates** — explicit markers, roman/arabic numerals, all-caps lines — are
   only *kept* when they're a keyword (`Chapter`/`Part`/…, in several languages) **or** part
   of a **consecutive run** (`I, II, III…` / `1, 2, 3…`). The run test does two jobs at once:
   it **recovers** a member the formatting hid (the missing "I" in *Metamorphosis* is
   restored because "II" and "III" demand a predecessor), and it **rejects** strays — `42`,
   `MIX`, `LONDON, 1893` belong to no run, so they're dropped.

2. **The entity field** — `_paraField` reuses the master projection (no re-parse) to get the
   set of entities the engine projects for each paragraph. A real section boundary is where
   that field **shifts** and the new field **persists** across a window of paragraphs. This
   is the engine's Level-1 set-overlap, the same overlap it runs over the words of a
   sentence — here run over the entities of a region. A one-paragraph blip (a `42` between
   two prose paragraphs about the same thing) can't fake a boundary because the windows on
   both sides still match; and a region needs real entity mass (≥2 distinct entities) before
   a shift is allowed to mean anything, so a flat essay with no named entities yields nothing.

When a validated heading run exists it wins (it's the author's own structure). Otherwise
**sections emerge** from the field shifts, snapped onto the title line that introduces each
one, or labelled by the entity that enters there. Emergent sections are drawn in italic with
an accent rule — the reader can see these were *inferred*, not printed.

## Candidate conventions

`_headCandidate` recognizes, in order: **markdown** ATX headings (`#`…`######`, level = depth);
**decimal** section numbers (`1.2`, `3.3.2`, level = depth); a **keyword** at the line start,
or after a short capitalized prefix and ending at the numeral (`Inferno: Canto I`) — anchored
so it can't swallow caption lines like "Heading to Chapter I. 1"; bare **roman/arabic**
numerals; and short **all-caps** lines. Keyword / markdown / decimal markers are kept outright
(they carry a nesting level); bare numerals only when they form a consecutive run.

## Stress battery — real fetched documents

Run against real sources (`scripts`/offline harness over the live engine):

| Source | Result | Verdict |
|---|---|---|
| *Pride & Prejudice* (PG 1342) | Preface + Chapter I–LXI (62) | ✓ chapters; front-matter caption list rejected |
| *Dracula* (PG 345, epistolary) | CHAPTER I–XXVII (27) | ✓ journals/letters don't fragment it |
| *Divine Comedy* (PG 1004) | ~100 cantos (`Inferno: Canto I…`) | ✓ prefixed keyword + reset numbering |
| *the-art-of-command-line* (Markdown) | 16, nested `#`/`##`/`###` | ✓ markup headings, code fences ignored |
| arXiv HTML paper | top-level §1–5 | ✓ top level; subsection nesting partial |
| RFC 2616 (deep decimal) | decimal tree `1.1`/`3.2.1`… | ✓ structure + levels; **ToC lines duplicate** |
| *Devil's Dictionary* (flat A–Z) | **0** (flat) | ✓ refused to hallucinate |
| *Spoon River* / short-story coll. | **0** (flat) | ⚠︎ suppressed — see below |
| Essay traps (`42`, dateline, `MIX`) | **0** | ✓ |

The **contrast guard** is why the flat cases return nothing: when almost every paragraph gap
is a field shift, there is no stable background for a boundary to stand against, so no
structure is asserted (the repo's null-boundary idea — *if everything is a boundary, nothing
is*). Better an empty TOC than a hallucinated one.

## Known limits (honest)

- **Flat collections** (a dictionary, a poem/epitaph anthology, a dialogue-heavy story
  collection) are suppressed to **0** rather than risk noise — so a real per-entry structure
  is lost. The conservative call; recovering these cleanly needs a title-line model.
- **Nesting is shallow.** Markdown and decimal carry real levels; everything else is flat.
  Drama Act→Scene and scripture Book:Chapter:Verse are not modelled as a hierarchy.
- **A literal Table of Contents** (RFC 2616) duplicates the body headings — ToC lines and the
  real sections both match, so each appears twice.
- **HTML/PDF** depend on the text-extraction step; semantic `<h2>` tags are flattened to text
  lines (the detector reads the *prose*, not the markup), and two-column PDF reading-order is
  not addressed here.

It remains a *best guess*: it finds real structure a regex can't (untitled, multilingual,
markdown, decimal), and it refuses to invent structure that isn't there — but odd formatting
can still fool it.

## The same boundaries move the cursor

Every section anchor (`id="eo-ch-N"`) is a structural stop for the reading cursor. The
reader's ⏮/⏭ controls (`jumpSection`) step from the section you're in to the previous/next
one, and the Contents menu jumps to any of them — so the cursor moves by *structural unit*,
not by scroll distance. This is the UI face of the engine's projection cursor: the structure
the reading discovered is the structure you navigate.
