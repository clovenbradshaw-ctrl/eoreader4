// Structural retrieval — the document's own skeleton, for whole-document tasks.
//
// A whole-document task (summary / list / explain) whose question is a META-word —
// "summarize", "what is this about", "give me the gist" — makes NO lexical contact with
// the page: the word "summarize" appears nowhere in the document, so lexical retrieval
// fuzzy-matches it onto arbitrary tokens and hands the talker a handful of disconnected
// fragments to invent from. (The audit's t1: a "summary" of a 19k-sentence wiki built
// from "It fails." and "That is intended." — the talker then confabulated a document
// about √2.) Asking the query is the wrong move when the query says nothing about the
// page; the fix is to read the document's STRUCTURE instead:
//
//   · the OPENING — the first usable units, where a document says what it is;
//   · the section HEADINGS — its skeleton;
//   · an even SPREAD across the body — representative content the first two miss.
//
// Scored so the opening leads (it survives selectExcerpts and takes the frame's primacy
// slot) and the spread still clears the relevance floor. Site / furniture units
// (read/site.js) are skipped, exactly as hybrid retrieval skips them — they frame, they
// do not answer. A TARGETED whole-doc question — one naming a term the document actually
// uses ("list the nine operators") — is NOT routed here: queryTouchesDoc keeps it on the
// lexical path, so the audit's strong t6 ("what are the 9 operators?") is untouched.

import { siteIndices } from '../perceiver/index.js';
import { docVocab } from './lexical.js';
import { tok } from '../perceiver/parse/index.js';

const isHeading = (t) => /^\s*#{1,6}\s+\S/.test(String(t || ''));
const isBlank   = (t) => !String(t || '').trim();

// The question words and whole-document task words a meta-query is made of. A query that
// reduces to these alone says nothing about the page — there is nothing to retrieve ON,
// so the structural skeleton answers it. `tok` already drops the closed-class stopwords
// (the, this, that, is, …); this set adds the open-class words that are nonetheless about
// the ASKING, not about the document's subject.
const META = new Set([
  'what', 'who', 'whom', 'whose', 'which', 'where', 'when', 'why', 'how',
  'summarize', 'summarise', 'summary', 'summaries', 'summarizing', 'summarising',
  'tldr', 'tl', 'dr', 'recap', 'gist', 'overview', 'synopsis', 'abstract',
  'explain', 'elaborate', 'describe', 'tell', 'give', 'show', 'walk',
  'list', 'enumerate', 'outline', 'bullet', 'bullets', 'name', 'every', 'all', 'each',
  'about', 'document', 'doc', 'text', 'file', 'story', 'book', 'passage', 'article',
  'work', 'novel', 'essay', 'paper', 'chapter', 'thing', 'things',
  'main', 'mainly', 'point', 'points', 'key', 'topic', 'topics', 'idea', 'ideas',
  'says', 'say', 'said', 'mean', 'means', 'cover', 'covers', 'covered',
  // SCOPE / COVERAGE words — they say HOW MUCH of the document, never its subject.
  // The audit's t3 ("summarize the full document") rode the lexical path and
  // confabulated because the incidental word "full" was in the doc's vocabulary, so
  // queryTouchesDoc returned true and the structural skeleton — built to answer exactly
  // this meta-query — was skipped. A scope word is about the ASKING, not the page; it
  // only ever changes routing when the query reduces to meta words alone (a real subject
  // term beside it still keeps the lexical path), and only on a whole-document task.
  'full', 'whole', 'entire', 'complete', 'completely', 'rest', 'remainder', 'remaining',
  'everything', 'else', 'more', 'part', 'parts', 'portion', 'section', 'sections',
  'top', 'bottom', 'beginning', 'start', 'end', 'ending', 'middle', 'further',
  'additional', 'content', 'contents', 'detail', 'details',
]);

// Does the question name anything the document actually spells? Tokenize, drop the meta
// words, and test exact membership in the document's vocabulary. False when the query is
// nothing but question / task words — the meta-query the structural skeleton answers.
export const queryTouchesDoc = (doc, query) => {
  const terms = tok(query).filter(t => !META.has(t));
  if (!terms.length) return false;
  const vocab = docVocab(doc);
  return terms.some(t => vocab.has(t));
};

export const retrieveStructural = (doc, k = 12) => {
  const units = doc.units || doc.sentences || [];
  if (!units.length) return [];
  const sites = siteIndices(doc);
  const usable = (i) => !sites.has(i) && !isBlank(units[i]);

  const picked = new Map();   // idx → score (keep the strongest reason an index was picked)
  const note = (i, score) => { if (usable(i) && (picked.get(i) ?? 0) < score) picked.set(i, score); };

  // The opening — where a document states what it is. The first few usable units, the
  // strongest material for a summary, scored to lead.
  let opened = 0;
  for (let i = 0; i < units.length && opened < 4; i++) {
    if (!usable(i)) continue;
    note(i, 0.9 - opened * 0.05);
    opened++;
  }

  // The section headings — the document's skeleton.
  for (let i = 0; i < units.length; i++) {
    if (isHeading(units[i])) note(i, 0.7);
  }

  // An even spread across the body — representative content the opening and headings miss.
  const stride = Math.max(1, Math.floor(units.length / k));
  for (let i = 0; i < units.length; i += stride) note(i, 0.5);

  return [...picked.entries()]
    .map(([idx, score]) => ({ idx, score, text: units[idx], kind: 'structural', via: 'structural' }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
};
