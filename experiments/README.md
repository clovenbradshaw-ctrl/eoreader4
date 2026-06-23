# experiments — the selection substrate

The persistent artifacts a continuous-selection loop reads and re-reads. The engine
(`src/`) is shaped by a stream of *pressures*: each pressure is turned into a **blind,
falsifiable experiment** with a held key and at least one control where the cheap
surface signal is loud. A fix is kept only if it passes the parity gate (existing
paths byte-identical, `npm test` green) **and** raises aggregate competence without
regressing any confirmed capability.

Three files, each append-only, each a projection of the work — not a plan.

## `archive.jsonl` — the pressure archive
One line per pressure tried. Each carries its **stimulus shape** (the drawn axes), its
**seed of record** (the random Wikipedia article titles + revision ids, so the draw is
replayable), its **difficulty** under the live engine, its **novelty** against the
rest, and its **verdict**. The seed makes every pressure reproducible.

## `ledger.jsonl` — the experiment ledger
One line per experiment. Carries the **capability**, the **claim**, the **stimulus
shape**, the **verdict**, the **mechanism**, the **layer** of any fix, and the **scope**
where it holds and where it does not.

## regression locks
One lock per confirmed capability, written to **fail the day its precondition
changes** — including the control condition, so a run that fires on the noise or
swings across the control fails the lock rather than passing. Locks live in `tests/`
so `npm test` runs them; the ledger names the lock for each confirmed capability.

## The discipline (the one rule)
Randomness lives in the **pressure**, never in the **test**. A wild draw still becomes
a blind experiment with a held key and a loud-surface control, and every fix still
passes the parity gate. The draw decides what gets stressed; the control and the gate
decide what counts as adaptation.

A pressure is a blind experiment of four files: a blind **stimulus** (no labels), a
read-only **measure** that emits per-item channels over prior context only, a held
**key** with the predicted dissociation + control + mechanism tag, and a
channel-agnostic **scorer** that reads the per-item split and the control. The measure
never reads the key.

## Layout & tooling

The four files of an experiment may be scattered (named in the archive's `files`
map) or kept self-contained in a per-experiment subdir, e.g.
`exp-0002-novelty-reserve/{claim,stimulus,key,measure,score}` — either way the archive
points at them. Locks live in `tests/` and are named by each ledger line's `lock`.

- `lib/seed.mjs` — the random-Wikipedia **seed source**. It draws one or more random
  articles and persists `{title, revision, extract}` to `seeds.json` as the *seed of
  record*, so a draw replays exactly (offline). `node experiments/lib/seed.mjs [n]` to
  draw, `--list` to show the recorded seeds.
- `seeds.json` — the recorded seeds of record (the replay cache).
