# eoreader4-eval

Conformance scorers for the spec in [`docs/conformance-spec.md`](../docs/conformance-spec.md).

This is the harness root the spec's §8 describes. It is being stood up one family
at a time — the spec is a map; this is the first stretch of walked territory.

## Stood up so far

### Family C — void detection / abstention (`family-c-void.mjs`)

Runs 16 hand-built domain triples (surveillance / OHS-NDP beat, balanced
void/answerable, including the hard "near but not in" void class) through the
**real** `runTurn` pipeline and scores the void verdict.

```
node eoreader4-eval/family-c-void.mjs
```

Deterministic — `echo` model + hash embedder, no network, no weights. That
determinism is also its ceiling: it measures the `answerable` stage's void
verdict and the veto flags, but it **cannot** measure FM2 (confabulation at a
void), which needs a generative model that can actually invent at a gap.

**What the first run showed (see spec §C.6):**

- The `answerable` void verdict catches **0 of 8** gold voids — *by design*. The
  detector is conservative (P0.2 moved abstention downstream); the hardest void
  class clears its lexical-overlap gate on purpose.
- In the hash-organ configuration the downstream discriminator **saturates**:
  `referent-ambiguous` fires on all 16 turns, so it carries no abstention signal.
- Therefore family C is only valid with the **MiniLM organ live** and a **real
  generative model** at `llm`. The deterministic harness is a plumbing/regression
  check (does the pipeline run, do the steps populate, does the contract hold its
  shape), not a scorecard.

The numbers this prints are a baseline-run artifact (spec §10.1), not a
pass/fail gate.
