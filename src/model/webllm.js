// webllm backend — WebGPU, Llama-3.2-3B default.
//
// Heavier than wllama; loads only when explicitly chosen. Same shape
// as the other backends; the rest of the system does not know which is in use.

import { registerBackend } from './interface.js';

const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2/+esm';

registerBackend('webllm', (opts = {}) => {
  const model = opts.model || 'Llama-3.2-3B-Instruct-q4f32_1-MLC';
  let engine  = null;
  let loading = null;

  return {
    id: 'webllm',
    kind: 'local',
    isLoaded: () => !!engine,
    async load(onProgress) {
      if (engine)  return;
      if (loading) return loading;
      loading = (async () => {
        const mod = await import(/* @vite-ignore */ WEBLLM_URL);
        engine = await mod.CreateMLCEngine(model, {
          initProgressCallback: (p) =>
            onProgress?.({ phase: p.text || 'loading', pct: p.progress ?? 0 }),
        });
      })();
      return loading;
    },
    async phrase(messages, opts = {}) {
      if (!engine) throw new Error('webllm: not loaded');
      const out = await engine.chat.completions.create({
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens:  opts.maxTokens ?? 256,
      });
      return out.choices?.[0]?.message?.content?.trim() || '';
    },
  };
});
