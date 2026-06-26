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
import { realize } from './realize.js';

// conceptToPlan — traverse the held relation graph into an ordered proposition plan.
// Starts at the most-connected entity (the warmest hub of the scene) and walks the
// highest-coupling outgoing relation, following the bond to the next entity — a
// salience-guided walk over the concept, not a replay of the source.
export const conceptToPlan = (doc, { genders = {}, max = 12, minCoupling = 0 } = {}) => {
  const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && e.id != null && !label.has(e.id)) label.set(e.id, e.label);
  const L = (id) => label.get(id) ?? id;
  const G = (id) => genders[L(id)] ?? genders[id] ?? 'n';

  // coupling rides on `w` for a sub-unit (held-weak) bond and is absent on a firm one — the
  // same convention linkInventory reads (firm → 1). `minCoupling` lets the generator SPEAK
  // ONLY WHAT IT HOLDS: with a floor, a merely-glimpsed relation is not said. Default 0
  // speaks everything (byte-identical), so the floor is opt-in.
  const edges = events
    .filter(e => (e.op === 'CON' || e.op === 'SIG') && e.via && e.src != null)
    .map(e => ({ from: e.src, to: e.tgt, via: e.via, sentIdx: e.sentIdx ?? 0, coupling: e.coupling != null ? e.coupling : (e.w != null ? e.w : 1) }))
    .filter(e => e.coupling >= minCoupling);
  if (!edges.length) return [];

  // The order of saying is a COHERENCE walk, not a salience sort. Discourse reads well when
  // each step keeps the center (Centering Theory: CONTINUE the entity in focus before
  // shifting). So: start at the most-connected entity (the hub of the scene), then keep
  // saying what the FOCUS does until it runs out, then shift to an entity already mentioned
  // (a smooth RETAIN/SHIFT, not a jump to a stranger), and only then to a fresh start. Among
  // equally-coherent next steps, the earliest-constituted edge goes first — the scene's own
  // temporal order breaks ties, but connectivity, not coupling, drives the walk. Nothing is
  // dropped: the loop runs until every edge is said (or max is hit).
  const deg = {};
  for (const e of edges) deg[e.from] = (deg[e.from] || 0) + 1;
  let focus = Object.entries(deg).sort((a, b) => b[1] - a[1])[0]?.[0];

  const byOrder = edges.slice().sort((a, b) => a.sentIdx - b.sentIdx);   // constitution order = tiebreak
  const remaining = new Set(byOrder);
  const mentioned = [];                                                  // most-recent first, for smooth shift
  const note = (id) => { const i = mentioned.indexOf(id); if (i >= 0) mentioned.splice(i, 1); mentioned.unshift(id); };
  const firstWhere = (pred) => { for (const e of byOrder) if (remaining.has(e) && pred(e)) return e; return null; };

  const plan = [];
  while (remaining.size && plan.length < max) {
    let e = firstWhere(x => x.from === focus)            // CONTINUE: the focus keeps acting
         || firstWhere(x => mentioned.includes(x.from))  // SHIFT smoothly: to someone already in play
         || byOrder.find(x => remaining.has(x));          // fresh start: the earliest unsaid
    remaining.delete(e);
    const objIsEntity = label.has(e.to);
    plan.push({
      subj: { id: e.from, gender: G(e.from), name: L(e.from) },
      verb: e.via,
      obj: objIsEntity ? { id: e.to, gender: G(e.to), name: L(e.to) } : L(e.to),
    });
    note(e.from); if (objIsEntity) note(e.to);
    focus = objIsEntity ? e.to : e.from;                 // follow the bond to keep the chain connected
  }
  return plan;
};

// speakConcept — the whole arc: hold the graph as concept, traverse it, find the words,
// and realise the surface (clause aggregation). Returns the realized result (aggregated
// text + the choppy per-clause units + per-unit provenance + the read-back self), so the
// generated saying is self-authored (me-ness) and its pronouns resolve back to the concept
// (validated by reading forward). Pass { aggregate:false } for the unjoined clause stream.
export const speakConcept = (doc, { genders = {}, max = 12, gamma = 0.7, enactment = 'voice', aggregate = true, minCoupling = 0 } = {}) => {
  const plan = conceptToPlan(doc, { genders, max, minCoupling });
  const render = aggregate ? realize : writeReferring;
  return { plan, ...render(plan, { gamma, enactment, given: doc }) };
};
