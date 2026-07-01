# The decision is a relaxation, not a readout

> The principle, stated as a collapse. Stop treating *measuring*, *reading*, and *deciding*
> as separate steps the loop performs. They are one event. There is no point where the loop
> takes in `p(next)` and *then* consults it; the taking-in **is** the acting. A cell does not
> measure a concentration and look it up — receptor occupancy directly gates the next
> reaction, and a fate is a feedback network relaxing into one of its stable states and
> getting trapped there. Nothing chose. This doc collapses the generation loop's decision
> chain the same way: the field's occupancy is the input current, and the settling is the
> move.

## The gaps we had

The loop as built had exactly the "take in a signal, then consult it" structure the biology
does not have:

- `predictDirection` computed a posterior over moves — **a gauge**;
- the temperature reach, the phase bias, and the interleave scheduler **consulted** that gauge
  and picked;
- the floor checked the rendering **after** it was produced.

Three readouts with gaps between them. And the interleave cadence had to be *written* — a
strict introduce/develop scheduler — because a gauge does not oscillate on its own. That
scheduler was a symptom: a decision that has to be choreographed is a decision that has not
been made mechanistically.

## The collapse: occupancy is the current, settling is the choice

`src/longgen/relax.js`. The move is decided by a **winner-take-all relaxation** over the move
alphabet — lateral inhibition (mutual repression, the PU.1/GATA1 switch) plus self-excitation
(commitment, memory). The inputs are not a distribution to sample; they are the **occupancy
currents**, and the occupancy IS the field:

- **unspent ground** → the introduce ops (`CON/DEF/INS/SIG`) — there is fresh material to say;
- **a trailing undeveloped node** → the develop op (`EVA`) — a substrate to consume;
- **a frontier turn** (the field read's strain) → `REC` — the frame rotated;
- **the land phase with constituents fired** → `SYN` — there is something to close over.

The prior (`p(next)`) is folded in only as a **small resting potential** — it informs, it does
not decide. The network relaxes and falls into one attractor. That is the move. No posterior
is drawn and then consulted; the occupancy drives the operators and the loop **falls where it
falls**.

## The cadence emerges (the oscillator, not the schedule)

The introduce/develop alternation we used to schedule now **falls out of the currents** as an
activator–consumer loop: introducing a figure leaves an undeveloped atom, which raises the
develop current; the develop consumes it, which drops the develop current and re-enables
introduce. Alternation is a relaxation oscillator — the way a central pattern generator walks,
not a beat someone wrote. With the scheduler **off**, the dynamics produces:

```
DEF · EVA · INS · EVA · INS · EVA · INS · EVA · INS · EVA · REC · DEF · EVA · SYN
```

— a `DEF`-led open (setting terms, emergent — the old CON-led seam gone), clean
introduce/develop alternation, a `REC` where the field rotates, and a `SYN` landing. Every one
of those was a hand-written rule a message ago; now they are one relaxation reading its own
occupancy. `tests/decision-relaxation.test.js` pins it: the primitive is bistable, and the
cadence (open, develop, turn, land, no stuck attractor) emerges with the scheduler off.

## Where this meets the stack

This is the same collapse as `holonic-token-confinement.md`, one level up. There, occupancy of
the *token's* receptors gates the *token*; here, occupancy of the *field* gates the *move*. And
the field read (`generation-by-field-reading.md`) is the measurement that is not separate from
the decision — the strain it reports is not consulted, it is a current. Three docs, one
principle: **the reading is the acting, at every grain.**

The frontier this points to is **reaction–diffusion**: the striking case where the coordinate
system builds itself with no pre-existing gradient to read — an activator/inhibitor field that
spontaneously patterns. Our concept graph is still handed in; the reaction–diffusion version
would have the arc's coordinate system (which figures become sites, in what order) *emerge* from
the field's own activator–inhibitor dynamics rather than be authored. That is the next collapse,
and the relaxation here is its first cell.

## The audit export — telling whether it worked

Because the decision is now a physical settling, the audit must show the settling, not just the
outcome. `src/longgen/audit.js` — `exportAudit(result)` writes a self-contained, serialisable
artifact carrying, per atom: the surface and its floor verdict (`boundFraction`, vetoes,
sources), the **holonic address** (`operator(terrain, stance)`, the register, the floor flags),
and the **decision internals** (`by: 'relaxation'`, the winning op, the `occupancy`, and the
full `currents`/`activations` — so the export shows *which current won and by how much*), plus
the field read at that step.

`diagnose(audit)` runs the health checks off the artifact alone — `stops_on_own`, `opens`,
`develops`, `turns`, `lands`, `grounded`, `floor_on`, `decision_traced` — and returns a plain
`working` verdict. Export the JSON, hand it back, and the checks say what fired and what did
not, with no re-run. The harness writes one each time: `eoreader4-eval/essay-backwards.audit.json`,
and prints its self-diagnosis (`WORKING — opens, develops, grounded, stops on 'arc-closed';
quality 2/2`).

## Files

- the primitive + the driver: `src/longgen/relax.js` (`relax`, `relaxMove`)
- the loop wiring: `src/longgen/continuation.js` (`dynamics` option, `quiesce-spent` on spent occupancy)
- the export + checks: `src/longgen/audit.js` (`exportAudit`, `diagnose`)
- tests: `tests/decision-relaxation.test.js`
- the artifact: `eoreader4-eval/essay-backwards.audit.json` (written by `npm run essay-backwards`)
