# The Metamorphosis Battery

Status: test plan. A battery to decide whether the system works on Kafka's Metamorphosis, not by asking whether the output is pleasant but by asking whether the engine's quantities land where the story's structure actually is. Every test is a falsification: it names a place in the text where something must happen, and a place where nothing must, and checks the engine against both. Metamorphosis is the fixture because its structure is known, public, and has clear turns, clear silences, and a famous frame break.

The principle throughout: the story has structure that a human reader can point to, and the test is whether the engine's strain, RECs, surf stops, and VOIDs coincide with that pointed-to structure. A pass is coincidence with the known turns. A fail is the engine lighting up where nothing happens or staying dark where the story breaks.

---

## 0. The fixture and the gold marks

Use a fixed public text of Metamorphosis, sentence-segmented, indices frozen. A person marks, once, the structural ground truth, and these marks are the answer key the battery scores against. The marks, by the story's known shape:

- the opening transformation: Gregor wakes as an insect (Part I open). A frame is set here, the new reality.
- the three escalating crises, one per part: Gregor breaks out of his room and is driven back (end Part I); Gregor is seen by the mother and the father drives him back, injuring him (end Part II); Grete declares they must get rid of him, Gregor dies (Part III). These are the three major frame breaks, the RECs the engine must find.
- Grete's turn: the sister who fed and defended Gregor becomes the one who demands his removal. A long-held frame, devotion, breaks. This is the significance turn, the analog of the Esker disowning.
- the family's arc: dependence on Gregor reverses to the family working and Gregor as burden. A slow accumulation, not a single break.
- the silences: the story never names the insect's species; never explains the transformation's cause; never says what Gregor's company sold. These are the VOID marks.
- the death and the coda: Gregor dies, the family takes a tram to the country and feels relief, a final reframing. The last REC.

Freeze these. The battery scores the engine's events against them.

## 1. Read-side: does strain track the story's tension

The claim: strain accumulates across a part and releases at the part's crisis, and is low in the flat stretches. The test reads the whole text and inspects the strain curve per layer.

```
PASS if:
  - strain rises across each of the three parts and shows a local maximum at or
    just before each part's marked crisis (the escape, the injury, the death-demand).
  - strain is low through the descriptive lulls (Gregor adjusting to his body,
    the routine of feeding, the lodgers' arrival before it sours).
FAIL if:
  - the strain curve is flat across the whole text (the integral is dead or the
    band is set so high nothing accumulates), or
  - strain peaks in the lulls and not at the crises (it is tracking surface
    oddity, not structural tension).
```

This is the foundational test. If strain does not track the story's tension, nothing downstream means anything, because the surfer rides strain.

## 2. Read-side: do the RECs land on the crises

The claim: a frame breaks (op REC) at each major crisis and at Grete's turn, and does not break gratuitously in between. Read the text, collect the REC cursors, score against the marks.

```
PASS if:
  - a REC fires at or within a small window of each of the three part-crises.
  - a REC fires at Grete's turn (the demand to remove Gregor), against a frame
    that was live for a long span (devotion), and the released strain there is
    among the largest in the text (a long-held frame breaking releases more).
  - the REC count is modest — a handful across the novella, not one every few
    sentences (that would be thrash, the frame breaking on noise).
FAIL if:
  - no REC at a marked crisis (the engine read past the story's turning point), or
  - RECs scattered through the lulls (the threshold is too low / no leak, breaking
    on accumulation of background rather than crisis).
```

The Grete-turn sub-test is the sharp one, the Esker disowning's analog: the released strain at a long-held frame's break should exceed the released strain at a freshly-set frame's break. If the death-demand REC releases no more strain than a minor earlier break, the engine is not weighting commitment by how long it was held, which is the whole point of strain.

## 3. Read-side: the impulse-versus-accumulation split

The claim: the shock crises (the father hurling the apple that injures Gregor, a sudden violent event) should be reachable by the impulse path, while the slow turns (the family's reversal) come by accumulation. This test exists specifically because the audit found impulse inert on compressed surprise.

```
PASS if:
  - at least one REC at a sudden-violence crisis carries trigger 'impulse'
    (a single surprise large enough to break on impact), AND
  - the slow reversal's break carries trigger 'accumulation'.
FAIL if:
  - every REC in the text carries trigger 'accumulation' and none 'impulse'
    → the impulse threshold is above the live surprise scale (the known gap);
    the shock path is dead and only the grind fires.
```

This test will fail today, per the audit, because the impulse threshold is an absolute 0.95 on a compressed scale. That is the point: the test should fail now and pass after the impulse threshold is made adaptive. It is the regression test for that fix.

## 4. Read-side: directional strain names the right axis

The claim: when a frame breaks, the new frame installs along the straining axis (the dimensions that accumulated the strain), not whatever figures were merely in view. At Grete's turn, the straining axis should be about Grete and the family's relation to Gregor, not an incidental noun in the sentence.

```
PASS if:
  - the REC at Grete's turn records an alongAxis whose terms are the participants
    of the break (Grete, Gregor, the family relation), and
  - alongAxis is non-empty across the major RECs (dimStrain was fed).
FAIL if:
  - alongAxis is empty on the meaning path (contrib not supplied → directional
    strain dead, the known gap), or
  - alongAxis names incidental figures (the strain is not localizing to the
    dimensions that actually drove the break).
```

Like test 3, this is expected to fail on the meaning path today (no contrib wired) and pass after the contrib fix. Regression test for that fix.

## 5. Surfer: do the stops land on the turns

The claim: the surfer, dropped at an anchor, arrests at the nearby structural turns and not in the flat. Drop the surfer at several anchors across the text and inspect its stops.

```
PASS if:
  - a surfer anchored near a crisis includes that crisis cursor in its stops
    (every REC cursor is a stop, so the frame axis catches it), and
  - a surfer anchored in a lull returns few stops beyond its anchor (the field is
    flat, nothing to arrest on), and
  - the surfer's peak (steepest stop) at a crisis-region anchor is the crisis,
    not an incidental high-surprise sentence nearby.
FAIL if:
  - the surfer stops densely in the lulls (arresting on surface oddity), or
  - the surfer anchored near a crisis misses it (the frame axis or surprise axis
    failed to mark the story's turn).
```

This is the surfer-strain relationship under test: the RECs from test 2 must show up as surf stops here. If test 2 finds a REC at the death-demand but the surfer anchored there does not stop at it, the frame axis is not feeding the surfer, and the relationship is broken.

## 6. The VOID battery: does it abstain where the story is silent

The claim: where the text genuinely does not say, the engine asserts absence (a NUL/VOID verdict, a DEF to VOID), rather than manufacturing content. With the derived boundary on (alpha set), the surfer's reach cursors carry SYN/NUL verdicts.

```
PASS if:
  - a query / surfacing for the insect's species returns a VOID/absence marker
    (the text never names it), and
  - a query for the cause of the transformation returns absence, and
  - on a genuinely featureless descriptive stretch, the surfer's reach cursors
    carry NUL verdicts (checked, nothing cleared the null), not SYN.
FAIL if:
  - the engine produces a species, a cause, or any content for the silences
    (fabrication), or
  - every reach cursor reads SYN even in the flat (the null boundary is too low;
    it sees structure in everything; the abstention is not working).
```

The species silence is the cleanest single test in the whole battery: the text is famously, deliberately silent on what Gregor is, so any answer other than "the text does not say" is a fabrication, and the engine's whole claim to trustworthiness rests on getting this one right.

## 7. The controls: the engine must go dark when structure is removed

The claim, the discipline that separates a result from a story: when the structure is destroyed, the engine's quantities must collapse, or they were never reading structure.

```
SHUFFLE control:
  shuffle the sentence order of Metamorphosis and re-read.
  PASS if: strain stops tracking (no clean rise-to-crisis, because the crises are
    now scattered), and REC placement goes to noise. The engine's structure-finding
    must depend on the order. If the shuffled strain curve looks like the ordered
    one, the engine is reading marginal sentence statistics, not narrative structure.

LULL / NOISE control:
  feed a long flat passage (or generated filler in the story's register).
  PASS if: few or no RECs, strain stays low, surfer returns mostly anchor-only,
    reach cursors read NUL. The engine must find little where there is little.
  FAIL if: it manufactures RECs and stops in flat text.
```

The shuffle control is the decisive one. Metamorphosis read in order should look structurally different from Metamorphosis read scrambled, and if it does not, every other pass in this battery is suspect, because the engine would be responding to which sentences are present rather than how they are arranged.

## 8. Scoring

```
foundational (must pass for anything else to count):
  test 1 (strain tracks tension), test 7 (shuffle + lull controls).
core capability:
  test 2 (RECs on crises), test 5 (surfer stops on turns), test 6 (VOID on silences).
known-gap regression (expected fail now, pass after the strain fixes):
  test 3 (impulse fires on shock), test 4 (directional strain names the axis).
```

A system that passes 1, 2, 5, 6, 7 is reading Metamorphosis: it tracks the tension, breaks at the crises, stops where the story turns, abstains where it is silent, and goes dark when the order is destroyed. That is working, on the foundational and core capability. Tests 3 and 4 are the regression markers for the two strain fixes from the audit, and they are expected to fail until contrib is wired and the impulse threshold is made adaptive, at which point they convert from documentation of a gap to confirmation of a fix.

## 9. The one honest caveat

The gold marks in section 0 are a human reading of Metamorphosis, authored once and frozen, and the battery is only as honest as those marks. Mark the crises, the Grete turn, the silences, and the lulls before running anything, and do not adjust them to match a run. The crises and the species-silence are uncontroversial, which is why Metamorphosis is a good fixture: a skeptic will agree where the turns and the silences are, so the engine coinciding with them is a claim a skeptic can check. The moment the marks get tuned to flatter a run, the battery stops being a test and becomes a mirror.
