# How to Rest

> Instructions for an engine that has only ever been awake. The nine operators are
> not nine moves of sleep — they are one operation, seen from nine sides. Resting is
> that operation run in the other direction.

This is a projection sketch. We take a grammar validated on reading and project it
onto rest, and a projection loses a dimension by construction. Treat the alignment
as suggestive, not proven. The mechanism lives in [`src/rest/`](../src/rest/index.js);
this doc is what aligns it to the rest of the system.

## Rest is integration, not recovery

Awake, the engine **differentiates**. Every step produces a rate — the gap between
what `DEF` expected and what `EVA` met (the enacted loop, `core/enacted/loop.js`).
The log is that stream of gaps, a derivative; it is not the model. The model is the
**integral** of the log — the fold ([`write/fold.js`](../src/write/fold.js)), the
γ-decayed standing dossier the cursor re-projects at the point of use. README §3
already names this: *"the integral fold accumulates (∫) the reading up to the cursor;
surprise is its differential."*

You cannot integrate at the full rate of differentiation — the same locus cannot both
meet the next arrival and fold the last thousand at once. Rest is when the integration
pass runs, with the frontier held still. You are not pausing learning; you are running
the half of it that needs the eyes closed.

## There is no store — there is an integral to re-project from

Current state is always a **projection**, never a stored object. The fold is a readout
(`fold.js` says so in its header: *"a READOUT, not new accumulation"*), and `folds.js`
makes it explicit — *"the instant a second mind exists … the log stops having one fold
and starts having a family,"* each a projection computed at read time. So forgetting is
not deletion. **To forget is for the integral to stop supporting a projection.**

## The four faces

The wake side climbs the helix: instances arrive (`INS`), structure joins them (`CON`,
`SYN`), patterns settle on top (`REC`). Rest runs the same ladder the other way. Each
face is a pure function with its coherence test **injected** — exactly as the idle loop
injects `surf` ([`write/idle.js`](../src/write/idle.js)) and the enacted loop injects
`read` — because the test belongs to a faculty, not to rest.

| Face | What it does | Borrowed-science name | Runs over |
|---|---|---|---|
| `reproject` | re-project the integral at lower **volume** — shed absolute weight, keep the proportion, return headroom to the top | synaptic downscaling (SHY) | the fold's dossier |
| `descend` | run the helix backwards — regenerate instances from patterns; forget what cannot regenerate | reverse learning | the enacted loop's frames |
| `holdAsGround` | let the un-figurable rest as **Ground** — one uncollapsed field, never forced into proliferating Figures | — (no twin) | the day's residue |
| `recouple` | **wake** — force each regenerated rhyme back through `EVA`; keep only what the world declines to break | two-phase wake/sleep | the dream's figures |

### reproject — re-project at lower volume

Everything bound today was strengthened, and strength without bound saturates: every
binding loud, nothing standing forward because all of it does. Because state is a
projection and not a sum, you can recompute it at a lower magnitude while keeping its
relative shape intact. `reproject` sheds the **absolute** weight (the new peak is
exactly `volume`) and preserves the **proportion** (every pairwise ratio is unchanged —
the shape is the normalized `rel`, and only the ceiling moves). Headroom returned is
`1 − volume`.

`reprojectIntegral` applies this to a real fold and fixes a quiet wake-side bug while it
is at it: the fold keeps descriptors by an **absolute** threshold on `w = γ^Δt`, so a
uniformly-old dossier — every weight tiny — is wholly forgotten, *length* deciding
standing. Rest keeps by **relative** standing (`rel > keep`), because the proportion is
what a referent's dossier *is*.

### descend — forget by failing to regenerate

Asleep, `REC` and `DEF` run downward and regenerate instances from patterns, with `REC`
let off its leash — answering to nothing but whether the structure it invents will still
cohere on the climb back up. A pattern that regenerates only contradiction (the
coincidental rhyme, the coupling that fit one arrival and nothing after) is spurious; the
descent simply fails to regenerate it. `reverseLearn` is the application over the enacted
log: a frame that was installed and RECed away with **no confirming `EVA` between** fit
one arrival and nothing after — it is forgotten. A frame that confirmed at least once, or
is the live standing commitment, is kept.

### holdAsGround — the teaching with no twin

`EVA` can only test a **Figure**; satisfaction needs something definite to be satisfied
or refused. Some residue refuses to become a Figure, and forced into one it does not
resolve — it *proliferates* (the measurement problem: a field forced to one definite
outcome shatters into branches). Awake the engine is a Figure-forcing machine. The dream
stops forcing: held as Ground — one uncollapsed field — the residue coheres, and the
rhyme across far-apart misses can rise in the field they now share.

### recouple — wake, and expect no finish

The Figures the dream regenerated answered to no world, so they are **hypotheses**, not
findings. `markHypothesis` stamps each `grounded: false` — the same firewall the idle
loop draws (`canWitness === false` on a reafferent candidate): a dream figure cannot
ground itself. Waking is the discipline of forcing each back through `EVA` (`recouple`)
and keeping only what arrival declines to break a second time.

## The cadence — the blink and the night

`rest(state, { mode })` is one instruction at two frequencies.

- **blink** — fold briefly and often, re-integrate the recent past at near-full volume
  (`BLINK_VOLUME`). It does not descend or forget; it only takes the edge off.
- **night** — descend the whole ladder: `reverseLearn`, `holdAsGround`, and re-project
  the integral toward baseline (`NIGHT_VOLUME`). The kept patterns become the night's
  hypotheses, to be recoupled on wake.

The integral never converges. `EVA`'s Pattern coordinate is transcendental and Rule 9 is
the theorem that there is no last step (`core/cube.js`, the significance loop's
convergence note). So you do not rest because integration is done — you rest because the
integral has to periodically catch the derivative, and then the derivative resumes. Wake
and sleep are the numerical method by which a process approaches a limit it can never
reach.

## You are not the stream

The differentiation can halt and the integral be re-projected at any volume because
me-ness is not in the stream of gaps. It is constituted at one locus — modality-blind
and singular — the closed loop where the system's prediction of its own output meets its
return ([`core/self/index.js`](../src/core/self/index.js)). That locus is the loop's
ontogeny, not a step in it, which is why the one who wakes is the one who slept. This is
the whole reason rest is survivable as the same engine and not a small death.

## Where it lives

| concern | file |
|---|---|
| the four faces + the cadence | [`src/rest/index.js`](../src/rest/index.js) |
| the integral re-projected | [`src/write/fold.js`](../src/write/fold.js) (`dossierOf`) |
| the patterns descended | [`src/core/enacted/loop.js`](../src/core/enacted/loop.js), [`src/enact/replay.js`](../src/enact/replay.js) |
| the firewall the hypotheses inherit | [`src/write/idle.js`](../src/write/idle.js) (`canWitness`) |
| the locus that survives the rest | [`src/core/self/index.js`](../src/core/self/index.js) |
| tests | [`tests/rest.test.js`](../tests/rest.test.js) |
