# seed — the four-sense origin demo

These are the origin artifacts this experiment generalises: one engine read through
four sensory front-ends (text, audio, vision, IMU), showing that the Born assignment
*sequence* — lens-switching — segments a stream, regardless of modality.

- `gen_all.py` — generates the four sensory streams (`*_units.json`).
- `engine_run.mjs` — reads them with the real core (`buildDensity`/`eigenLenses`/
  `vonNeumann`/`deriveNull`) and scores boundary F1.
- `sense_organs.png` — the result plot.

Note: `engine_run.mjs` imports from `./eoreader4/src/core/...`, i.e. it was written to
run from a parent directory with the repo checked out as `eoreader4/`. It is kept here
verbatim as provenance. The generalised, in-repo version — a 20-stream multilingual +
hard-problem battery read through the same engine plus the geography-derived
`readingCount` — is the parent directory's `stimulus.py` / `measure.mjs` / `score.mjs`.
