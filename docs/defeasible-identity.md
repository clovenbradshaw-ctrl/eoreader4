# Defeasible identity — the mr/mrs-samsa fix

> The fact-checker makes the talker faithful to the graph, never the graph
> faithful to the world (`edge-grounding.md` §10). So the graph had better be
> faithful to the *document*. This is one of the upstream guarantors of that:
> identity merges that can be **overturned**, not ossified.

## The failure

A name-containment merge folds a single-token name into a full name it sits
inside: `Gregor` ⊂ `Gregor Samsa`. The old rule fired on the **head or the
tail** of the full name, eagerly and permanently. On the real text that
collapses a whole family:

```
Gregor Samsa → gregor-samsa
Samsa        → gregor-samsa     (tail match on the surname)
Mr Samsa     → gregor-samsa     (transitively, through bare "Samsa")
Mrs Samsa    → gregor-samsa
                                 → one referent where there are four
```

The father, the mother, the son, and the bare surname become a single node.
Every later reading inherits the lie: a father→son relation is now a self-loop,
and the edge-grounding fact-check — resolving a talker claim's endpoints through
this graph — adjudicates against garbage.

## The reading: a surname is not a given name

Containment is not one thing. The warrant splits:

- **Head match** — the token is the **given name** (the first word):
  `Gregor` ⊂ `Gregor Samsa`. A given name individuates. This is the
  high-confidence join; the id is unified at admission, exactly as before.
- **Tail match** — the token is the **surname** (the last word):
  `Samsa` ⊂ `Gregor Samsa`. A surname is **shared across a family**, so the
  join is thin. It carries the Pollock **rebutter** *"a distinct agent bears
  this surname,"* and is committed **defeasibly**.

`src/parse/entities.js#aliasOf` returns the match `kind`; the surname match keeps
its own id at admission, so the thin merge can be defeated without rewriting the
admission.

## The defeat: append, never rewind

The tail merge is a **real** merge (`SYN kind:'merge'` — the projection unions
it), so a single-Samsa document still folds (`Samsa` *is* Gregor when there is
only one). But it is held with warrant. After the read, a reconciliation in
`src/parse/pipeline.js` fires the rebutter: a surname borne by **≥2 distinct
multi-word names** is non-individuating — a family, not an individual — so every
thin merge on it is overturned.

Defeat does not rewind. A `SEG kind:'retract'` is **appended** to supersede the
`SYN` (the projection drops it through the same union-find), and a write-time
`EVA` records the contradiction. The log is the trail:

```
SYN  merge  samsa → gregor-samsa   match:tail  defeasible  rebutter:distinct-agent-shares-surname
EVA  merge  ref:SYN  verdict:indeterminate     reason:surname-containment-thin
…
SEG  retract refSeq:SYN            reason:surname-shared-by-distinct-agents
EVA  merge  ref:SYN  verdict:contradicted      reason:distinct-agent-shares-surname
```

Replay to before the `SEG` and the family is still merged; replay past it and it
has come apart — the surname proving shared is the event that breaks the merge,
the way the father acting alone should always have.

## EVA at write time

Ingestion is where most identities are committed, and EVA used to fire **zero
times** there — merges were asserted, never evaluated. Now every merge carries
its write-time evaluation as it is committed:

| Merge | Verdict | Meaning |
|---|---|---|
| given-name containment (`Gregor` ⊂ `Gregor Samsa`) | `corroborated` | individuating — holds |
| surname containment, surname still unique | `indeterminate` | thin — held, defeasible |
| surname containment, surname proves shared | `contradicted` | the rebutter fired — overturned |
| naming-scene merge (`his sister` ↔ `Grete`) | `corroborated` | the scene's guards passed |

`EVA` is inert in the projection (it lives beside the structure, not in it), so
it costs the graph nothing and gives the audit the reading-of-record for every
identity the ingestion committed.

## Bounds

A surname unique to one name still folds — defeasibility must not over-fire into
refusing a sound merge. And the rebutter only knows what the frame admits: two
people who share **both** names, or a family named only by role ("his mother",
never "Mrs Samsa"), are outside what a surname-collision frame can see. The fix
raises the floor on a confident false merge; it does not claim to resolve
identity in general.
