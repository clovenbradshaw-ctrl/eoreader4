// MiniLM embedder via @xenova/transformers, loaded by URL on demand.
// Cold consumers (the hot lexical retrieval path) no-op when it isn't warm.
//
// Warming is opt-in. The UI may call `embedder.warm()` after first idle
// to make semantic retrieval available without blocking page open.

const XENOVA_URL = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17/+esm';
const MODEL_ID   = 'Xenova/all-MiniLM-L6-v2';

export const createMiniLMEmbedder = () => {
  let warming  = null;
  let warm     = false;
  let pipeline = null;
  const cache  = new Map();

  return {
    id: 'minilm',
    isWarm: () => warm,
    async warm() {
      if (warm)    return;
      if (warming) return warming;
      warming = (async () => {
        const mod = await import(/* @vite-ignore */ XENOVA_URL);
        pipeline = await mod.pipeline('feature-extraction', MODEL_ID, { quantized: true });
        warm = true;
      })();
      return warming;
    },
    async embed(text) {
      if (!warm) await this.warm();
      const key = String(text);
      if (cache.has(key)) return cache.get(key);
      const out = await pipeline(key, { pooling: 'mean', normalize: true });
      const v = new Float32Array(out.data);
      cache.set(key, v);
      return v;
    },
  };
};
