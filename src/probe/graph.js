// probe/graph.js — the probe's PERCEIVER step (add-on: Koestlerian probe §3).
//
// The probe is a perceiver-surfer over the codebase: the code is its text, the
// import graph its field. This module constitutes that field — it crawls the
// source tree from a root and reads each module into a proposition:
//
//   file = { rel, dir, imports: [resolved rel…] }   // who it depends on
//   holon = a directory with an index.js (its published FACE)
//
// Everything downstream (the detectors, the strain map) is a pure read over this
// graph, so the perceiving and the judging stay cleanly separated — the probe does
// not reach across its own membrane.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// Extract the RELATIVE import specifiers from a module's source (static `from`,
// bare `import '...'`, and dynamic `import(...)`). Only relative specifiers name
// in-tree holons; bare specifiers (node:, npm) cross no membrane we survey.
const SPEC = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+)['"]/g;
const importsOf = (src) => {
  const out = [];
  let m;
  while ((m = SPEC.exec(src))) out.push(m[1]);
  return out;
};

// Resolve a relative specifier against the importing file's dir to a rel path that
// exists in the tree: as written, then +.js, then /index.js. Unresolvable (an
// external or a missing file) → null, and the edge is dropped.
const resolveSpec = (fromRel, spec, files) => {
  const base = path.posix.join(path.posix.dirname(fromRel), spec);
  for (const cand of [base, `${base}.js`, `${base}/index.js`]) {
    if (files.has(cand)) return cand;
  }
  return null;
};

// Walk a directory tree, collecting every .js file as a rel path (posix).
const walk = (absDir, cwd, acc) => {
  for (const name of readdirSync(absDir)) {
    const abs = path.join(absDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, cwd, acc);
    else if (name.endsWith('.js')) acc.push(path.posix.normalize(path.relative(cwd, abs).split(path.sep).join('/')));
  }
  return acc;
};

// crawlGraph — constitute the module/holon graph from a source root. Returns the
// frozen field the detectors read.
export const crawlGraph = ({ root = 'src', cwd = process.cwd() } = {}) => {
  const rels = walk(path.join(cwd, root), cwd, []);
  const files = new Map();
  for (const rel of rels) files.set(rel, { rel, dir: path.posix.dirname(rel), imports: [] });

  // A holon is any directory that publishes a face (index.js).
  const holons = new Set();
  for (const rel of rels) if (path.posix.basename(rel) === 'index.js') holons.add(path.posix.dirname(rel));

  // Read each module's edges, resolved to in-tree rel paths.
  for (const rel of rels) {
    let src = '';
    try { src = readFileSync(path.join(cwd, rel), 'utf8'); } catch { /* unreadable → no edges */ }
    const node = files.get(rel);
    for (const spec of importsOf(src)) {
      const t = resolveSpec(rel, spec, files);
      if (t && t !== rel) node.imports.push(t);
    }
  }

  return Object.freeze({ root, files, holons });
};

// ── pure holon topology (the membrane vocabulary) ────────────────────────────

// The face of a holon directory — its published interface.
export const faceOf = (dir) => `${dir}/index.js`;

// Is `rel` a holon's face (its index.js)?
export const isFace = (graph, rel) =>
  path.posix.basename(rel) === 'index.js' && graph.holons.has(path.posix.dirname(rel));

// The holon directories that CONTAIN `rel`, outermost first. Each is an ancestor
// dir that publishes a face. (A file sitting directly in a holon dir is contained
// by it; nested holons stack.)
export const holonsContaining = (graph, rel) => {
  const out = [];
  let d = path.posix.dirname(rel);
  const segs = d.split('/');
  for (let i = 1; i <= segs.length; i++) {
    const anc = segs.slice(0, i).join('/');
    if (graph.holons.has(anc)) out.push(anc);
  }
  return out;   // outermost → innermost
};

// The nearest (innermost) holon a file belongs to, or null if it is in no holon.
// The right granularity for a MEMBRANE breach: reaching past the closest face.
export const nearestHolon = (graph, rel) => {
  const cs = holonsContaining(graph, rel);
  return cs.length ? cs[cs.length - 1] : null;
};

// The outermost holon a file belongs to — its FACULTY. The right granularity for a
// FUSED-holon check: a sub-holon (perceiver/parse) must collapse to its faculty
// (perceiver), or a faculty-level cycle stays hidden as two sub-holons that look
// unrelated. (This is the granularity the perceiver<->enact cycle needed.)
export const topHolon = (graph, rel) => {
  const cs = holonsContaining(graph, rel);
  return cs.length ? cs[0] : null;
};
