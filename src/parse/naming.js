// The naming-scene discovery — coreference by direct address.
//
// A standing role epithet ("his sister") is a REFERENT that carries its owner's
// relation ("Gregor's sister"); a name ("Grete") is a referent. A reader learns
// they are the SAME not from apposition — Kafka never writes "his sister Grete" —
// nor from proximity — Grete tends the whole family, so she co-occurs with every
// kin word equally — but from the NAMING SCENE: the mother cries the NAME, "Grete!",
// and the narrator attributes the ANSWER to the ROLE, "his sister called". The one
// addressed by name, answering as the role, IS that role's bearer.
//
// The discovery's output is a SYN — an identity join — not a bond. Once the role
// referent and the name merge, projectGraph's union-find carries the owner→role edge
// onto the name with no cascade, exactly the way "Gregor" ⊂ "Gregor Samsa" already
// merges. The guards are an identity join's, not a binder's: owner-distinctness (no
// one is their own sister), the INJECTED disjointness algebra (a name already the
// mother cannot also be the sister), and STICKY abstention — two distinct names
// answering one role is INDETERMINATE, and the role referent is left UNNAMED rather
// than guessed (the two-sister discipline, surviving the whole pass).

import { scanVocatives } from './relations.js';

const ROLES = ['sister', 'mother', 'father', 'brother'];
const REACH = 2;   // a vocative is answered within the next turn or two.

// Attribution of a spoken turn — kept inclusive here (the parse leaf's own seed is
// tuned for quote attribution, not for "called/cried from the other side").
const SPEECH = /\b(?:called|cried|said|asked|answered|replied|whispered|shouted|spoke|begged|screamed|murmured|sobbed|wailed|exclaimed)\b/i;

// Non-person free-capitals that name no kin-bearer — a small, revisable stand-in
// for the embedding "feels-like-a-subject" gate (a DEF the model could later revise:
// "God"/"Christmas" survive sentence-initial capitalisation but address no person).
const NONPERSON = new Set(['god', 'christmas', 'heaven', 'hell', 'good', 'lord', 'sir', 'madam', 'samsa']);

// Discover name↔role identities from naming scenes. Returns SYN proposals
// { role, ownerId, name } (name and ownerId in admission SLUG space), already
// guarded. Pure over the parsed sentences + the live admission/coref field.
export const discoverNamings = (
  sentences,
  { admission, corefField, rolesConflict = () => false } = {},
) => {
  // Owners per role, from the standing descriptors — only an ESTABLISHED NAMED owner
  // ("Gregor's sister") anchors a discovery; a bare epithet names no relation.
  const owner = {};
  for (const r of ROLES) {
    const d = corefField.descriptorState(r);
    if (d && d.ownerNamed && d.ownerId) owner[r] = d.ownerId;
  }
  if (!Object.keys(owner).length) return [];

  // Vocatives (admitted, person-gated) and role-epithet answers (epithet + speech).
  const vocAt = [];   // { i, id }
  const ansAt = [];   // { i, role }
  sentences.forEach((sent, i) => {
    for (const v of scanVocatives(sent)) {
      if (NONPERSON.has(v.name.toLowerCase())) continue;
      if (admission.isAdmitted(v.name)) vocAt.push({ i, id: admission.idOf(v.name) });
    }
    const m = String(sent).match(/\b(?:his|her|the)\s+(sister|mother|father|brother)\b/i);
    if (m && owner[m[1].toLowerCase()] && SPEECH.test(sent)) ansAt.push({ i, role: m[1].toLowerCase() });
  });

  // Pair each vocative with the role epithet that ANSWERS it (a later turn, within
  // reach). The caller of the name sits at or before the vocative; the responder —
  // the bearer — is the next role to speak.
  const raw = [];
  for (const v of vocAt) {
    const ans = ansAt.find(a => a.i > v.i && a.i <= v.i + REACH);
    if (!ans) continue;
    if (v.id === owner[ans.role]) continue;             // can't be your own <role>
    raw.push({ role: ans.role, ownerId: owner[ans.role], name: v.id });
  }

  // Guard the SYN: sticky abstention (≥2 distinct names for a role → hold) and the
  // injected disjointness algebra (a name already merged into a disjoint role refused).
  const byRole = new Map();
  for (const p of raw) {
    if (!byRole.has(p.role)) byRole.set(p.role, new Map());
    byRole.get(p.role).set(p.name, p);
  }
  const merges = [];
  const nameRole = new Map();
  for (const [role, names] of byRole) {
    if (names.size > 1) continue;                       // INDETERMINATE → no SYN (sticky)
    const p = [...names.values()][0];
    const prior = nameRole.get(p.name);
    if (prior && rolesConflict(role, prior)) continue;  // disjoint double-role refused
    nameRole.set(p.name, role);
    merges.push(p);
  }
  return merges;
};
