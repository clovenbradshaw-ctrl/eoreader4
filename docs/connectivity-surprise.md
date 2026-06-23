# The connectivity surprise — the structural sibling of the one surprise

`src/core/bridge.js` · exported from `src/core/index.js` · opt-in channel on `readingAt`

## Two backward objects

A significance reading moves on a *backward object* — a summary of what has arrived,
which the next line either confirms or moves. The engine had one such object: the
γ-decayed **mass** profile (`surpriseAt`, [`spec-one-surprise`](spec-one-surprise.md)),
whose differential is D_KL(posterior‖prior) over the figure/proposition field.

Mass is the wrong invariant for one whole class of reveal. A line that **bonds two
entities already in the cast** — "Calvert commissioned Organ", when both have been on
stage for pages — is a tiny mass deposit (both endpoints already carry mass; the one new
triple barely moves the field), yet a reader takes it as *the* turn. The turn is not in
the mass. It is in the **structure**: the line collapses a separation the reading was
holding — the two entities sat in different regions of the entity graph.

`bridgeSurprise` is the second backward object: the **connectivity** of the bond graph.

```
bridge(line) = max over the line's bonds of how much each bond
               COLLAPSES the prior separation between its endpoints
  = 1                  endpoints were in different components (maximal)
  = (δ−1)/D∞           same component, geodesic δ apart (a weak bridge)
  = 0                  already adjacent (a re-bond confirms, it does not bridge)
  = 0                  either endpoint is new mass (a fresh entity — the mass channel's job)
```

It is the structural analogue of the mass KL, and the two **dissociate**: on a structural
reveal the mass channel is flat and the bridge fires; on a fresh-entity line the bridge is
0 and the mass channel fires.

## Modality-agnostic by construction

Like `surpriseAt`, the only modality-specific thing is the **front-end** — the operators
on the log. `bridgeSurprise` reads only `CON`/`SIG` bonds (the edges) and `SYN` merges
(identity). It knows nothing of text, music, or vision. Any organ that emits bonds and
merges gets the channel for free. Confirmed on a pure-operator log with no parser at all
(`tests/bridge-surprise.test.js`): a cross-component bond bridges 1.0, an adjacent re-bond
0. *Confirmed in two settings, it is the interior.*

## Coreference is identity, not adjacency (the load-bearing detail)

The endpoints are resolved through the engine's own **SYN-merge union-find**, restricted
**causally** to merges with `sentIdx ≤ cursor` — recognizing "Calvert" as the standing
Cecil Calvert is part of reading the line, never lookahead. Resolving coref as **identity**
(one node), not as an adjacency edge, is what lets the channel see a reveal that names a
standing entity by a **new surface form**: the fresh surface id is collapsed onto the
entity that has a past, so the collapse becomes visible. The earlier raw-id diagnostic in
`scripts/reveal-discrimination.mjs` keyed on surface ids and so **missed** that class (and
faked a 2-hop separation on adjacent controls through the unmerged id). This channel fixes
both — and reproduces the old column **exactly** where reveals used full names (no
regression; a strict superset).

## How it was grown

A random orthogonal-collision pressure — *Maryland Tercentenary half dollar* ×
*Marjorie Organ*, two unrelated Wikipedia draws forced into one reading — put two casts in
separate graph regions and bonded them in one line. The blind experiment
(`data/structural-reveal-stimulus.json` + `…-key.json`,
`scripts/structural-reveal{,-score}.mjs`) caught the gap and confirmed the fix: bridge is
the unique argmax on the reveal (1.0), the controls stay dark, the mass channel ranks
fresh-mass lines above the reveal, and the reading is invariant to a surface emphasis cue.
See `experiments/ledger.jsonl` exp-0001.

## Status

Opt-in (`readingAt(doc, cursor, { bridge: true })` → `{ bridge, bridgeAxis }`); the default
path is byte-identical. The surfer and the enacted loop ride the mass surprise today;
fusing the connectivity channel into what they ride is the next cycle's pressure, behind
its own parity gate.
