// write/think.js — thinking as impressionistic talking turned inward. (the inner-speech loop)
//
// The phraser→talker arc (brief.js) runs OUTWARD: an impression (the pre-verbal scene a
// reading left) is voiced as words for someone else. Turn that same arc INWARD and you have
// thinking. You voice an impression to yourself — sub-vocally, the phraser's own draft, no
// mouth needed — then you READ YOUR OWN WORDS BACK. The reading re-activates the graph, the
// activation migrates the focus to a figure the utterance reached, and you voice again from
// there. That wander, voice → hear-yourself → re-focus → voice, is inner speech: not a
// monologue authored from nowhere but spreading activation along the graph, each step
// grounded in what the last step actually touched.
//
// The phraser is the inner voice; the LLM talker is the mouth. So thinking needs no model —
// it runs on the formulator's output before articulation (Levelt's internal speech, the
// phonological loop). The mouth is for OUTER speech (brief.js / talkThenVerify); here the
// words never leave.
//
// Three things keep this from being rumination — the architecture's worst failure at full
// duty cycle (idle.js's warning: re-perceive your own output as world and you spin):
//
//   ME-NESS (the firewall).  Every thought is voiced through the ENACTOR door (fromEnactor):
//     it is reafference, mine, and CANNOT witness (core/provenance §8). When it is read back
//     it re-enters through the perceiver door but keeps its enactor origin — classify() reads
//     READ_BACK-of-prior-self, never fresh world. So thinking reorganises attention; it never
//     adds a fact. canWitness(thought) === false, by type, not by flag. (This is exactly
//     idle.js's I2 Firewall, applied per thought.)
//
//   GROUNDED.  A thought can only be about figures and relations the graph holds — the
//     propositions come off the doc's own bonds (phraserBrief), fabrication-incapable. The
//     focus can only migrate to a figure some voiced proposition reached. You cannot think
//     your way to a figure that is not in the scene.
//
//   SELF-TERMINATING.  Activation is γ-decayed and the focus only ever moves to an unvisited
//     figure. When no voiced proposition reaches a fresh figure, the train quiesces (idle.js's
//     I3 median band). It does not spin. A hard maxThoughts bound is the backstop.

import { fromEnactor, reenter, classify, canWitness, READ_BACK } from '../core/index.js';
import { phraserBrief } from './brief.js';

// migrateFocus — where the next thought looks. The just-voiced propositions bump the
// activation of every figure they touched (subject and object); existing activation decays by
// γ first, so recency wins. The next focus is the most-activated figure NOT yet thought from —
// the utterance's own reach pulling attention forward. Returns null when nothing fresh is lit
// (the quiesce signal). Pure spreading activation over the labels the propositions name.
const migrateFocus = (propositions, activation, visited, gamma) => {
  for (const k of activation.keys()) activation.set(k, activation.get(k) * gamma);
  for (const p of propositions) {
    if (p.subj) activation.set(String(p.subj), (activation.get(String(p.subj)) || 0) + 1);
    if (p.obj) activation.set(String(p.obj), (activation.get(String(p.obj)) || 0) + 1);
  }
  let best = null; let bestA = 0;
  for (const [label, a] of activation) {
    if (visited.has(String(label).toLowerCase())) continue;   // only ever move to fresh ground
    if (a > bestA) { bestA = a; best = label; }
  }
  return best;
};

// think(doc, opts) → a grounded train of thought. The phraser→talker loop run inward:
// voice an impression at the focus, hear it back (READ_BACK-of-prior-self), let the hearing
// re-focus, voice again — until the wander reaches no fresh figure.
//   cursor       where the train starts (a label/name/id, traverse.js resolves it). Null lets
//                the first voicing speak the whole scene and the focus emerge from it.
//   genders      the inferred gender field (write/genders.js), for the referring expressions.
//   maxThoughts  the deterministic backstop (the train quiesces well before this).
//   max          propositions per single thought (per-voicing breadth).
//   gamma        the activation decay — how fast a touched figure's pull fades (recency).
//   enactment    this train's enactment id — the me-ness stamp every thought carries.
// Returns { train, focusReached, quiesced, voiced, voids }:
//   train        the thoughts, each { focus, draft, propositions, prov, classified, canWitness }
//   focusReached the ordered set of figures the train actually thought from (its coverage)
//   quiesced     true when it stopped because no fresh figure was reached (not the backstop)
//   voiced       the inner monologue, the drafts joined — the words that never left
//   voids        the OPEN QUESTIONS the wander surfaced: figures it kept hearing about (reached
//                as an object) yet that never ACT (never a bond subject) — appeared but not
//                characterized (voids.js's open-Resolution band, read at doc-graph grain). This
//                is what thinking hands to speaking: not the firm record (rumination) but the
//                unsettled point where saying it out loud could still pay.

// the figures the graph CHARACTERIZES — every label that is a subject of a CON/SIG bond. A
// figure outside this set, yet reached by the wander, is appeared-but-not-characterized: open.
const characterized = (doc) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, String(e.label).toLowerCase());
  const subjects = new Set();
  for (const e of events) if ((e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null) subjects.add(label.get(e.src) ?? String(e.src).toLowerCase());
  return subjects;
};

export const think = (doc, {
  cursor = null, genders = {}, maxThoughts = 16, max = 6, gamma = 0.7, enactment = 'think',
} = {}) => {
  const train = [];
  const activation = new Map();
  const visited = new Set();           // figures already thought FROM (lowercased labels)
  const heard = new Set();             // bonds already voiced — habituation to self-output
  const focusReached = [];
  let focus = cursor;
  let quiesced = false;

  // a bond's identity, for habituation. Hearing yourself say a proposition damps it: the next
  // thought does not dwell on what it just said (the cure for rumination — you re-perceive your
  // own output and it FADES rather than feeding back). What is fresh at a focus is what moves.
  const bondKey = (p) => `${p.subj}|${p.verb}|${p.obj ?? ''}`.toLowerCase();

  for (let i = 0; i < maxThoughts; i++) {
    const brief = phraserBrief(doc, { genders, max, cursor: focus });
    const fresh = brief.propositions.filter((p) => !heard.has(bondKey(p)));
    if (!fresh.length) {                                          // everything here already heard
      const next = migrateFocus(brief.propositions, activation, visited, gamma);
      if (focus != null) { visited.add(String(focus).toLowerCase()); }
      if (next == null) { quiesced = true; break; }
      focus = next; continue;
    }
    for (const p of fresh) heard.add(bondKey(p));                 // habituate — said is now heard

    // the inner draft is the FRESH bonds, condensed. Inner speech is abbreviated and
    // predicative (Vygotsky) — you do not say full sentences to yourself, you say the new
    // beat. So a thought is its fresh propositions, telegraphic; the full prose is for the
    // mouth (brief.js), not the inner ear.
    const draft = fresh.map((p) => `${p.subj} ${p.verb}${p.obj ? ' ' + p.obj : ''}`).join('. ');

    // voice it through the enactor door (mine, reafference), then read it back: the inner ear
    // re-enters my own prior utterance through the perceiver door, and classify() reads it as
    // READ_BACK-of-prior-self — it can steer the next thought (canOrient) but never witness.
    const prov = fromEnactor(enactment);
    const echo = reenter(prov, { door: 'perceiver', enactment });
    train.push(Object.freeze({
      focus: focus ?? null,
      draft,
      propositions: fresh,
      prov: echo,
      classified: classify(echo),                // READ_BACK — a prior self, re-read now
      canWitness: canWitness(echo),              // false, by type — the firewall (I2)
    }));
    if (focus != null) { visited.add(String(focus).toLowerCase()); focusReached.push(focus); }

    // the hearing re-activates the graph; the focus migrates to the freshest figure it reached.
    const next = migrateFocus(fresh, activation, visited, gamma);
    if (next == null) { quiesced = true; break; }                 // no fresh ground → quiesce (I3)
    focus = next;
  }

  const voiced = train.map((t) => t.draft).filter(Boolean).join(' ');

  // the open questions the wander surfaced: every figure it reached (activation > 0) that the
  // graph never characterizes (never a bond subject) — heard about, but it never acts. Ordered
  // by how much the train kept returning to it (activation): the loudest silence is the most
  // pressing open question. These are the void band (voids.js) at doc-graph grain — the points
  // where saying it out loud could still pay, as opposed to re-narrating the firm record.
  const acts = characterized(doc);
  const voids = [...activation.entries()]
    .filter(([label, a]) => a > 0 && !acts.has(String(label).toLowerCase()))
    .sort((x, y) => y[1] - x[1])
    .map(([figure, a]) => Object.freeze({ figure, band: 'void', activation: a, reason: 'reached but never acts — appeared, not characterized' }));

  return Object.freeze({ train, focusReached, quiesced, voiced, voids });
};

// everyThoughtIsMine — the firewall as an assertable predicate (idle.js I2 surfaced): no
// thought in a train can witness anything as world. A train that violated this would be
// rumination laundering self-talk into fact; this is the type-level guarantee it cannot.
export const everyThoughtIsMine = (train) =>
  train.every((t) => t.classified === READ_BACK && t.canWitness === false);

// worthSayingAloud — thinking hands a finding to speaking. A train of thought is inner (the
// words never leave); but the open questions it surfaces are precisely what a self would then
// SAY — not the firm record it already holds (that would be rumination, no new likelihood),
// but the unsettled figure it kept circling. Returns the open questions as utterances, the
// loudest silence first. This is the seam from think.js (inner) to brief.js (the mouth): the
// void becomes the thing worth opening your mouth about.
export const worthSayingAloud = (thought, { limit = 3 } = {}) =>
  (thought.voids || []).slice(0, limit).map((v) =>
    Object.freeze({ figure: v.figure, question: `What of ${v.figure}?`, band: v.band, activation: v.activation }));
