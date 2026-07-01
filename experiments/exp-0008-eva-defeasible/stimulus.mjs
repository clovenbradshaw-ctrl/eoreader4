// exp-0008 · EVA — the reading made defeasible.
//
// exp-0007 left a reading (a REC prior) that could not lose: a stale convention kept
// mis-holding because nothing evaluated it. EVA is that evaluation — reinforce a reading
// that keeps fitting, strain one that stops, defeat it when strain overtakes support. The
// stimulus is four unit-vector streams whose relation to their OWN opening drifts (or
// does not):
//   stationary — stays put (a good reading must SURVIVE);
//   dip        — a brief excursion then back (a transient must NOT defeat);
//   drift      — rotates steadily away (a sustained drift must DEFEAT at the crossover);
//   replaced   — jumps to a far direction midway (a replacement must DEFEAT).
// The measure seeds a reading from each stream's opening and EVA-tracks it; the key says
// which should be defeated. Deterministic (seeded PRNG, no deps).
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'battery');
mkdirSync(OUT, { recursive: true });

const rng = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const norm = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const D = 40, T = 60, WINDOW = 8, JIT = 0.15;
function two(seed) { const r = rng(seed); let a = Array.from({ length: D }, () => gauss(r)), b = Array.from({ length: D }, () => gauss(r)); let n = norm(a); a = a.map((x) => x / n); const p = dot(b, a); b = b.map((x, i) => x - p * b[i] * 0 - p * a[i]); n = norm(b); b = b.map((x) => x / n); return [a, b]; }
const [X, Y] = two(1);
const rotate = (deg) => { const t = deg * Math.PI / 180; return X.map((x, i) => Math.cos(t) * x + Math.sin(t) * Y[i]); };
const noisy = (dir, r) => { const v = dir.map((x) => x + JIT * gauss(r)); const n = norm(v); return v.map((x) => x / n); };

function dump(name, dirFn, defeats, note) {
  const r = rng(42);
  const units = Array.from({ length: T }, (_, t) => noisy(dirFn(t), r));
  writeFileSync(join(OUT, name), JSON.stringify({ units: units.map((u) => u.map((x) => +x.toFixed(5))), window: WINDOW, defeats, note }));
  console.log(`${name.padEnd(22)} T=${T} defeats=${defeats}`);
}

dump('stationary.json', () => X, false, 'stays put — a holding reading survives');
dump('dip.json', (t) => (t >= 27 && t < 30) ? rotate(80) : X, false, 'a brief (3-unit) blip then back — transient, survives');
dump('drift.json', (t) => rotate(90 * t / (T - 1)), true, 'rotates steadily away — sustained drift, defeated');
dump('replaced.json', (t) => (t < T / 2) ? X : rotate(85), true, 'jumps to a far direction midway — replaced, defeated');
console.log('EVA battery generated.');
