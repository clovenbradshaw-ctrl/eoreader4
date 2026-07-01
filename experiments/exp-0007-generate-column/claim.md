# exp-0007 — the GENERATE column (INS · SYN · REC)

## Pressure
The four primitives of exp-0003..0006 are the operator cube's ACT face realised on ρ:
`voidPeaks`=**SEG**, `readingCount`=**DEF**, `bornAssign`=**SIG**, `coupling`=**CON**.
That is the Differentiate and Relate work. The **Generate** column — **INS** (birth a
reading), **SYN** (merge a returning reading into its identity), **REC** (carry a learned
reading as a prior) — is what an *online, accumulating* reader needs, and the cube says it
should exist. Does it? And is it as easy as the others?

## Claim (held in `key.json`)
The Generate column is real but **not symmetric with the others** — it is genuinely harder,
and REC is its keystone:

- **INS** (online birth) loses the *global spectrum* that the batch DEF (`readingCount`)
  sees. It births correctly only when the geography is **separable**; on overlapping/short
  readings it under-births.
- **SYN** merges a returning reading into its standing identity — no re-birth churn.
- **REC** — a reading set learned from one stream carried into the next — **recognises**
  known readings with **zero births** and beats both batch and cold online exactly where
  INS is weakest. It is the return arrow: a learned convention (the high) sets the
  probability of the reading (the low).

## Mechanism (`src/core/spectral.js` → `recognize`)
`recognize(u, readings, {floor})` is the branch point: a match is **SYN** (blend the unit
into the reading's identity, sign-aware); a `−1` is novelty that buffers toward an **INS**
centroid birth after a short run; a reading set carried from a prior context is **REC**,
recognised through the same call. The batch baseline is `readingCount` + `bornAssign`.

## Stimulus (blind) — `stimulus.mjs`, `battery/*.json`
`seq_separable` (six well-separated readings in sequence — the INS regime) and
`transfer_{short,long}_{A,B}` (the *same* three registers drawn twice; A learns the prior,
B is read cold vs prior-seeded). Short blocks are the regime where cold INS cannot birth in
time. The measure reads only `units`; the prior is learned from A, never from the scored B.

## Verdict (`node stimulus.mjs && node measure.mjs && node score.mjs`)
**CONFIRMED**, all four checks:

- **INS**: on `seq_separable` the online reader **beats batch (71 % vs 45 %)** and births
  **exactly 6** readings for 6 true — cleaner identities than the batch reader's fragmented 9.
- **REC keystone** (short blocks): batch 67 % | cold 67 % (4 births) | **REC 83 % with 0
  births** — the prior recognises every register and beats both.
- The honest limit is the whole point: cold online (no prior) does **not** beat REC on the
  short blocks — INS alone under-births — which is exactly why REC closes the loop.

## The shape of the finding
The cube predicted the three missing cells and named them; building them shows *why* they
were missing. Differentiate/Relate operators read a fixed field at once; **Generate operators
act in time** — birth, merge, learn — and time is where the global view is lost. INS is the
hard one; SYN keeps identity across recurrence; REC restores the global view as an
accumulated prior. The residual autonomy `coupling` measured (exp-0006) is what INS births
from; the recurrence `readingCount` could only count in batch is what SYN merges online; the
convention REC learns is the top-down prior that scaling asked for. The column closes the loop.

## Honest limits
INS is regime-dependent by construction (separable → beats batch; overlapping/short →
under-births). On *long* blocks a stale prior can under-perform a fresh batch read (measured:
REC 50 % vs batch 71 %) — a learned convention is a prior, not a fact, and must be able to
lose (the DEF/EVA/REC ledger's defeasibility). Recognition and abstention share the void, so
a wrong `floor` breaks both directions (as it did in a first run) — the calibration is load-bearing.

## Control (the parity gate)
`recognize` is a **new pure export** composing `bornAssign`; every default engine path is
byte-identical. `node --test tests/*.test.js` green (+5 new). Regression lock:
`tests/recognize.test.js`. The REC prior is learned from a separate stream, never the scored one.

## Files
- mechanism: `src/core/spectral.js` (`recognize`), re-exported from `src/core/index.js`
- regression lock: `tests/recognize.test.js`
- this pressure: `stimulus.mjs` → `battery/*.json`, `measure.mjs` (key-blind), `score.mjs`, `key.json`
