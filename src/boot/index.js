// The boot holon: auto-install (§7) + the initialization animation (§8).
//
// Two operational requirements over the borrowed machinery: everything the
// geometric reader needs installs automatically, idempotent and cached and
// degrading; and the reader boots with an animation that tells the truth about
// whether it came online.
//
// createInstaller / mountBootAnimation are the testable pieces (no DOM, no
// network in the installer; the animation only reflects state). bootGeometricReader
// is the browser convenience that wires the real loaders to them.

export { createInstaller, STAGES } from './install.js';
export { mountBootAnimation } from './animation.js';

import { createInstaller } from './install.js';
import { mountBootAnimation } from './animation.js';
import { createPhasepostClassifier, loadCentroids } from '../classify/index.js';

const CELLS_URL = new URL('../../data/phasepost-cells.json', import.meta.url).href;

// Fetch the phasepost cell registry (the lexicon: note_rel, fold_verb,
// provenance, arrow rules, the grain-band partition keys). Bundled, so this is
// a same-origin fetch; null on any failure so the boot degrades, not throws.
const loadCells = async () => {
  try {
    const res = await fetch(CELLS_URL);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.CELLS || null;
  } catch { return null; }
};

// Assemble the geometric reader and mount its boot animation. Non-blocking:
// returns immediately with the installer; the caller does NOT await run() — the
// chat is usable while the reader assembles, and in no-commit mode if it never
// comes online. Kicked from idle so page-open cost stays ~0.
export const bootGeometricReader = (root, { embedder, autoRun = true } = {}) => {
  const installer = createInstaller({
    embedder,
    loadCells,
    loadCentroids: () => loadCentroids(),
    makeClassifier: ({ cells, centroids, embedder }) =>
      createPhasepostClassifier({ cells, centroids, embedder }),
  });
  const view = root ? mountBootAnimation(root, installer) : null;
  if (autoRun) {
    const kick = async () => {
      // Probe the small centroid bundle before paying for the ~50MB MiniLM
      // download: with no verified instrument installed the reader cannot go
      // live regardless, so warming the weights would be waste. The install
      // still walks every stage and resolves, truthfully, to unavailable.
      const centroids = await loadCentroids();
      installer.run({ skipInstruments: !centroids });
    };
    if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(() => kick());
    else setTimeout(() => kick(), 0);
  }
  return { installer, view };
};
