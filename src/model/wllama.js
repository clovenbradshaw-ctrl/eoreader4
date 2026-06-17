// wllama backend — CPU/WASM, SmolLM2-135M default.
//
// The runtime is fetched by URL on first load; the page-open cost is 0.
// This is the smooth-loading default for users without WebGPU.

import { registerBackend } from './interface.js';

const WLLAMA_URL = 'https://cdn.jsdelivr.net/npm/@wllama/wllama@2/esm/index.js';
const DEFAULT_MODEL_URL =
  'https://huggingface.co/HuggingFaceTB/SmolLM2-135M-Instruct-GGUF/resolve/main/smollm2-135m-instruct-q8_0.gguf';

registerBackend('wllama', (opts = {}) => {
  let mod = null;
  let inst = null;
  let loading = null;
  const modelUrl = opts.modelUrl || DEFAULT_MODEL_URL;

  return {
    id: 'wllama',
    kind: 'local',
    isLoaded: () => !!inst,
    async load(onProgress) {
      if (inst)    return;
      if (loading) return loading;
      loading = (async () => {
        onProgress?.({ phase: 'fetch-runtime', pct: 0.05 });
        mod = await import(/* @vite-ignore */ WLLAMA_URL);
        const { Wllama } = mod;
        inst = new Wllama({});
        onProgress?.({ phase: 'fetch-weights', pct: 0.2 });
        await inst.loadModelFromUrl(modelUrl, {
          progressCallback: ({ loaded, total }) => {
            const pct = 0.2 + 0.75 * (loaded / Math.max(total, 1));
            onProgress?.({ phase: 'fetch-weights', pct });
          },
        });
        onProgress?.({ phase: 'ready', pct: 1 });
      })();
      return loading;
    },
    async phrase(messages, opts = {}) {
      if (!inst) throw new Error('wllama: not loaded');
      const prompt = messages
        .map(m => `<|im_start|>${m.role}\n${m.content}<|im_end|>`)
        .join('\n') + '\n<|im_start|>assistant\n';
      const out = await inst.createCompletion(prompt, {
        nPredict: opts.maxTokens ?? 256,
        sampling: { temp: opts.temperature ?? 0.7 },
      });
      return String(out || '').trim();
    },
  };
});
