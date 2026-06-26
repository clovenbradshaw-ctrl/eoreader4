// Concept → traversal → words. The generation direction, from the top.
//
// You do not write word-first. You hold the concept IMAGISTICALLY — the activated
// relation graph the reading constituted, a scene of entities and the relations between
// them — and you TRAVERSE that graph to find what to say, lexicalising each step as you
// go. The traversal order is the order of saying, and it comes from the CONCEPT (the
// graph's own structure and activation), not from the source text's order. Each step is
// realised by writing-as-reading-backwards (refer.js): the surface form is chosen so the
// reader's coref field resolves it back to the intended entity.
//
// This is the demonstrable KERNEL of the Enacted Writer holon (fold/folds/scheduler/
// witness), which is the production path with the full nested-instrument theory of mind
// and the streaming surface. Here: take a held graph, walk it, speak it — with the
// referring rules and the me-ness/self line active (refer.js).

import { writeReferring } from './refer.js';

// conceptToPlan — traverse the held relation graph into an ordered proposition plan.
// Starts at the most-connected entity (the warmest hub of the scene) and walks the
// highest-coupling outgoing relation, following the bond to the next entity — a
// salience-guided walk over the concept, not a replay of the source.
export const conceptToPlan = (doc, { genders = {}, max = 12 } = {}) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, e.label);
  const L = (id) => label.get(id) ?? id;
  const G = (id) => genders[L(id)] ?? genders[id] ?? 'n';

  const edges = events
    .filter(e => (e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null)
    .map(e => ({ from: e.src, to: e.tgt, via: e.via, coupling: e.coupling || 0 }));
  if (!edges.length) return [];

  const deg = {};
  for (const e of edges) deg[e.from] = (deg[e.from] || 0) + 1;
  let cur = Object.entries(deg).sort((a, b) => b[1] - a[1])[0]?.[0];

  const used = new Set();
  const plan = [];
  let guard = 0;
  while (plan.length < max && guard++ < max * 3) {
    let out = edges.filter(e => e.from === cur && !used.has(e));
    if (!out.length) { const any = edges.find(e => !used.has(e)); if (!any) break; cur = any.from; continue; }
    out.sort((a, b) => b.coupling - a.coupling);
    const e = out[0]; used.add(e);
    const objIsEntity = label.has(e.to);
    plan.push({
      subj: { id: e.from, gender: G(e.from), name: L(e.from) },
      verb: e.via,
      obj: objIsEntity ? { id: e.to, gender: G(e.to), name: L(e.to) } : L(e.to),
    });
    if (objIsEntity) cur = e.to;
  }
  return plan;
};

// speakConcept — the whole arc: hold the graph as concept, traverse it, find the words.
// Returns the writeReferring result (text + per-unit provenance + the read-back self),
// so the generated saying is self-authored (me-ness) and its pronouns resolve back to
// the concept (theory of mind, validated by reading forward).
export const speakConcept = (doc, { genders = {}, max = 12, gamma = 0.7, enactment = 'voice' } = {}) => {
  const plan = conceptToPlan(doc, { genders, max });
  return { plan, ...writeReferring(plan, { gamma, enactment, given: doc }) };
};
