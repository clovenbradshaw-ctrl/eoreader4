// Conversation-aware retrieval — resolve a follow-up against what has been asked.
//
// A grounded follow-up like "now?", "what about her?", or "answer my first question"
// carries no standalone retrieval signal: retrieving on its literal words finds
// sentences containing "now", not the topic the user is pursuing. (In the audit the
// "now?" turn retrieved on the word and missed the thread entirely.) We resolve it by
// folding the recent USER turns' content into the retrieval query.
//
// Only the user's OWN words feed this — never the talker's prior answers. So it adds no
// poisoning: a small model can anchor on its earlier replies only where those replies
// are fed back, and they are not. The user's questions are a different, safe witness
// (the talker/witness split in converse/provenance.js).

// Function words PLUS the deictic / continuation words that carry no topic on their
// own — "now", "again", "go on". A turn made only of these contributes no focus and
// cannot stand alone for retrieval.
const STOP = new Set((
  'a an the and or but if then so of to in on at for with as is are was were be been ' +
  'being do does did done have has had i you he she it we they me him her them my your our ' +
  'this that these those what which who whom whose how why when where will would can ' +
  'could should may might must not no yes ok okay sure thanks thank please just about ' +
  'now then again more next go on continue here there back also too anymore'
).split(/\s+/));

// The content words of a string, in order, deduped — its topic-bearing tokens. Split
// on the apostrophe too, so a possessive yields the bare noun ("gregor's" → "gregor",
// the dangling "s" dropped as length-1) — the form the retriever indexes.
export const contentWords = (s) => {
  const out = [];
  const seen = new Set();
  for (const t of String(s || '').toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (t.length > 1 && !STOP.has(t) && !seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
};

// Does the question stand on its own for retrieval, or does it lean on the conversation?
// Two ways it leans: an explicit reference to the dialogue itself ("my first question",
// "you said", "go on"), or thinness — nothing topic-bearing once stop/deictic words go.
export const needsContext = (question) => {
  const q = String(question || '').toLowerCase();
  if (/\b(my|the|that|your|his|her)\s+(first|last|previous|earlier|other|second|original)\b/.test(q)) return true;
  if (/\byou\s+(said|asked|told|mentioned|answered|wrote)\b/.test(q)) return true;
  if (/\b(answer|address|finish|repeat|reread|re-read)\s+(my|the|that|it|again)\b/.test(q)) return true;
  if (/\bgo\s+(on|ahead)\b|\bcontinue\b|\bgo back\b|\bback to\b|\bwhat about\b/.test(q)) return true;
  return contentWords(q).length === 0;
};

// The salient terms the conversation is about: the recent USER turns, newest first,
// deduped and capped. The retrieval query is augmented with these when the question
// can't stand alone.
export const conversationalFocus = (history = [], { maxTerms = 6, maxTurns = 3 } = {}) => {
  const users = (Array.isArray(history) ? history : []).filter(m => m && m.role === 'user' && m.content);
  const terms = [];
  const seen = new Set();
  for (const m of users.slice(-maxTurns).reverse()) {        // newest user turns first
    for (const t of contentWords(m.content)) {
      if (!seen.has(t)) { seen.add(t); terms.push(t); if (terms.length >= maxTerms) return terms; }
    }
  }
  return terms;
};

// The retrieval query, resolved against the conversation when the question leans on it.
// A self-contained question passes through untouched — never pollute a strong query;
// a thin or self-referential one is augmented with the conversation's focus terms, the
// ORIGINAL question kept so its own words still count.
export const resolveRetrievalQuery = (question, history = []) => {
  if (!needsContext(question)) return question;
  const focus = conversationalFocus(history);
  return focus.length ? `${question} ${focus.join(' ')}` : question;
};
