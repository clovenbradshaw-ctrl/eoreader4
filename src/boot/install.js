// Auto-install — assembling the geometric reader, on first load, idempotent and
// cached, non-blocking and degrading. Reading is available throughout (in
// no-commit mode) while the instrument comes online; if it never does, reading
// keeps working with plain CON edges and the install reports the true state.
//
// This module is the engine of the boot: a stage machine with no DOM and no
// network of its own. Every effectful dependency — warming the embedder,
// loading cells and centroids, building the classifier — is injected, so the
// machine is driven under test with fakes, no browser, no download.
//
// The five stages are the same three-position phasepost the reader is about to
// perform, plus the ground-clear before and the live-confirm after:
//
//   clearing     core load, chrome gate ready        the ground is cleared
//   instruments  MiniLM weights (percent)            the reader has weights
//   centroids    27 cells loaded, partitioned        the instrument is built
//   warming      first inference, kernel compile     the reader can measure
//   ready        classifier live (or honest degrade) the reader perceives
//
// Degrade, never fail. Each stage is wrapped; a failure marks that stage and
// the machine still resolves — to a TRUE terminal state, live or unavailable,
// never a fake checkmark and never a thrown boot.

export const STAGES = Object.freeze(['clearing', 'instruments', 'centroids', 'warming', 'ready']);

const defaultYield = () => new Promise((r) => {
  if (typeof requestIdleCallback !== 'undefined') requestIdleCallback(() => r());
  else setTimeout(r, 0);
});

const PROBE = { clause: 'The sister tends her brother.', verb: 'tends' };

export const createInstaller = ({
  embedder,                 // { warm(onProgress), embed, measuresMeaning, id }
  loadCells       = async () => null,
  loadCentroids   = async () => null,
  makeClassifier,           // ({ cells, centroids, embedder }) => classifier
  probe           = PROBE,
  yieldTo         = defaultYield,
} = {}) => {
  const state = {
    stages: Object.fromEntries(STAGES.map(s => [s, 'pending'])),
    progress: 0,                 // instruments download, 0..1
    geometricReader: 'assembling', // 'assembling' | 'live' | 'unavailable'
    detail: 'assembling the perception apparatus…',
    error: null,
    classifier: null,
    cells: null,
    centroids: null,
  };

  const subs = new Set();
  const snapshot = () => Object.freeze({
    ...state,
    stages: Object.freeze({ ...state.stages }),
  });
  const emit = () => { const s = snapshot(); for (const cb of subs) { try { cb(s); } catch { /* a bad listener never breaks the boot */ } } };
  const set = (stage, status) => { state.stages[stage] = status; emit(); };

  let started = null;

  // `skipInstruments` lets the caller decline the heavy MiniLM download when it
  // already knows there is nothing to measure against (no centroid bundle
  // installed) — downloading weights for a reader that cannot go live would be
  // waste, not honesty. The stages still resolve, truthfully, to unavailable.
  const run = ({ skipInstruments = false } = {}) => {
    if (started) return started;       // idempotent: one boot, one download
    started = (async () => {
      // clearing — the local apparatus (core, the chrome/NUL gate) is already
      // present the moment this module loads. The ground is cleared.
      set('clearing', 'active');
      await yieldTo();
      set('clearing', 'done');

      // instruments — the embedder weights. Only a meaning organ can become the
      // geometric reader; the hash organ has no weights and cannot measure, so
      // it skips here and the reader resolves unavailable below.
      set('instruments', 'active');
      let instrumentsOk = false;
      if (!embedder?.measuresMeaning || skipInstruments) {
        set('instruments', 'skipped');
      } else {
        try {
          await embedder.warm((p) => {
            const pct = typeof p?.progress === 'number' ? p.progress / 100
              : (p?.total ? p.loaded / p.total : null);
            if (pct != null && isFinite(pct)) { state.progress = Math.min(1, Math.max(0, pct)); emit(); }
          });
          state.progress = 1;
          instrumentsOk = true;
          set('instruments', 'done');
        } catch (e) {
          state.error = String(e?.message || e);
          set('instruments', 'failed');
        }
      }
      await yieldTo();

      // centroids — the measurement instrument, partitioned into bands at load.
      // Cells may load even when centroid vectors do not (cells still serve the
      // talker serialization); centroid vectors are what the reader needs to
      // measure, so the band readiness keys on them.
      set('centroids', 'active');
      let centroidsOk = false;
      try {
        state.cells = await loadCells();
        state.centroids = await loadCentroids();
        centroidsOk = !!(state.centroids?.vectors && Object.keys(state.centroids.vectors).length);
        set('centroids', centroidsOk ? 'done' : 'failed');
      } catch (e) {
        state.error = String(e?.message || e);
        set('centroids', 'failed');
      }
      await yieldTo();

      // Build the classifier from whatever assembled. With no centroids it is a
      // real object that honestly returns no-commit; with them it can measure.
      if (typeof makeClassifier === 'function') {
        try { state.classifier = makeClassifier({ cells: state.cells, centroids: state.centroids, embedder }); }
        catch (e) { state.error = String(e?.message || e); }
      }

      // warming — first inference, kernel compile. Only meaningful when the
      // organ and the instrument are both present. A real measurement is run to
      // confirm the reader can measure (and to pay the compile cost off the hot
      // path), not a fake tick.
      set('warming', 'active');
      let warmingOk = false;
      if (instrumentsOk && centroidsOk && state.classifier?.classify) {
        try {
          const perception = await state.classifier.classify(probe);
          warmingOk = !!perception?.live;
          set('warming', warmingOk ? 'done' : 'failed');
        } catch (e) {
          state.error = String(e?.message || e);
          set('warming', 'failed');
        }
      } else {
        set('warming', 'skipped');
      }
      await yieldTo();

      // ready — resolve to the true state. Live iff every prior stage that the
      // reader depends on came online. Otherwise a stated degraded state with a
      // reason, holding the classifier at no-commit.
      const live = instrumentsOk && centroidsOk && warmingOk;
      state.geometricReader = live ? 'live' : 'unavailable';
      state.detail = live
        ? `geometric reader: live · measuring against ${Object.keys(state.centroids.vectors).length} centroids`
        : `geometric reader: unavailable — ${reason(embedder, instrumentsOk, centroidsOk)}; classification holding at no-commit`;
      set('ready', 'done');
      return snapshot();
    })();
    return started;
  };

  return {
    STAGES,
    run,
    getState: snapshot,
    subscribe(cb) { subs.add(cb); cb(snapshot()); return () => subs.delete(cb); },
  };
};

const reason = (embedder, instrumentsOk, centroidsOk) => {
  if (!embedder?.measuresMeaning) return 'the embedder is the hash organ, not MiniLM';
  // Centroids before weights: when the boot declines the MiniLM download because
  // no instrument is installed, the absent centroids are the root cause to name.
  if (!centroidsOk)   return 'verified centroids are not installed';
  if (!instrumentsOk) return 'MiniLM weights did not load';
  return 'first measurement did not confirm';
};
