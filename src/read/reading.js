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

const GAMMA = 0.7;     // recency decay, matches DEFAULT_PROJECTION_RULES.decay_gamma
const NOVELTY = 1.0;   // reserved prior mass for an as-yet-unseen figure

export const readingAt = (doc, cursor, opts = {}) => {
  const units = doc.units || doc.sentences || [];
  const S = units.length;
  const at = Math.max(0, Math.min(S - 1, cursor | 0));
  const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);

  const label     = new Map(); // id → label
  const firstIns  = new Map(); // id → first INS sentIdx (admission line)
  const priorMass = new Map(); // id → γ-decayed presence before `at`  (the ∫)
  const priorBond = new Set(); // 'src|tgt' bonded before `at`

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
      if (e.op === 'INS') {
        // ∫ of presence with an exponential (heat) kernel — the running mass.
        priorMass.set(e.id, (priorMass.get(e.id) || 0) + Math.pow(GAMMA, at - 1 - e.sentIdx));
      } else if (e.op === 'CON' || e.op === 'SIG') {
        priorBond.add(`${e.src}|${e.tgt}`);
      }
    } else if (e.sentIdx === at) {
      if (e.op === 'INS')                               insAt.push(e.id);
      else if (e.op === 'CON' || e.op === 'SIG')        relAt.push({ op: e.op, src: e.src, tgt: e.tgt, via: e.via });
      else if (e.op === 'DEF' && e.key === 'predicate') defAt.push({ id: e.id, value: e.value });
    }
  }

  const name = (id) => label.get(id) || id;

  // LLM nudge seam (default off). The surprise pass is mechanical — surprisal
  // over the γ-mass prior, no model in the loop. But a mini-LLM can *weight*
  // the prediction the way it collapses referents: `opts.expect(id, label)`
  // returns extra prior mass for a figure the model expects next. It nudges
  // the field; it never decides. With no expecter, the reading is pure physics.
  if (typeof opts.expect === 'function') {
    for (const id of [...priorMass.keys()]) {
      const boost = Number(opts.expect(id, label.get(id))) || 0;
      if (boost > 0) priorMass.set(id, priorMass.get(id) + boost);
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
    surprise,
    surprisalBits: round(surprisal),
    held,
    summary,
  };
};

const round = (x) => Math.round(x * 100) / 100;
