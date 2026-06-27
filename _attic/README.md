# _attic — the quarantine bin

Things we are **not sure** are dead, moved here instead of deleted. Nothing in
this folder is imported, referenced by `package.json`, the docs, the tests, the
`src/` tree, the HTML pages, or any other script — verified by an import-graph
sweep on 2026-06-27. They are recoverable from git history regardless; this
folder is a holding area to review before a final decision.

To restore one: `git mv _attic/scripts/<name>.mjs scripts/`
To delete for good once reviewed: `git rm _attic/scripts/<name>.mjs`

## scripts/ — orphaned exploratory one-offs

Each is a research "investigation move," wired to nothing. They read only shared
data (`data/metamorphosis.txt`, `data/esker.txt`, `pg5200.txt`) that other code
still uses, so quarantining them orphans no data.

| script | its own one-line description |
|--------|------------------------------|
| `battery-controls.mjs` | Metamorphosis Battery — Test 7 (the decisive controls), measurement-first. |
| `entity-horizon.mjs`   | move 2: does a SELECTIVE horizon promote the rupture? |
| `horizon-spread.mjs`   | move 1 of the multi-horizon investigation: the falsifiable one. |
| `learn-links.mjs`      | run the label-feedback link-type growth over a corpus. |
| `structural-reveal.mjs`| read-only measurement of the connectivity channel (cf. the still-live `structural-reveal-score.mjs`). |
| `surf-best.mjs`        | find the surfing configuration that surfaces the best note (cf. the still-live, package-wired `surf-bench.mjs`). |
