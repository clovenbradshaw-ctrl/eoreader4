# Emergent entity identity — acronyms and the attribute conflict oracle

> Spec: *Emergent Entity Detection and Coreference for People and Organizations*
> (Draft 0.1). This note records the slice of that spec implemented here and how it
> sits on the machinery the engine already had. It is the companion to
> `defeasible-identity.md` (the surname fix): both make identity **attribute-bearing
> and defeasible**, not lexical and ossified.

## What was already there

A surprising amount of the spec is the engine as it stands, and the implementation
builds on it rather than around it:

- **Gravity-gated, emergent admission** (`parse/entities.js`) — a span earns
  entity-hood by behaving like a referent (argument position, possession, apposition),
  not by a sighting count. Capitalisation is already a *prior*, not the whole gate.
- **Defeasible identity** (`defeasible-identity.md`) — a surname (tail) merge is
  committed carrying its rebutter and overturned by an appended `SEG`-retract when the
  surname proves shared. Merges are events, evaluated at write time (`EVA`).
- **Injected conflict** — the standing-descriptor trigger never holds the role algebra;
  it consults `rolesConflict`, wired by the assembly layer to the typing bridge's
  `areDisjoint` (`organs/in/text.js`). "A leaf claims no knowledge it wasn't handed."
- **Held identity with discriminator convergence** (`core/asterisk.js`) — a cross-source
  `same_as?` candidate is held OUT of the union-find and promoted only when the two
  clusters **converge** on shared discriminators (the name itself excluded); a
  **functional discriminator filled by disjoint targets forks a split** instead. This
  is §5/§6's attribute identity model, already running for the cross-source case.
- **A learning ledger** (`core/conventions/ledger.js`) — `DEF·EVA·REC` over defeasible
  conventions (priors + learned, one slot), the seam for anything "learned, not declared."

## What this change adds

### 1. Acronym ↔ expansion as a learned, defeasible alias (§8 ORG-1, example 3)

The parenthetical construction — `Nashville Downtown Partnership (NDP)` — is read off
the text. The **mechanism** is in the parse leaf (`initialismMatch`,
`scanInitialisms` in `entities.js`): the acronym's letters are checked against the
expansion's leading capitals, computed both skipping and keeping the lowercase
connectors a name carries (`NDP`, but also `BOA ⇐ Bank of America`). There is **no
acronym dictionary** anywhere — a pair exists only where the text co-locates the two
forms and the letters line up.

On a match the pipeline (`parse/pipeline.js`):

- commits a `SYN kind:'merge'` carrying `evidence:'initialism'` with a write-time
  `EVA` (corroborated) — explainable and reversible, like every other merge;
- **sediments** the alias as a `REC` in the conventions ledger
  (`learnInitialism` / `initialismOf`), so it is defeasible (an `eva` break past support
  overturns it) and inheritable (a later read picks it up as a prior — `exportLedger`
  carries the expansion);
- re-points admission so the document's own later bare `NDP` resolves to the expansion
  **without re-deriving**.

The orthographic strictness is deliberate: a shell that shares only *some* tokens
(`NDMC` ⊄ the initials of "Nashville Downtown Partnership") does **not** alias, so the
structural distinctness §8 ORG-4 protects is not undone by the acronym path.

### 2. The attribute conflict oracle (§5.3 ID-4, EM-3)

`attributesConflict(attrType, a, b, opts) → {conflict, reason}` (`relation-types.js`)
generalises `rolesConflict`/`areDisjoint` into the **one injected place** the conflict
semantics for any attribute live:

| case | verdict | example |
|---|---|---|
| shared value | `0` match | nationality `[American, British]` vs `[British]` — dual, one entity |
| typed-role disjoint | `1` role-disjoint | `sister` vs `mother` (the `areDisjoint` generalisation) |
| functional clash | `1` functional-clash | one spouse / birth date / licence, two distinct fillers |
| soft / unknown | `0` soft | `American` vs `British` — not a veto (the oracle defers) |

Whether a type is single-valued is **injected, not declared**: kinship/social relations
read functionality from the primitive table; a biographical key (`bornOn`, `licence`,
`qid`) is flagged by the caller — the seam where the spec's *learned* functionality
(ID-1) enters. `asterisk.js`'s `evaluateSameAs` now **consults** this oracle (injectable
via the same opt discipline as `rolesConflict`) instead of holding the functional check
itself; behaviour is unchanged for the existing cases and now generalises to role
disjointness and soft attributes.

## Spec coverage map

| clause | status |
|---|---|
| §8 ORG-1 acronym↔expansion, learned + defeasible (example 3) | **done here** |
| §5.3 ID-4 / EM-3 `attributesConflict` injected oracle | **done here** |
| §6 ID-6 functional-conflict → split (cross-source) | extended (now via the oracle) |
| §8 ORG-4 structural distinctness preserved by the strict initialism test | guarded + tested |
| §3 emergent gravity admission · §2.2/§7 PER-2 surname defeat · §5/§6 held `same_as?` | pre-existing |
| §10 provenance — every judgement an `EVA`/`REC` event, defeasible | followed |

**Deferred** (named here so the boundary is honest): §4 caps-free detection on
lowercased/ASR sources (examples 1, 5) — the largest change, a candidate generator off
S1–S4 rather than `CAP_RE`; §5.2 ID-3 discriminativeness (TF-IDF-for-identity weighting
of shared discriminators in `evaluateSameAs`); the within-document functional-key veto /
split on a recurring bare surname (example 2 literally), which needs per-mention
attribute binding; §9 the disambiguation-frame parser (`bornOn`/nationality/role slots);
§10 the discrete user-correction vocabulary. Each lands on a seam this change leaves open.
