# Regression locks

One pointer per confirmed capability to the test that locks it. The lock itself
lives under `tests/` so `npm test` runs it; it is written to **fail the day its
precondition changes**, and it asserts the **control condition** too, so a run that
fires on the noise or swings across the control fails the lock rather than passing.

| capability | lock (under `tests/`) | pressure |
|------------|-----------------------|----------|
| signal-derived novelty reserve (the protention tracks the novelty rate) | `tests/novelty-reserve.test.js` | p001 |
