// The echo backend. Always available, zero-latency, deterministic.
// Useful for tests and for the cold-page experience: the pipeline runs
// end-to-end before any real model is loaded.
//
// It "phrases" by returning the first few spans in the prompt verbatim,
// which gives the citation binder something realistic to bind against.

import { registerBackend } from './interface.js';

registerBackend('echo', () => {
  return {
    id: 'echo',
    kind: 'local',
    isLoaded: () => true,
    async load(onProgress) {
      onProgress?.({ phase: 'ready', pct: 1 });
    },
    async phrase(messages, _opts) {
      const lastUser = [...messages].reverse().find(m => m.role === 'user');
      const userText = lastUser?.content || '';
      const spans = [...userText.matchAll(/\[s\d+\]\s+([^\n]+)/g)].map(m => m[1]);
      if (spans.length === 0) return `(echo) ${userText.slice(0, 200)}`;
      return spans.slice(0, 3).join(' ');
    },
  };
});
