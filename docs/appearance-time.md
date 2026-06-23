# Appearance time vs connection cursor

> Every span has a referent, and the fresh-`INS` verdict is **defeasible**. We never
> know a referent was *not* already `INS`'d until later — because maybe it was, and we
> just hadn't connected that earlier span to it yet. So the cursor of the connection is
> later, but the referent's appearance in the universe of the text was earlier. The
> existence handle must date to the earlier birth, never to the cursor we connected at.

## The two clocks

The model carries two times for every referent, and they must not be collapsed:

| clock | what it is | who owns it |
|---|---|---|
| **appearance time** (valid time) | when the referent first appeared in the text — the `INS`-by-appearance, the `mintHash(seq)` off the fold's monotonic appearance order | `core/event.js`, `core/project.js` |
| **connection cursor** (transaction time) | when *we* discovered the binding — a `SYN merge`, a coref bind, a naming scene resolving an epithet to a name | the parse pipeline, the readers |

The invariant: **connection cursor ≥ appearance time, always, and the connection must
never move appearance forward.** A span that looks fresh is not proof of a fresh
referent — "not yet connected" ≠ "never `INS`'d." The negative is non-monotonic: a later
connection can reveal the appearance was earlier all along. This is the dual of the
surname split in `defeasible-identity.md`: there a confident merge is *overturned*; here a
presumed-new referent is *back-bound* to an earlier birth. Both are append-only —
suppress-never-erase keeps both clocks so replay reconstructs belief-as-of-cursor.

## Where the law lives — `core/project.js`

The projection is the place the invariant is enforced, and it is exact:

- `firstSeen: e.seq` is set at the **first `INS`** of each raw id (`project.js:104`);
  `entities` iterates in **appearance order**.
- At collapse (`project.js:158-163`) the merged record initialises from the
  **earliest-appearing member of the merge class** (`merged.get(root) || { ...ent }` —
  first one wins); later members only add sightings.
- A `SYN merge` only sets union-find parent pointers (`project.js:147`); it **never
  touches `firstSeen`**, and the merge direction (`from→to`) is irrelevant to it.

So even when the connection lands late **and roots the class on a late-appearing alias**
— the naming scene folds the early epithet `his sister` into the late name `Grete`
(`pipeline.js:397`, `from: roleRef, to: m.name`) — the referent's `firstSeen` stays
pinned to the earliest birth. Connection cursor late, appearance early.

## The reads that leaked, now hardened — `converse/reference.js`

Two reference-resolution reads resolved on the **connected id** instead of the
**appearance class**, so they dated appearance to whatever id the merge happened to root
on. They are post-hoc reads (the document is fully parsed and every merge is known when
they run), so the appearance class is the right thing to read:

- **`localeOf`** — its no-bond fallback scanned the raw `refId`, returning the cursor the
  connection landed at. Now it reads over the projection class and returns the **earliest
  appearance**. (The surname alias masked this — it roots on the *earlier* id — but the
  naming scene roots late, and there it returned the late name line.)
- **`conversationCast`** — it pooled γ-warmth per raw id, so a referent renamed
  mid-conversation (`Gregor Samsa` … then bare `Samsa`) read as **two** warm figures, the
  later mention ranked hotter. Now it pools on the projection root: **one** referent, its
  warmth summed across aliases, the canonical (earliest-`INS`) label leading.

Both are byte-identical where no merge spans the read (`node --test tests/*.test.js`,
649 pass).

## The measurement — `scripts/appearance-time.mjs`

"Measure, and let it come back negative." A **forced later-root** merge is the adversary
(role early at s0, name late at s10, merge roots on the name). The script checks the law
and the two reads and exits nonzero on any leak. It came back with exactly two leaks
(`localeOf=10`, `conversationCast=["Samsa","Gregor Samsa"]`), now closed. Pinned in
`tests/appearance-time.test.js`.

## The residue — `perceiver/reading.js` (parity-gated)

The deepest manifestation is **not** changed here. The forward reader keys novelty on the
raw id (`reading.js:88`, `162`), so a referent re-entering under a new surface form reads
as a **fresh `INS`** — it fires `"X enters"` and even `"focus shifts off X"` — although the
alias is already in the log at that cursor. The in-the-moment surprise is defensible (you
*are* surprised by an unfamiliar form before you connect it), but the connection is
already available at parse time, so pooling `INS` ids through the projection
representative would suppress it.

That change is parity-affecting (it moves surprisal and the proposition-field basis), so it
belongs **behind `RULES_REV` with a golden parallel**, the discipline the repo holds for
the core surprise loop. The default path is pinned as-is in `tests/appearance-time.test.js`
("RESIDUE"), written to **fail the day the pooled reading ships** — the signal the residue
has been closed.
