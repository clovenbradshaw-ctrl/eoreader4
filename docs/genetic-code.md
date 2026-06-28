# The genetic code, read by the same engine that reads a novel

> `src/organs/in/codon.js` · `scripts/dna-code.mjs` · `tests/codon.test.js`
> Run it: `npm run dna`

The frequency probe (`docs/`, `scripts/emerge-notes.mjs`) handed the engine bare
Hz and let *octave equivalence* emerge from shared overtones — no scale, no `mod
12`, no ratio table. This probe goes one modality lower, onto the genetic code, and
asks the same question: **how far does the spine reach?**

## What the reader is given, and what it is not

The codon adapter (`ingestCodons`) is handed a list of codons — bare triplets over
a four-letter alphabet, `UUU CUU AUU …`. That is all. It is **not** told:

- the codon table (which codon means which amino acid),
- that any two codons are synonymous,
- that the third base is the redundant ("wobble") one,
- or even that amino acids exist.

The one structural fact used is not biology — it is what a codon physically *is*: a
sequence **read in order**, 5'→3'. So a codon's tokens are its **prefixes** — the
first base, the first two, the whole triplet — exactly the way a tone's tokens were
its overtones nesting on the fundamental. The first base is in every prefix and so
weighs most; the third base is in one prefix only and so weighs least. That is not a
prior about genetics; it is just reading order, the same left-to-right the engine
reads a sentence in.

Two codons' relatedness is then nothing but **shared prefixes**, scored by the
engine's own Level-1 existence reading — `hits / qLen` over token sets
(`retrieve/lexical.js`), the identical operation it runs over the words of a
sentence. "The same family" is found the same way "the same note" was: mutual
nearest neighbour + the engine's union-find (`SYN`), by rank alone, no threshold.

## What emerges

The 64 codons collapse from 64 entities to **16** — and every one of the 16 families
is exactly one *first-two-base box* of the standard codon table:

```
UU_ {UUU UUC UUA UUG} → Phe×2 Leu×2     UC_ {UCU UCC UCA UCG} → Ser×4
CU_ {CUU CUC CUA CUG} → Leu×4           CC_ {CCU CCC CCA CCG} → Pro×4
AU_ {AUU AUC AUA AUG} → Ile×3 Met×1     AC_ {ACU ACC ACA ACG} → Thr×4
GU_ {GUU GUC GUA GUG} → Val×4           GC_ {GCU GCC GCA GCG} → Ala×4
UA_ {UAU UAC UAA UAG} → Tyr×2 Stop×2    UG_ {UGU UGC UGA UGG} → Cys×2 Stop Trp
CA_ {CAU CAC CAA CAG} → His×2 Gln×2     CG_ {CGU CGC CGA CGG} → Arg×4
AA_ {AAU AAC AAA AAG} → Asn×2 Lys×2     AG_ {AGU AGC AGA AGG} → Ser×2 Arg×2
GA_ {GAU GAC GAA GAG} → Asp×2 Glu×2     GG_ {GGU GGC GGA GGG} → Gly×4
```

The reader recovered the genetic code's 4×4 block structure with no table in sight.
Eight of the sixteen boxes are a **single amino acid** (the four-fold degenerate
families — Leu, Val, Ser, Pro, Thr, Ala, Arg, Gly). The other eight split two-and-two
on the third base — and **the reader never drew that distinction**, because in a
prefix reading the third base is the weakest signal. That is the wobble position
(Crick, 1966): the place the code is redundant is exactly the place the engine treats
as not-distinguishing — the same shape as "the octave collapsed but the fifth did
not." The category is the output of the grouping, never its input.

## Falsified against, not just demonstrated

Like every modality probe here, the claim is checked against its controls
(`scripts/dna-code.mjs`, Part B):

- **Reading order is the mechanism.** Read a codon as an unordered *bag* of
  position-tagged bases instead of nested prefixes and the structure dissolves: every
  codon sharing any two of three positions becomes mutually near to a chain of
  others, the union-find runs away, and all 64 fuse into **one blob**. The block
  structure is a property of reading the triplet in order — and the failure mode is
  honest (one meaningless lump, never hallucinated families).

- **The real code is special.** The 16 boxes themselves are a fact of prefix-nesting
  over a four-letter triplet — they appear for *any* assignment of amino acids. What
  is not generic is that the real code's redundancy *lines up* with those boxes: 8 of
  16 are a single amino acid. Shuffle the amino-acid labels across the codons (a
  random code with the same amino-acid counts) and chance manages a mean of **0.00**
  pure boxes, best of 1, over 5000 trials — it never reaches 8. The engine's emergent
  boxes coincide with amino-acid identity far beyond chance: the genetic code is
  organised so the redundancy the reader finds is *functional*.

## Why it matters for the spine

Nothing in `codon.js` is new machinery. It is the same `createLog` → `projectGraph`
spine, the same `retrieveLexical` existence reading, the same `discoverEquivalences`
mutual-nearest `SYN` merge that the frequency and text organs use. A new modality is
a new adapter, not a new spine — and the spine reaches all the way down to the
chemistry of heredity.
