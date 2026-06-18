// The echo backend. Always available, zero-latency, deterministic.
// Useful for tests and for the cold-page experience: the pipeline runs
// end-to-end before any real model is loaded.
//
// It "phrases" by returning the first few document EXCERPTS verbatim, which
// gives the citation binder something realistic to bind against. The excerpts
// no longer carry an [sN] label (the talker never sees indices, §3), so we find
// them under the excerpts header instead of by the old tag.

import { registerBackend } from './interface.js';
import { EXCERPTS_HEADER } from './prompt.js';

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
      const at = userText.indexOf(EXCERPTS_HEADER);
      if (at >= 0) {
        const lines = userText.slice(at + EXCERPTS_HEADER.length)
          .split('\n').map(s => s.trim()).filter(Boolean);
        if (lines.length) return lines.slice(0, 3).join(' ');
      }
      // Legacy [sN] form, then a bare fallback.
      const tagged = [...userText.matchAll(/\[s\d+\]\s+([^\n]+)/g)].map(m => m[1]);
      if (tagged.length) return tagged.slice(0, 3).join(' ');
      return `(echo) ${userText.slice(0, 200)}`;
    },
  };
});
