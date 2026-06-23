# locks — one regression lock per confirmed capability

A lock is written to **fail the day its precondition changes — including the
control**, so a run that fires on the noise or swings across the control fails the
lock rather than passing. Locks live in `tests/*.lock.test.js` so the standard parity
gate (`node --test tests/*.test.js`) runs every one of them in CI.

| capability | lock | guards |
| --- | --- | --- |
| the novelty reserve tracks the recent novelty rate (`experiments/reserve-rate`) | [`tests/reserve-rate.lock.test.js`](../../tests/reserve-rate.lock.test.js) | byte-identical default (parity) · the constant reserve is **blind** (control) · the signal reserve **separates** turnover<stable in text AND frequency (mechanism, omnimodal) · a confirmation probe does not separate (null) · the γ-decay recurrence of `noveltyRateProfile` (core contract) |

A no-decay mutation of `noveltyRateProfile` trips `lock/text` (exact values) and
`lock/core` (the decay pin) while the robust structural dissociations survive — which
is how you learn *which* experiment locks a given line.
