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

### 3 · The within-document functional-key veto  (§6 ID-6 · §7 PER-2 · worked example 2)

A birth date is the canonical functional person-key. `scanFunctionalAttributes`
(`entities.js`) reads it off the constructions that front-load it — the appositive
`(born 1979)` / `(1961–…)` and the copular `born in 1979` — and attaches it to the
nearest admitted name as a defeasible `DEF` attr. The surname reconciliation
(`pipeline.js`) then vetoes a tail merge whose endpoints carry a **conflicting** key:
`John Smith (born 1961)` + a bare `Smith (born 1979)` do **not** merge, even though the
surname-sharing rebutter cannot see it (only one full "Smith" name). The veto is the
existing append-only defeat — a `SEG`-retract + a write-time `EVA` naming the key — so
the oracle, not the pipeline, owns the conflict semantics, and a *matching* date leaves
the merge standing (the veto does not over-fire). The extractor is deliberately narrow
(a 4-digit year behind an explicit `born`/date-paren) so no golden carries it.

The veto is the **weak-corroboration** end (only a shared surname links the two ids).
Its complement is the **strong-corroboration** middle: an entity sighted under one
*identical* name bearing two conflicting values (`John Smith … born 1961` … `John Smith
… born 1962`) is **disagreement, not distinctness** — the Fellegi-Sunter indeterminate
zone (Recasens' near-identity surfaces *as* this disagreement). The reconciliation keeps
it **one** entity, holds the key `INDETERMINATE` via an `EVA` (the no-commit verdict),
and retains both source values in the log — never two entities, never a silent
overwrite. So the same functional-key conflict reads two ways by corroboration strength:
veto a thin merge, contest a thick one.

### 4 · Calendar tokens are temporal expressions, not referents  (§4 detection)

A capitalised weekday/month in an argument slot ("reconvene **Monday**") reached the
gravity floor as a one-shot figure. A seeded-but-learnable `calendar` register (the same
shape as `demonym`) lets admission deny it referential gravity — weekdays plus only the
months that do not collide with given names (March/April/May/June/July/August are
omitted rather than silently drop a character). A real argument-slot referent still
admits; a personification that genuinely recurs can re-earn it as the convention revises.

## Spec coverage map

| clause | status |
|---|---|
| §8 ORG-1 acronym↔expansion, learned + defeasible (example 3) | **done here** |
| §5.3 ID-4 / EM-3 `attributesConflict` injected oracle | **done here** |
| §6 ID-6 / §7 PER-2 functional-key veto on a tail merge (example 2 · B5) | **done here** |
| §6 B6 the Fellegi-Sunter indeterminate zone — contested, not split | **done here** |
| §4 calendar tokens denied referential gravity (the weekday over-admit) | **done here** |
| §6 ID-6 functional-conflict → split (cross-source) | extended (now via the oracle) |
| §8 ORG-4 distinctness preserved by the strict initialism test | guarded + tested |
| §3 emergent gravity admission · §2.2/§7 PER-2 surname defeat · §5/§6 held `same_as?` | pre-existing |
| §10 provenance — every judgement an `EVA`/`REC` event, defeasible | followed |

**Deferred** (named here so the boundary is honest):

- **§4 caps-free detection** on lowercased/ASR sources (examples 1, 4, 5) — the largest
  change: a candidate generator off S1–S4 argument-slots rather than `CAP_RE`, gated by a
  source class (all-caps text currently makes `CAP_RE` swallow a whole sentence as one name).
- **§8 ORG-4 positive structural guard** (example 2's shell game) — a structural CON as
  evidence of distinctness. *Moot until a merge exists to guard*: the engine merges orgs
  only on exact-normalised labels, so structurally-linked orgs with different labels
  (`NDMC`/`DMC`) are never merge candidates today; the guard belongs at the site of a
  future fuzzy/token-overlap merge, not before one.
- **C5 person/org type veto** — needs an entity-type (person vs org) channel from
  verb-selection (S4), so a shared surface form can be split by type.
- **§5.2 ID-3 discriminativeness**; **§9** the disambiguation-frame parser; **§10** the
  discrete user-correction vocabulary; within-document **splitting** of one id into two
  (two identical full names — B3). Each lands on a seam this change leaves open.
