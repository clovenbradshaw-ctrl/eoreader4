// scripts/surfaces-measure.mjs — Phase 0 of the Surfaces · Dials · Holons spec.
//
//   "no step is built before a cheap read-only measurement on a corpus you can
//    verify by hand has shown the step is real."
//
// This is that measurement, and ONLY that. Nothing is mutated, nothing is built,
// no module under src/ is touched. It folds the established corpus into one master
// log (the same "four pages over two weeks" asterisk-measure.mjs uses — the
// Metamorphosis body cut into contiguous pages, plus the two short stories in
// data/), projects the graph, and reports the four numbers the spec's Phase 0 gate
// asks for before any renderer, dial, or holon-lattice is written:
//
//   1. the distinct relType / via / kind values and their frequencies
//   2. the void population (graph.voids), carved and identity
//   3. the latent-asterisk population (reusing core/asterisk.js — already shipped)
//   4. THE FALSIFICATION: are the containment edges uniformly typed or do they
//      split four ways, and how many parents does each node have — i.e. is the
//      holon containment a TREE (build the simpler nest) or a LATTICE (build
//      projectContainment / projectHolonPath).
//
//   node scripts/surfaces-measure.mjs               # the headline numbers
//   SURFACES_DEBUG=1 node scripts/surfaces-measure.mjs   # + per-value listings
//
// The build that follows rests on these numbers, not on a hunch.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText } from '../src/perceiver/parse/pipeline.js';
import { createCompositeDoc } from '../src/organs/in/composite.js';
import { projectGraph, latentAsterisks, typeOf } from '../src/core/index.js';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const read  = (p) => readFileSync(join(ROOT, p), 'utf8');
const DEBUG = /^(1|true|on)$/i.test(process.env.SURFACES_DEBUG || '');

// ── The corpus ────────────────────────────────────────────────────────────────
// Identical to asterisk-measure.mjs so the two Phase-0 reads describe ONE corpus:
// the Metamorphosis body between the Gutenberg banners, cut into contiguous pages
// (each a SOURCE a reader saw on a different day), plus the data/ short stories.
const pagesFromGutenberg = (raw, nPages = 6) => {
  const start = raw.indexOf('*** START OF');
  const end   = raw.indexOf('*** END OF');
  const body  = raw.slice(raw.indexOf('\n', start) + 1, end > 0 ? end : undefined);
  const paras = body.split(/\n\s*\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(p => p.length > 40);
  const per   = Math.ceil(paras.length / nPages);
  const pages = [];
  for (let i = 0; i < paras.length; i += per) pages.push(paras.slice(i, i + per).join('\n'));
  return pages;
};

const docs = [];
try {
  pagesFromGutenberg(read('pg5200.txt')).forEach((text, i) =>
    docs.push(parseText(text, { docId: `metamorphosis-p${i + 1}` })));
} catch { /* pg5200 absent — fall back to the short corpus alone */ }
for (const [file, id] of [['data/metamorphosis.txt', 'metamorphosis-short'], ['data/esker.txt', 'esker']]) {
  try { docs.push(parseText(read(file), { docId: id })); } catch { /* optional */ }
}
if (docs.length === 0) { console.error('surfaces-measure: no corpus found'); process.exit(1); }

// Two projections of the one corpus:
//   raw   — referents namespaced apart, no cross-source join (crossDocSyn off). The
//           UNCOLLAPSED vocabulary, what the page actually produced.
//   held  — the asterisk path on (RULES_REV / heldIdentity), so the identity voids the
//           open same_as? candidates carve are visible in the void census.
const master     = createCompositeDoc(docs, { crossDocSyn: false }) || docs[0];
const heldMaster  = createCompositeDoc(docs, { crossDocSyn: true, heldIdentity: true }) || docs[0];
// cursor:Infinity (the default when frame.cursor is null) ⇒ no γ-fade: every edge
// the corpus produced survives to be counted, not a cursor-decayed slice.
const graph     = projectGraph(master.log, {});
const heldGraph  = projectGraph(heldMaster.log, {});

const pct = (n, d) => (d ? (100 * n / d).toFixed(1) : '0.0') + '%';
const topN = (map, n = 12) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
const bump = (map, k, by = 1) => map.set(k, (map.get(k) || 0) + by);

// ════════════════════════════════════════════════════════════════════════════
// 1 — relType / via / kind frequencies
// ════════════════════════════════════════════════════════════════════════════
// kind:    the projection's edge kind — 'con' (binding bond) | 'sig' (signal).
// via:     the OPEN surface verb/noun on the edge ('sister', 'looked', 'in').
// relType: the CLOSED primitive the typing bridge projects via→ (parent, sibling,
//          located, …), or null when the noun is honestly untyped (the algebra
//          defers). The split between the two is the whole point of relation-types.js.
const kindCount = new Map();   // 'con' | 'sig' → n
const viaCount  = new Map();   // surface via  → n
const typeCount = new Map();   // primitive relType (or '∅ untyped') → n
let typedEdges = 0, polarized = 0, hedged = 0;

for (const e of graph.edges) {
  bump(kindCount, e.kind);
  bump(viaCount, e.via ?? '∅');
  const t = typeOf(e.via)?.type ?? null;
  bump(typeCount, t ?? '∅ untyped');
  if (t) typedEdges++;
  if (e.polarity && e.polarity !== '+') polarized++;
  if (e.modality && e.modality !== 'realis') hedged++;
}

// The site-layer kinds (SYN merge vs the held same_as?), counted off the raw logs.
const synCount = new Map();
for (const e of heldMaster.log.snapshot())
  if (e.op === 'SYN') bump(synCount, e.kind ?? 'merge');

// ════════════════════════════════════════════════════════════════════════════
// 2 — the void population
// ════════════════════════════════════════════════════════════════════════════
const voidKind = new Map();   // 'carved' | 'same_as? (identity)' → n
const voidRel  = new Map();   // void's rel → n
for (const v of heldGraph.voids) {
  bump(voidKind, v.kind === 'same_as?' ? 'same_as? (identity)' : 'carved');
  bump(voidRel, v.rel ?? '∅');
}

// ════════════════════════════════════════════════════════════════════════════
// 3 — the latent-asterisk population (reuse the shipped measurement)
// ════════════════════════════════════════════════════════════════════════════
const firm = latentAsterisks(master.log);
const spec = latentAsterisks(master.log, { includeSpeculative: true });

// ════════════════════════════════════════════════════════════════════════════
// 4 — THE FALSIFICATION: tree or lattice?
// ════════════════════════════════════════════════════════════════════════════
// The spec proposes FOUR containment types (membership / condition / grounding /
// aboutness). Phase 0 does not finalize that classifier — it asks whether the
// corpus's ACTUAL relation vocabulary (dumped in §1) supports a four-way split at
// all, and whether the containment it does produce is a tree or a lattice.
//
// The containment-bearing primitives are read off relation-types.js — never a
// guessed list of strings. Each present primitive is rolled up into the spec's four
// classes, and its orientation (which endpoint is the CHILD / contained) is fixed by
// the primitive's own inverse, so "parents per node" is in-degree on child→parent:
const CONTAINMENT = {
  // primitive : { class, childIsFrom }  — childIsFrom=true ⇒ edge from→to is child→parent
  parent:     { cls: 'membership', childIsFrom: false }, // A is parent of B ⇒ child is `to`
  child:      { cls: 'membership', childIsFrom: true  }, // A is child of B  ⇒ child is `from`
  ancestor:   { cls: 'membership', childIsFrom: false },
  descendant: { cls: 'membership', childIsFrom: true  },
  located:    { cls: 'condition',  childIsFrom: true  }, // A located-in B ⇒ A is contained
  leads:      { cls: 'condition',  childIsFrom: false }, // A leads B ⇒ B is within A's unit
  // grounding (substrate→type) and aboutness (a reading→its target) have NO
  // primitive in relation-types.js — their support is measured as 0 below, which is
  // itself a Phase-0 finding: the four-way split is not yet expressible.
};
const CLASS_OF_PRIM = Object.fromEntries(Object.entries(CONTAINMENT).map(([p, v]) => [p, v.cls]));

// Measure containment over one projected graph. Run TWICE below: on the raw graph
// (referents namespaced apart) and on the HELD graph (cross-source identities folded).
// The held run is the lattice's BEST CASE — only once two contexts are merged onto
// one referent can that referent acquire parents from both, which is the only way a
// tree becomes a lattice. If even the merged graph gives every node one parent, the
// tree verdict is robust, not an artdefact of keeping the sources apart.
const measureContainment = (g) => {
  const classCount = new Map([['membership', 0], ['condition', 0], ['grounding', 0], ['aboutness', 0]]);
  const primCount  = new Map();
  const parentsOf  = new Map();   // child node → Set(parent nodes)
  const childrenOf = new Map();   // parent node → Set(child nodes)  (for the level walk)
  const rep = g.representative || ((id) => id);

  for (const e of g.edges) {
    const t = typeOf(e.via)?.type;
    const rule = t && CONTAINMENT[t];
    if (!rule) continue;
    classCount.set(rule.cls, classCount.get(rule.cls) + 1);
    bump(primCount, t);
    // Canonicalise endpoints through the projection's own representative so a parent
    // attested under two surface forms is ONE parent, not two (else fan-in inflates).
    const child  = rep(rule.childIsFrom ? e.from : e.to);
    const parent = rep(rule.childIsFrom ? e.to   : e.from);
    if (child === parent) continue;                       // a self-loop is not containment
    (parentsOf.get(child)   || parentsOf.set(child, new Set()).get(child)).add(parent);
    (childrenOf.get(parent) || childrenOf.set(parent, new Set()).get(parent)).add(child);
  }

  const containEdges    = [...classCount.values()].reduce((a, b) => a + b, 0);
  const classesPresent  = [...classCount.entries()].filter(([, n]) => n > 0).map(([c]) => c);
  const fanHist = new Map();   // #parents → #nodes
  let multiParent = 0;
  for (const [, parents] of parentsOf) {
    bump(fanHist, parents.size);
    if (parents.size >= 2) multiParent++;
  }
  const childNodes = parentsOf.size;

  // Parents per node AT EACH LEVEL — BFS depth from roots (a parent that is never a
  // child), to see whether fan-in concentrates at any holonic level.
  const roots = new Set();
  for (const p of childrenOf.keys()) if (!parentsOf.has(p)) roots.add(p);
  const level = new Map();
  const q = [...roots].map(r => [r, 0]);
  const seen = new Set(roots);
  while (q.length) {
    const [node, d] = q.shift();
    level.set(node, d);
    for (const c of (childrenOf.get(node) || [])) {
      if (seen.has(c)) continue;                          // guard cycles
      seen.add(c); q.push([c, d + 1]);
    }
  }
  const perLevel = new Map();   // level → { nodes, totalParents, maxParents }
  for (const [child, parents] of parentsOf) {
    const d = level.get(child) ?? -1;
    const row = perLevel.get(d) || { nodes: 0, totalParents: 0, maxParents: 0 };
    row.nodes++; row.totalParents += parents.size; row.maxParents = Math.max(row.maxParents, parents.size);
    perLevel.set(d, row);
  }

  const fracMulti = childNodes ? multiParent / childNodes : 0;
  return { classCount, primCount, parentsOf, containEdges, classesPresent,
           fanHist, multiParent, childNodes, perLevel, fracMulti };
};

const rawC  = measureContainment(graph);      // sources kept apart
const heldC = measureContainment(heldGraph);  // cross-source identities folded — best case for a lattice

// The verdict reads off the HELD graph (the lattice's best case).
const c = heldC;
let verdict, gloss;
if (c.containEdges === 0) {
  verdict = 'NO SUPPORT';
  gloss = 'the corpus produced no typed containment edges — the holon-lattice has no data to stand on. Do not build projectContainment/projectHolonPath against this corpus; the existing holon path (core/holon.js) is unfalsified here.';
} else if (c.classesPresent.length <= 1) {
  verdict = c.fracMulti >= 0.25 ? 'LATTICE (single-class)' : 'TREE (single-class)';
  gloss = `containment is UNIFORMLY typed (${c.classesPresent.join(', ') || 'none'}) — the four-way split the spec hypothesizes does not appear. ${verdict.startsWith('TREE') ? 'Even with cross-source identities folded, every contained node has one parent: the nest is a tree — build the simpler thing, not projectHolonPath.' : 'But nodes carry multiple parents: a single-relation lattice, not a four-typed one.'}`;
} else {
  verdict = c.fracMulti >= 0.25 ? 'LATTICE' : 'TREE (multi-class)';
  gloss = `containment splits ${c.classesPresent.length} ways (${c.classesPresent.join(', ')}); ${pct(c.multiParent, c.childNodes)} of contained nodes have ≥2 parents. ${c.fracMulti >= 0.25 ? 'A genuine lattice — projectHolonPath earns its geodesic.' : 'Typed but tree-shaped — most nodes have one parent.'}`;
}

// ════════════════════════════════════════════════════════════════════════════
// Report
// ════════════════════════════════════════════════════════════════════════════
console.log('— surfaces-measure · Phase 0 ————————————————————————————————');
console.log(`corpus:        ${docs.length} sources  (${docs.map(d => d.docId).join(', ')})`);
console.log(`graph:         ${graph.entities.size} entities, ${graph.edges.length} edges, ${graph.voids.length} voids (raw)`);
console.log('');
console.log('§1  EDGE VOCABULARY');
console.log(`    kind:      ${[...kindCount.entries()].map(([k, n]) => `${k} ${n}`).join('  ·  ') || '(none)'}`);
console.log(`    relType:   ${typedEdges}/${graph.edges.length} edges typed (${pct(typedEdges, graph.edges.length)}); ${typeCount.get('∅ untyped') || 0} untyped`);
console.log(`               ${topN(typeCount, 12).map(([t, n]) => `${t}:${n}`).join('  ')}`);
console.log(`    via:       ${viaCount.size} distinct surface verbs; top → ${topN(viaCount, 10).map(([v, n]) => `${v}:${n}`).join('  ')}`);
console.log(`    SYN kinds: ${[...synCount.entries()].map(([k, n]) => `${k} ${n}`).join('  ·  ') || '(none)'}`);
console.log(`    channels:  ${polarized} non-positive (negated) · ${hedged} non-realis (hedged) edges`);
console.log('');
console.log('§2  VOIDS (held projection — carved + identity)');
console.log(`    total:     ${heldGraph.voids.length}`);
console.log(`    by kind:   ${[...voidKind.entries()].map(([k, n]) => `${k} ${n}`).join('  ·  ') || '(none)'}`);
console.log(`    by rel:    ${topN(voidRel, 8).map(([r, n]) => `${r}:${n}`).join('  ') || '(none)'}`);
console.log('');
console.log('§3  LATENT ASTERISKS  (names borne by ≥2 ids the firm union-find leaves apart)');
console.log(`    firm:      ${firm.count}   (candidate pairs: ${firm.groups.reduce((n, g) => n + g.roots.length - 1, 0)})`);
console.log(`    +specul.:  ${spec.count}   (what the legacy crossDoc binder would collapse)`);
console.log('');
console.log('§4  FALSIFICATION — TREE OR LATTICE?');
const reportContainment = (label, m) => {
  console.log(`  [${label}]  containment edges: ${m.containEdges}  (of ${graph.edges.length} total)`);
  console.log(`           by class: ${[...m.classCount.entries()].map(([c, n]) => `${c}:${n}`).join('  ')}`);
  console.log(`           classes present: ${m.classesPresent.length} → ${m.classesPresent.length >= 2 ? 'SPLITS' : 'UNIFORM'}  ·  by primitive: ${[...m.primCount.entries()].map(([p, n]) => `${p}(${CLASS_OF_PRIM[p]}):${n}`).join('  ') || '(none)'}`);
  console.log(`           contained nodes: ${m.childNodes};  with ≥2 parents: ${m.multiParent} (${pct(m.multiParent, m.childNodes)})`);
  console.log(`           parents/node histogram: ${[...m.fanHist.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}p×${n}`).join('  ') || '(none)'}`);
  if (m.perLevel.size) {
    for (const [d, row] of [...m.perLevel.entries()].sort((a, b) => a[0] - b[0]))
      console.log(`             level ${d}: ${row.nodes} nodes, avg ${(row.totalParents / row.nodes).toFixed(2)} parents, max ${row.maxParents}`);
  }
};
reportContainment('raw — sources apart', rawC);
reportContainment('held — identities folded (lattice best case)', heldC);
console.log('    spec predicted a four-way split (membership/condition/grounding/aboutness).');
console.log('');
console.log(`    VERDICT:   ${verdict}`);
console.log(`               ${gloss}`);
console.log('————————————————————————————————————————————————————————————');

if (DEBUG) {
  console.log('\n— DEBUG ——————————————————————————————————————————————————');
  console.log('all relTypes:', [...typeCount.entries()].sort((a, b) => b[1] - a[1]));
  console.log('\nall vias:', [...viaCount.entries()].sort((a, b) => b[1] - a[1]));
  if (heldC.containEdges) {
    console.log('\ncontainment edges, held graph (child → parent):');
    for (const [child, parents] of heldC.parentsOf)
      console.log(`    ${child}  ←  {${[...parents].join(', ')}}`);
  }
  console.log('\nlatent asterisk groups:');
  for (const g of firm.groups.slice(0, 25)) console.log(`    ${g.label || g.norm}*  ×${g.roots.length}`);
}
