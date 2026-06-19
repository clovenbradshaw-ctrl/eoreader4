// The reading holon — reading mode as a predict / evaluate / surprise loop,
// formatted in the EO operator vocabulary.
//
// The three levels of reading are three different kinds of math:
//
//   L1 existence    counting measure — cardinality of presence (set overlap).
//   L2 structure    graph linear algebra — a union-find quotient over a
//                   weighted adjacency, edge weight bilinear in endpoint
//                   log-mass under a γ-decay kernel along the reading line.
//   L3 significance probability + information — a prior distribution over
//                   "who acts next" (the integral fold of γ-mass), an
//                   expectation (prediction), and a SURPRISAL (−log₂p) when
//                   the next line lands (the differential of the fold).
//
// This file is L3. Prediction reads only events *before* the cursor; surprise
// reads events *at* the cursor; the scalar surprise is the mean surprisal in
// bits of what the line did under the prior the reading had built.

import { CONVERSATIONAL_CAP } from '../converse/index.js';

const GAMMA = 0.7;     // recency decay, matches DEFAULT_PROJECTION_RULES.decay_gamma
const NOVELTY = 1.0;   // reserved prior mass for an as-yet-unseen figure

export const readingAt = (doc, cursor, opts = {}) => {
  const units = doc.units || doc.sentences || [];
  const S = units.length;
  const at = Math.max(0, Math.min(S - 1, cursor | 0));
  const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);

  const label     = new Map(); // id → label
  const firstIns  = new Map(); // id → first INS sentIdx (admission line)
  const priorMass = new Map(); // id → γ-decayed presence before `at`  (the ∫, figure field)
  const priorBond = new Set(); // 'src|tgt' bonded before `at`
  // The PROPOSITION field — the belief state widened past the cast. The reading
  // believes not just who is on stage but what it takes to be the case: the
  // participants (figures AND the referents they act on), the propositions
  // themselves (src|via|tgt triples), and the predicates. γ-decayed like the figure
  // mass, so a recurring proposition confirms and a new event moves belief. This is
  // what the Bayesian-surprise channel reads, so an EVENT on a standing figure (the
  // apple in the back, the disowning) is significant, not only a change of cast.
  const priorProp = new Map(); // atom → γ-decayed presence before `at`
  const bump = (m, k, v = 1) => m.set(k, (m.get(k) || 0) + v);

  const insAt = [];            // entity ids instantiated at `at`
  const relAt = [];            // { op, src, tgt, via } at `at`
  const defAt = [];            // { id, value } at `at`

  for (const e of events) {
    if (e.op === 'INS') {
      if (!label.has(e.id)) label.set(e.id, e.label);
      if (!firstIns.has(e.id)) firstIns.set(e.id, e.sentIdx);
    }
    if (e.sentIdx == null) continue;
    if (e.sentIdx < at) {
      const w = Math.pow(GAMMA, at - 1 - e.sentIdx);
      if (e.op === 'INS') {
        // ∫ of presence with an exponential (heat) kernel — the running mass.
        priorMass.set(e.id, (priorMass.get(e.id) || 0) + w);
        bump(priorProp, `f:${e.id}`, w);
      } else if (e.op === 'CON' || e.op === 'SIG') {
        priorBond.add(`${e.src}|${e.tgt}`);
        // The bond's participants (incl. an NP referent target) and the proposition
        // itself enter the belief field — the relation is part of what is the case.
        bump(priorProp, `f:${e.src}`, w);
        bump(priorProp, `f:${e.tgt}`, w);
        bump(priorProp, `p:${e.src}|${e.via || ''}|${e.tgt}`, w);
      } else if (e.op === 'DEF' && e.key === 'predicate') {
        bump(priorProp, `f:${e.id}`, w);
        bump(priorProp, `d:${e.id}|${e.value}`, w);
      }
    } else if (e.sentIdx === at) {
      if (e.op === 'INS')                               insAt.push(e.id);
      else if (e.op === 'CON' || e.op === 'SIG')        relAt.push({ op: e.op, src: e.src, tgt: e.tgt, via: e.via });
      else if (e.op === 'DEF' && e.key === 'predicate') defAt.push({ id: e.id, value: e.value });
    }
  }

  const name = (id) => label.get(id) || id;

  // expect — the model-adds-mass-to-the-prior door (§6), redrawn as a
  // DEPOSITION, not the injection it was drafted as. The talker does not write
  // the prior directly; its expectation enters as TAGGED, CAPPED conversational
  // mass, kept separable from the γ-mass prior so the fold can discount the echo
  // (the subtract-and-check, converse holon). It warms the prediction of who
  // acts next; capped at the model reader's ceiling, it can never dominate a
  // grounding reader, and surprise still reads the line against a prior the
  // talker cannot manufacture past that cap.
  const convPrior = new Map();   // id → tagged conversational expectation mass
  let conversationalPrior = 0;
  if (typeof opts.expect === 'function') {
    for (const id of [...priorMass.keys()]) {
      const raw   = Number(opts.expect(id, label.get(id))) || 0;
      const boost = Math.min(CONVERSATIONAL_CAP, Math.max(0, raw));   // capped, never raw
      if (boost > 0) {
        convPrior.set(id, boost);
        conversationalPrior += boost;
        priorMass.set(id, priorMass.get(id) + boost);
      }
    }
  }

  // --- Prediction (REC): a probability distribution over who acts next. ----
  // P(figure) ∝ γ-mass; a reserve of NOVELTY holds probability for someone
  // not yet seen. Prediction = the expectation: the top of this distribution.
  const total = [...priorMass.values()].reduce((s, m) => s + m, 0);
  const Z = total + NOVELTY;
  const pNovel = NOVELTY / Z;
  const pOf = (id) => (priorMass.get(id) || 0) / Z;

  const ranked = [...priorMass.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const predFigures = ranked.slice(0, 3);
  const predSet = new Set(predFigures);
  const predBonds = [];
  for (const key of priorBond) {
    const [a, b] = key.split('|');
    if (predSet.has(a) && predSet.has(b)) predBonds.push(`${name(a)}—${name(b)}`);
    if (predBonds.length >= 3) break;
  }

  // --- Observation + surprise (EVA): surprisal of the line under the prior. -
  const presentIds = new Set([...insAt, ...relAt.flatMap(r => [r.src, r.tgt]), ...defAt.map(d => d.id)]);
  const confirmed  = predFigures.filter(id => presentIds.has(id));

  const newFigIds = [...new Set(insAt)].filter(id => firstIns.get(id) === at);
  const pNovelEach = newFigIds.length ? pNovel / newFigIds.length : pNovel;

  let bits = 0, n = 0;
  for (const id of presentIds) {
    const isNew = firstIns.get(id) === at;
    const p = isNew ? Math.max(pNovelEach, 1e-6) : Math.max(pOf(id), pNovel * 0.5, 1e-6);
    bits += -Math.log2(p); n++;
  }
  for (const r of relAt) {
    if (priorBond.has(`${r.src}|${r.tgt}`)) continue;
    const ps = Math.max(pOf(r.src), pNovel, 1e-6);
    const pt = Math.max(pOf(r.tgt), pNovel, 1e-6);
    bits += -Math.log2(ps * pt); n++;
  }
  const surprisal = n ? bits / n : 0;          // mean bits per surprising event
  const surprise  = 1 - Math.pow(2, -surprisal); // squashed to [0,1)

  // --- Bayesian surprise (the SIGNIFICANCE channel). -----------------------
  // Surprisal answers "how improbable"; that is the wrong invariant for where a
  // reading's attention goes — TV-snow is maximally improbable yet moves no belief
  // (Itti & Baldi, NIPS 2005). Bayesian surprise answers "how far the reading's
  // belief MOVED": D_KL(posterior ‖ prior) over the PROPOSITION field (priorProp) —
  // the participants, the propositions among them, and the predicates, not just the
  // cast. The posterior is the prior advanced one step — every incumbent decays by
  // γ, every atom delivered at this line deposits γ⁰ = 1 — over the common support
  // plus a fixed reserve atom (NOVELTY) that keeps a newcomer finite (no infinite
  // name-snow shock) and makes the opening fall to exactly zero on its own. So an
  // event on a standing figure moves belief now, not only a change of cast. See
  // docs/bayesian-surprise.md.
  // The deposit at this line — the full proposition delivered: every participant
  // (figures and the referents they act on), every proposition (src|via|tgt), every
  // predicate. So a new bond or predication on a standing figure moves belief.
  const deposit = new Map();
  for (const id of insAt) bump(deposit, `f:${id}`);
  for (const r of relAt) {
    bump(deposit, `f:${r.src}`);
    bump(deposit, `f:${r.tgt}`);
    bump(deposit, `p:${r.src}|${r.via || ''}|${r.tgt}`);
  }
  for (const d of defAt) {
    bump(deposit, `f:${d.id}`);
    bump(deposit, `d:${d.id}|${d.value}`);
  }
  const support   = new Set([...priorProp.keys(), ...deposit.keys()]);
  const newcomers = [...deposit.keys()].filter(k => !priorProp.has(k));
  // The proposition field's own reserve probability — co-entrants split it, so the
  // reserve is never multiply-counted (a single newcomer gets all of it).
  const sumPropPrior = [...priorProp.values()].reduce((s, m) => s + m, 0);
  const propNovel = NOVELTY / (sumPropPrior + NOVELTY);
  const newShare  = newcomers.length ? propNovel / newcomers.length : 0;

  const postMass = new Map();
  let sumPost = 0;
  for (const k of support) {
    const m1 = GAMMA * (priorProp.get(k) || 0) + (deposit.get(k) || 0); // m′ = γ·m + deposits
    postMass.set(k, m1);
    sumPost += m1;
  }
  const denomPost = sumPost + NOVELTY;
  const priorW = (k) => (priorProp.has(k) ? priorProp.get(k) : newShare);
  let sumW = NOVELTY;
  for (const k of support) sumW += priorW(k);

  let bayesBits = 0;
  for (const k of support) {
    const pPost = postMass.get(k) / denomPost;
    if (pPost <= 0) continue;
    bayesBits += pPost * Math.log2(pPost / (priorW(k) / sumW));
  }
  // The reserve atom (protention) — present in both prior and posterior, the term
  // that keeps the KL defined (absolute continuity) on every newcomer.
  {
    const pPost = NOVELTY / denomPost;
    if (pPost > 0) bayesBits += pPost * Math.log2(pPost / (NOVELTY / sumW));
  }
  bayesBits = Math.max(0, bayesBits);          // KL ≥ 0 (clamp float noise)
  const bayes = 1 - Math.pow(2, -bayesBits);   // squashed to [0,1)

  // --- EO-tagged surprises: the operator each surprise fired under. ---------
  const surprises = [];
  for (const id of newFigIds) surprises.push({ op: 'INS', text: `${name(id)} enters`, idx: at });
  for (const r of relAt) {
    if (!priorBond.has(`${r.src}|${r.tgt}`)) {
      surprises.push({ op: r.op, text: `${name(r.src)} ${r.via || 'with'} ${name(r.tgt)}`, idx: at });
    }
  }
  for (const d of defAt) surprises.push({ op: 'DEF', text: `${name(d.id)}: ${d.value}`, idx: at });
  const focusShift = predFigures.length > 0 && confirmed.length === 0 && presentIds.size > 0;
  if (focusShift) surprises.push({ op: 'SEG', text: `focus shifts off ${name(predFigures[0])}`, idx: at });

  const held = confirmed.length > 0;
  const summary = surprise < 0.25
    ? (predFigures.length
        ? `As read — ${confirmed.length ? confirmed.map(name).join(', ') + ' stay in focus' : 'steady'}.`
        : 'Opening — no expectations yet.')
    : `Surprise — ${surprises.map(s => s.text).slice(0, 3).join('; ')}.`;

  return {
    sentIdx: at,
    sentence: units[at],
    chrome: presentIds.size === 0 && surprises.length === 0,
    predicted: { op: 'REC', figures: predFigures.map(name), bonds: predBonds },
    evaluation: { op: 'EVA', held, surprise, bits: round(surprisal) },
    surprises,
    // Two channels (docs/bayesian-surprise.md). `surprise`/`surprisalBits` is the
    // NOVELTY channel (−log p) — the audit/trace, the UI %, the note gate. `bayes`/
    // `bayesBits` is the SIGNIFICANCE channel (D_KL) — what the surfer's cursor and
    // the enacted loop ride. They disagree where it is diagnostic.
    surprise,
    surprisalBits: round(surprisal),
    bayes,
    bayesBits: round(bayesBits),
    held,
    summary,
    // Tagged conversational warmth folded into the prior this turn (0 when the
    // expect door wasn't used). Separable, so the fold can subtract the echo.
    conversationalPrior: round(conversationalPrior),
  };
};

const round = (x) => Math.round(x * 100) / 100;
