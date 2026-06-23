# exp-0003 · Expectation-violation blindness (the EVA/REC frame-break)

**Pressure (outside-in orthogonal collision).** Two random Wikipedia draws —
*William E. Johnson* (a Republican who first served under a **Democratic** governor) and
the *Tiger shrike* (a small **songbird** that is **predatory**) — share one deep
structure: **a standing entity acquires a property that violates the frame its prior,
confirmed predicates established.** This is the thin **EVA/REC** cell — "evaluate frames"
and "learn a rule when one breaks."

**Claim.** A predication that contradicts an entity's established kind (`Wren is a hawk`,
after `Wren is a sparrow` ×2) should move belief more than a fresh, frame-consistent
predication of equal surface novelty (`Wren is brown`).

**Stimulus + control.** Three frame pairs (shrike / Johnson / sparrow), each establishing
a kind twice then a final violation vs a consistent attribute, matched so each final line
adds exactly **one** new predicate atom → equal surface novelty. A membrane pair (a pure
operator log) carries the same structure with no parser. A **positive control** — a
connectivity reveal where the bridge channel is known to fire — proves the instrument is live.

**Result — GAP CONFIRMED.** The instrument is live (`pc-bridge` bridge = 1.00), yet across
**all 4 pairs** the three significance channels are **byte-identical** on violation vs
consistent:

| channel | AUC(violation > consistent) |
|---|---|
| bayesBits (mass / belief-movement) | 0.500 |
| surprisalBits (−log p) | 0.500 |
| bridge (connectivity) | 0.500 |

The engine has **no atom for expectation violation.** `Wren is a hawk` and `Wren is brown`
are the same event to it.

**Root cause (named).** Predicates are opaque, **slotless** value-atoms (the text organ
emits every copular predication as `DEF(id, key="predicate", value=<string>)`). A
contradictory KIND and a fresh compatible ATTRIBUTE both deposit one new value, so the
mass KL sees the same move, the bridge sees no bond, and nothing reads a conflict ontology
for copular kinds. The membrane pair confirms it is **representational, not a parser
artifact**: at the operator level a contradiction and an addition are the identical event
(a new value under the same key).

**Where this sits.** It is the next missing **significance sibling**. exp-0001 added the
*connectivity* channel (`bridgeSurprise`, the CON reveal the mass KL missed). exp-0003
names the *contradiction* channel the engine still lacks — the EVA reveal that mass and
connectivity both miss.

**Layered fix (the seed — deliberately NOT shipped here).** A clean fix spans two layers
and must stay signal-derived (no hardcoded antonym/kind lists, per the discipline):
1. **Organ / convention.** Distinguish copular-**NOUN** complements (`is a sparrow` →
   a KIND) from copular-**ADJ** complements (`is brown` → an ATTRIBUTE), and let the
   convention ledger hold that the *kind* slot is **functional** (one filler). This is a
   grammatical distinction the parser can draw — a modality fact, so it belongs at the edge.
2. **Interior.** A *revision/contradiction* significance channel that fires when a new
   value lands in an **occupied functional slot** (reading the existing `relation-types`
   functional/disjoint ontology), the EVA sibling of the bridge's CON channel —
   modality-agnostic, gated like `bridge`, byte-identical when off.

Deferred for rigor (a real multi-layer capability), not avoided — recorded as the
located gap and the next structure to grow.

## Reproduce

```
node experiments/exp-0003-frame-violation/build.mjs     # blind stimulus + held key
node experiments/exp-0003-frame-violation/measure.mjs    # read-only channels
node experiments/exp-0003-frame-violation/score.mjs      # instrument-first, then the split
```
