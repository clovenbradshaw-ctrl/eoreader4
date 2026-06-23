# Regression locks

One lock per confirmed capability, written to **fail the day its precondition changes**,
including the **control** condition — so a run that fires on the noise or swings across the
control fails the lock rather than passing.

The runnable locks live in `tests/` so they run inside the parity suite
(`node --test tests/*.test.js`). This file is the index.

| capability | lock | guards |
| --- | --- | --- |
| the novelty reserve tracks the recent novelty rate (cycle-001) | [`tests/novelty-rate-reserve.test.js`](../../tests/novelty-rate-reserve.test.js) | the constant reserve is flat (control); the tracked amplitude orders recent>early>confirm; recency-not-count; **two-sense interior**; absolute continuity; production wiring; the default path stays byte-identical |

A lock is flag-**independent** where it can be: it exercises the interior functions directly and
the wired path via an explicit opt, so it stays green on the default suite and still fails if the
mechanism, the control, the two-sense property, or the wiring regresses.
