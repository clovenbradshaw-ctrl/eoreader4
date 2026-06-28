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

## Result

| Document | Engine-hybrid |
|---|---|
| *Metamorphosis* | **3/3**, first "I" recovered |
| Classic `CHAPTER` | 3/3 |
| Descriptive titles | sections emerge, snapped to the title lines |
| Non-English | **3/3** (keyword list + the field) |
| Essay traps (`42`, dateline, `MIX`) | **0** — nothing survives the run + persistence tests |
| Flat essay, no entities | 0 (correct — it has no sections) |

It is still a *guess*: emergent detection on heading-less books is approximate, and a book
with idiosyncratic formatting can still fool it. But it degrades honestly — it finds real
structure the regex couldn't, and it stops inventing structure that isn't there.

## The same boundaries move the cursor

Every section anchor (`id="eo-ch-N"`) is a structural stop for the reading cursor. The
reader's ⏮/⏭ controls (`jumpSection`) step from the section you're in to the previous/next
one, and the Contents menu jumps to any of them — so the cursor moves by *structural unit*,
not by scroll distance. This is the UI face of the engine's projection cursor: the structure
the reading discovered is the structure you navigate.
