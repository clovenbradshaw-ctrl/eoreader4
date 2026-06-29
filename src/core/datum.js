// The datum — a key bound to its value, the proposition a MEASUREMENT makes.
//
// A datum is the triadic minimum (proposition.js) drawn over DATA rather than prose:
// the KEY is the substrate (what the value is about), the value-tie is the relation,
// the VALUE is the differentia (what it is). "High → 66°", "ISO → 400", "BPM → 120":
// one shape, every modality. It rides the append-only log as the SAME DEF currency a
// role or a harvested front-matter field uses — `{ op:'DEF', key, value, kind:'datum' }`
// — so the projection, the meaning graph, and the talker's prompt read it as the
// property it is (the "A : fact" form), with no new operator and no new projection rule.
//
// Why the core, not a sense organ: the binding of a value to its key is UNIVERSAL. The
// image organ already emits a region's attribute as a DEF (organs/in/image.js:52); the
// text organ harvests a labeled front-matter field as a DEF (parse/metadata.js). What is
// modality-SPECIFIC is recognizing what a value LOOKS like — a numeral and a degree sign
// in text, an EXIF tag in a photo, an ID3 frame in audio. That recognition stays at the
// edge, in the organ; the binding itself, and the shape it commits to, are here, in the
// interior every modality reduces to. So the temperature fix and an EXIF-table fix are
// the same fix.

// The DEF subtype tag. A role DEF carries `key:'role'`; a harvested header field carries
// `kind:'meta'`; a datum carries `kind:'datum'` — distinguishable in the trail and
// groupable by a consumer, without a new operator.
export const DATUM_KIND = 'datum';

// Construct the DEF event that commits a datum to the log. `id` addresses the datum
// within its document holon (e.g. `unit:7.datum.high`); `key` is the surface label and
// `value` the surface value, both verbatim. Held DEFEASIBLY by default — a read datum is
// a theory the reading can still revise, like a harvested header field, never an axiom.
export const makeDatumDef = ({ id, key, value, sentIdx, defeasible = true, ...rest }) => ({
  op: 'DEF', id, key, value, kind: DATUM_KIND, defeasible,
  ...(sentIdx != null ? { sentIdx } : {}), ...rest,
});

// Is this log event a datum DEF? Read-only; for a consumer that groups facts by kind.
export const isDatumDef = (e) =>
  !!e && e.op === 'DEF' && e.kind === DATUM_KIND && e.key != null && e.value != null;
