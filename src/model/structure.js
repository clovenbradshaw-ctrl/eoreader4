// The structure backend — generation from the engine's OWN structure, no LLM, no network.
//
// Every other backend draws the reply from a language model. This one does not: it reads
// the grounded excerpts the surfer selected (the same "What you read:" block echo speaks
// from), PARSES them back into a concept graph, TRAVERSES that graph from its warmest hub,
// and REALISES the walk as surface text — concept → traverse → words → grammar, the
// embedder-free path (src/write/). Reference is resolved by inverse coref (a pronoun only
// where the reader's field resolves it back), and adjacent same-subject clauses are
// aggregated. It is honest about what it is: a structural RETELLING of what was read, not
// an answer drawn from a trained model. When there is no structure to speak from, it says so.
//
// This is the alt chat modality: select it to watch the engine generate from structure
// alone, with nothing distributional anywhere in the path.

import { registerBackend } from './interface.js';
import { EXCERPTS_HEADER } from './prompt.js';
import { emitSurface } from './stream.js';
import { parseText } from '../perceiver/parse/index.js';
import { speakConcept } from '../write/index.js';

registerBackend('structure', () => {
  return {
    id: 'structure',
    kind: 'local',
    isLoaded: () => true,
    async load(onProgress) { onProgress?.({ phase: 'ready', pct: 1 }); },
    async phrase(messages, opts = {}) {
      return emitSurface(structuralTelling(messages), opts.onToken);
    },
  };
});

// Pull the grounded excerpts out of the prompt — the surfer's "What you read:" block (the
// same source echo speaks from), with the legacy [sN] and a bare-text fallback.
const excerptsFrom = (messages) => {
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser?.content || '';
  const at = userText.indexOf(EXCERPTS_HEADER);
  if (at >= 0) {
    const lines = userText.slice(at + EXCERPTS_HEADER.length).split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length) return lines.join(' ');
  }
  const tagged = [...userText.matchAll(/\[s\d+\]\s+([^\n]+)/g)].map(m => m[1]);
  if (tagged.length) return tagged.join(' ');
  return '';
};

// Best-effort gender, so pronoun conformance has something to work with. Titles are
// decisive when present; otherwise the nearest pronoun within a short window after a
// capitalised name votes. Unknown stays neuter ("it") — honest, never guessed past the
// evidence. (Real coref runs in the parse; this only labels the entities for the writer.)
const inferGenders = (text) => {
  const g = {};
  for (const m of text.matchAll(/\b(Mrs|Ms|Miss|Lady|Mr|Sir|Lord)\b\.?\s+([A-Z][a-z]+)/g))
    g[m[2]] = /^(mrs|ms|miss|lady)$/i.test(m[1]) ? 'f' : 'm';
  for (const m of text.matchAll(/\b([A-Z][a-z]+)\b[^.!?]{0,40}?\b(he|him|his|she|her|hers|they|them|their)\b/gi)) {
    const name = m[1], p = m[2].toLowerCase();
    if (g[name]) continue;
    g[name] = /^(he|him|his)$/.test(p) ? 'm' : /^(she|her|hers)$/.test(p) ? 'f' : 'p';
  }
  return g;
};

// Read the excerpts as a concept graph and speak the traversal. Returns a plain string.
const structuralTelling = (messages) => {
  const text = excerptsFrom(messages);
  if (!text || text.length < 8) {
    return 'There is no document structure to speak from — select a document to ground in, and I will retell what its graph holds (structure only, no model).';
  }
  const doc = parseText(text, { docId: 'grounded-excerpts' });
  const out = speakConcept(doc, { genders: inferGenders(text), max: 10 });
  return out.text && out.text.trim()
    ? out.text
    : 'I read the excerpts but their graph held no traversable relations to retell.';
};
