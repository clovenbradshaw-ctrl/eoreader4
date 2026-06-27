// The harness loop (docs/surfing-success.md §7).
//
//   fixed:    the frozen battery — targets, gold notes, angles per target.
//   swept:    one force (or a small joint set) per run.
//   per run:  ingest Metamorphosis under the swept forces → for each probe
//             (target × angle): surface the note → score it against the gold
//             note → probe score. Aggregate per target {mean, consistency} →
//             target score. Sum → battery score.
//   output:   battery score + per-target + per-angle, so a fold that passes the
//             direct phrasings and fails the paraphrases is visible as a
//             low-consistency target even when the mean looks fine.
//   report:   the force setting with the best consistency-discounted battery score
//             that trips no hard gate on any probe.

import fs from 'node:fs';
import { ingestText } from '../organs/in/index.js';
import { surfaceNote } from './note.js';
import { scoreProbe } from './score.js';
import { aggregateTarget, aggregateBattery } from './aggregate.js';
import { TARGETS, CORPUS_PATH } from './battery.js';
import { structureSurface } from '../perceiver/index.js';

// Read-time forces ride the `forces` arg into the note surfacer; parse-time forces
// (the CONFINEMENT WINDOW, the CHARGE/VALENCE sentinel) change ingestion, so the
// doc is re-parsed when they move. `ingestOpts` carries the parse-time ones.
export const runBattery = async ({
  forces = {}, embedder = null, ingestOpts = {}, targets = TARGETS, corpus = null,
} = {}) => {
  const text = corpus ?? fs.readFileSync(CORPUS_PATH, 'utf8');
  const doc = await ingestText(text, ingestOpts);

  const perTarget = {};
  for (const [tid, target] of Object.entries(targets)) {
    const probes = [];
    for (const angle of target.angles) {
      const queryText = typeof angle === 'string' ? angle : angle.text;
      // A DECOY angle is scored against the target it actually belongs to (§3): if
      // the fold pivots on shared surface words to THIS target's region, it fails
      // the decoy's gold, and the failure drops THIS target's consistency.
      const gold = (typeof angle === 'object' && angle.decoy && targets[angle.decoy])
        ? targets[angle.decoy] : target;
      const note = await surfaceNote(doc, queryText, { embedder, forces });
      const scored = await scoreProbe(note, gold, { embedder });
      probes.push({ angle: queryText, decoy: (typeof angle === 'object' && angle.decoy) || null, ...scored });
    }
    perTarget[tid] = aggregateTarget(probes);
  }
  return { ...aggregateBattery(perTarget), forces, ingestOpts };
};

// Sweep one force across values, returning a row per value. Read-time forces vary
// the `forces` arg; the two parse-time forces map to ingestion. The best row is the
// highest consistency-discounted battery score that trips no hard gate (§7).
export const sweepForce = async (name, values, base = {}) => {
  const rows = [];
  for (const value of values) {
    const opts = { ...base, forces: { ...base.forces }, ingestOpts: { ...base.ingestOpts } };
    if (name === 'confinement') opts.ingestOpts.corefOpts = { ...opts.ingestOpts.corefOpts, descMaxDist: value };
    else if (name === 'rolesConflict') opts.ingestOpts.rolesConflict = value;
    else opts.forces[name] = value;            // leak | confirmBand | thresholds | impulse | depth | k | ahead | behind
    const report = await runBattery(opts);
    rows.push({ value, batteryScore: report.batteryScore, meanTarget: report.meanTarget, anyGate: report.anyGate, report });
  }
  const admissible = rows.filter(r => !r.anyGate);
  const best = (admissible.length ? admissible : rows)
    .reduce((a, b) => (b.batteryScore > a.batteryScore ? b : a));
  return { force: name, rows, best };
};

// Charge and valence — DECLARED, not swept (§6). The role-exclusivity sentinel
// (areDisjoint, the typing bridge) is an on/off regression: with it ON, a role
// already held (mother) refuses a disjoint one (sister), so no forbidden sister
// relation lands on the mother; with it OFF, the forbidden bond appears. Run on a
// tiny crafted fixture, because the Metamorphosis corpus admits no second named
// kinswoman — the negative control the main battery cannot host.
// A multi-word name admits on first sighting (entities.js), so the kinswoman is a
// figure the descriptor channel can bind. She is the document's `mother`; the
// sentinel decides whether she can also be made a `sister`.
const CHARGE_FIXTURE =
  'Gregor lay still in his room. Anna Marsh entered the house. ' +
  "Gregor's mother watched over him all day. Gregor's sister waited nearby.";

export const chargeValenceRegression = async () => {
  const hasForbiddenSisterOnMother = async (rolesConflict) => {
    const doc = await ingestText(CHARGE_FIXTURE, { rolesConflict });
    const s = structureSurface(doc, doc.sentences.map((_, i) => i));
    return s.relations.some(r => r.tgt.id === 'anna-marsh' && (r.type === 'sibling' || r.via === 'sister'));
  };
  const on  = await hasForbiddenSisterOnMother(undefined); // the live default (areDisjoint)
  const off = await hasForbiddenSisterOnMother(false);     // sentinel disabled
  return {
    on:  { forbiddenRelationPresent: on },
    off: { forbiddenRelationPresent: off },
    // The regression passes when the sentinel is doing its job: clean ON, broken OFF.
    pass: on === false && off === true,
  };
};

// The RE-READ regression (surfing-next.md §3) — measured on a CRAFTED ambiguous-reference
// fixture, the re-read's negative-control sibling to the charge/valence sentinel. The main
// Metamorphosis battery cannot host it: its readings SETTLE (the coref posterior is
// concentrated at every peak), so the diffuse-coref trigger never fires and the battery A/B
// is flat by construction. Two rivals, pronoun-heavy, so the posterior at the peak stays
// diffuse; with the re-read on, the fold reads more of the document on the figure it focused
// on and widens the window — the active-inference loop firing where the reading could not
// settle WHO. A question that does NOT name the figure, so the widening surfaces lines the
// first retrieval missed (when it names the figure, retrieval already has them).
// Long enough that the k=8 retrieval + surf cannot cover it — the re-read only pays when the
// initial window is a FRACTION of the document. Pronoun-heavy throughout (the posterior stays
// diffuse), with the named "Anna ..." actions scattered in the back half, beyond a generic
// front-loaded query's reach — so reading-more-on-the-focus surfaces lines the window missed.
const REREAD_FIXTURE =
  'Anna met Bella at the gate one grey morning. She was furious. She had not slept at all. ' +
  'She accused the other of lying outright. She denied every word of it. She raised her voice. ' +
  'She turned away coldly. She paced the length of the yard. She muttered under her breath. ' +
  'She kicked at the loose stones. She stared at the shuttered windows. She waited a long while. ' +
  'She followed after a moment. She hesitated at the door. She knocked once and stopped. ' +
  'Anna offered an apology in the kitchen. Anna admitted she had been wrong. Anna asked for patience. ' +
  'Anna explained the long quarrel. Anna recalled their childhood together. Anna promised to do better. ' +
  'Anna wrote a letter that night. Anna sealed it carefully. Anna posted the apology at dawn.';

export const rereadRegression = async ({ embedder = null, query = 'what happened with the apology' } = {}) => {
  const doc = await ingestText(REREAD_FIXTURE, {});
  const off = await surfaceNote(doc, query, { embedder, forces: { reread: false } });
  const on  = await surfaceNote(doc, query, { embedder, forces: { reread: true } });
  const added = on.spans.filter((i) => !off.spans.includes(i));
  return {
    query,
    focus: off.focus,                      // the figure the reading circled but could not settle
    offSpans: off.spans, onSpans: on.spans, added,
    widened: added.length > 0,             // did reading-more-on-the-focus surface fresh spans?
  };
};

// Surprise depth — read on WHICH targets can be filled at all (§6). The
// significance frame-turn should reach full recall only when the richer surprise is
// live. Under the hash organ the meaning reader falls back to the cheap γ-mass
// skeleton (the firewall), so this reports both depths; with MiniLM warm they
// diverge, and that divergence is the test of whether the expensive pass earns it.
export const surpriseDepthCheck = async ({ embedder = null } = {}) => {
  const onlyDisowning = { disowning: TARGETS.disowning };
  const cheap   = await runBattery({ forces: { depth: 'cheap' },   embedder, targets: onlyDisowning });
  const meaning = await runBattery({ forces: { depth: 'meaning' }, embedder, targets: onlyDisowning });
  return {
    cheap:   { frameRecall: cheap.perTarget.disowning.mean, targetScore: cheap.perTarget.disowning.targetScore },
    meaning: { frameRecall: meaning.perTarget.disowning.mean, targetScore: meaning.perTarget.disowning.targetScore },
    measuresMeaning: !!embedder?.measuresMeaning,
  };
};
