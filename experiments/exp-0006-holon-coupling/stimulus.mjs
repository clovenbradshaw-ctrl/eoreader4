// exp-0006 · a stick figure in motion — the two-way holon coupling.
//
// A kinematic tree (torso ⊃ limbs ⊃ sub-limbs) walking: every node's motion is the
// whole-body motion (translation + bob) plus its parent chain's swing plus its own
// oscillation. Two controls make the two coupling arrows separable:
//   • a WAVER limb oscillates at an OFF-gait frequency — dynamically autonomous, yet
//     still a rigid arm (structurally constitutive): the dissociation case.
//   • a GHOST node floats to random positions — no rigid bond, not a limb of the figure.
// Each stream carries per-node positions + velocities (units) and a held key (the true
// tree, the waver, the ghost). Deterministic (seeded PRNG, no deps).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'battery');
mkdirSync(OUT, { recursive: true });

const NODES = ['torso', 'head', 'uarmL', 'farmL', 'handL', 'uarmR', 'farmR', 'handR', 'ulegL', 'llegL', 'footL', 'ulegR', 'llegR', 'footR', 'GHOST'];
const PARENT = { head: 'torso', uarmL: 'torso', farmL: 'uarmL', handL: 'farmL', uarmR: 'torso', farmR: 'uarmR', handR: 'farmR', ulegL: 'torso', llegL: 'ulegL', footL: 'llegL', ulegR: 'torso', llegR: 'ulegR', footR: 'llegR' };
const LEN = { torso: 0, head: 0.5, uarmL: 0.4, farmL: 0.35, handL: 0.15, uarmR: 0.4, farmR: 0.35, handR: 0.15, ulegL: 0.5, llegL: 0.45, footL: 0.2, ulegR: 0.5, llegR: 0.45, footR: 0.2 };

function makeStream(name, { seed, gait, waver, ghostAmp }) {
  const T = 200, dt = 1 / 60;
  const rg = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32))(seed);
  const relAngle = (n, t) => {
    const ph = { uarmL: Math.PI, uarmR: 0, ulegL: 0, ulegR: Math.PI }[n];
    if (n === waver) return 1.6 * Math.sin(2 * Math.PI * 2.7 * t);              // off-gait waver
    if (ph !== undefined) return 0.5 * Math.sin(2 * Math.PI * gait * t + ph);
    if (['farmL', 'llegL', 'farmR', 'llegR'].includes(n)) return 0.3 * Math.sin(2 * Math.PI * gait * t + ({ farmL: Math.PI, llegL: 0, farmR: 0, llegR: Math.PI }[n]));
    if (n === 'head') return 0.08 * Math.sin(2 * Math.PI * gait * t);
    return 0.05 * Math.sin(2 * Math.PI * gait * t);
  };
  const pose = (t) => {
    const bodyX = 0.9 * t, bodyY = 0.06 * Math.sin(2 * Math.PI * 2 * gait * t);
    const A = {}, P = {};
    for (const n of NODES) {
      if (n === 'GHOST') { P[n] = [bodyX + ghostAmp * rg(), bodyY + ghostAmp * rg()]; continue; }
      const par = PARENT[n];
      A[n] = (par ? A[par] : 0) + relAngle(n, t) + (n === 'torso' ? Math.PI / 2 : 0);
      const b = par ? P[par] : [bodyX, bodyY];
      P[n] = [b[0] + LEN[n] * Math.cos(A[n]), b[1] + LEN[n] * Math.sin(A[n])];
    }
    return P;
  };
  const pos = {}, vel = {};
  for (const n of NODES) { pos[n] = []; vel[n] = []; }
  let prev = pose(0);
  for (let k = 0; k < T; k++) {
    const p = pose(k * dt);
    for (const n of NODES) { pos[n].push([+p[n][0].toFixed(5), +p[n][1].toFixed(5)]); if (k) vel[n].push(+((p[n][0] - prev[n][0]) / dt).toFixed(5), +((p[n][1] - prev[n][1]) / dt).toFixed(5)); }
    prev = p;
  }
  writeFileSync(join(OUT, name), JSON.stringify({
    nodes: NODES, pos, vel,
    key: { tree: PARENT, waver, ghost: 'GHOST' }, tol: 0,
  }));
  console.log(`${name.padEnd(20)} T=${T} nodes=${NODES.length} waver=${waver} ghost=GHOST`);
}

makeStream('walk_a.json', { seed: 11, gait: 1.1, waver: 'handR', ghostAmp: 4 });
makeStream('walk_b.json', { seed: 22, gait: 0.9, waver: 'footL', ghostAmp: 5 });
makeStream('walk_c.json', { seed: 33, gait: 1.3, waver: 'handL', ghostAmp: 6 });
console.log('coupling battery generated.');
