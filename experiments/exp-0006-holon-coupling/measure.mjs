// exp-0006 · the two-way coupling measure — KEY-BLIND.
//
// Reads each stream's nodes + per-node positions & velocities (never the tree/waver/
// ghost key). Computes, per node:
//   pull   — DYNAMIC coupling: coupling(node velocity, the WHOLE's shared motion mode).
//            The fraction of the part's motion the whole sets (downward regulation).
//   constit— STRUCTURAL coupling: 1 − min bond CV, the rigidity of the part's most
//            invariant bond (a constant bone length = constitutes the recognizable figure).
//   parent — the discovered skeleton: the most-invariant partner (argmin bond CV).
//   pull2  — LEVEL-2 pull: after removing the whole (coupling residual), the coupling to
//            the residuals' own shared mode — the sub-holon level's regulation.
// The scorer joins these with the held key.
import { buildDensity, eigenLenses, coupling } from '../../src/core/index.js';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const BATTERY = join(HERE, 'battery');

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const std = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const demean = (v) => { const m = mean(v); const c = v.map((x) => x - m); const n = norm(c) || 1; return c.map((x) => x / n); };

const files = readdirSync(BATTERY).filter((f) => f.endsWith('.json')).sort();
const out = [];
for (const f of files) {
  const D = JSON.parse(readFileSync(join(BATTERY, f)));   // ← reads nodes/pos/vel ONLY
  const { nodes, pos, vel } = D;

  // DYNAMIC: the whole's shared motion mode = top eigenlens of the node-velocity density
  const dirs = nodes.map((n) => demean(vel[n]));
  const shared = eigenLenses(buildDensity(dirs).rho)[0].lens;
  const pull = {}, residual = {};
  for (const n of nodes) { const c = coupling(demean(vel[n]), shared); pull[n] = c.pull; residual[n] = c.residual; }
  // LEVEL-2: the residuals' own shared mode (the sub-holon regulation)
  const rdirs = nodes.map((n) => { const r = residual[n], nn = norm(r) || 1; return r.map((x) => x / nn); });
  const shared2 = eigenLenses(buildDensity(rdirs).rho)[0].lens;
  const pull2 = {};
  for (const n of nodes) pull2[n] = coupling(residual[n], shared2).pull;

  // STRUCTURAL: rigidity of the most-invariant bond → constitution + discovered skeleton
  const bondCV = (i, j) => { const d = pos[i].map((p, k) => Math.hypot(p[0] - pos[j][k][0], p[1] - pos[j][k][1])); return std(d) / (mean(d) + 1e-9); };
  const constit = {}, skeleton = {};
  for (const n of nodes) {
    let best = Infinity, bp = null;
    for (const m of nodes) { if (m === n) continue; const cv = bondCV(n, m); if (cv < best) { best = cv; bp = m; } }
    constit[n] = 1 - Math.min(1, best); skeleton[n] = bp;
  }
  out.push({ name: f.replace('.json', ''), nodes, pull, pull2, constit, skeleton });
}
writeFileSync(join(HERE, 'measure_out.json'), JSON.stringify(out, null, 1));
console.log(`measured ${out.length} motion streams (key-blind) → measure_out.json`);
