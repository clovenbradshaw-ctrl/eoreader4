// The conventions ledger — eoreader3's RULES_LEDGER / conventions.jsonl.
//
// This is the home for the language-specific stuff. The parser and the splitter
// hold NO word-lists of their own; they READ from here. Each convention is seeded
// (a DEF, the established starting rule) and learnable (a REC, the document
// teaching the reader its own dialect — a sci-fi text whose dialogue runs on
// "pinged", a journal whose "Inst." is no sentence end). The high (a learned rule)
// sets the probabilities for the low (how the next thousand sentences segment and
// classify). Nothing is hard-coded true; a convention is whatever the language is,
// seeded, and whatever the text keeps doing, learned.
//
// The registers, all the same shape:
//   attribution  verbs that mark speech → SIG          (said, asked, pinged)
//   abbreviation tokens whose '.' is not a boundary    (Mr, Mrs, Dr, St)        → splitter
//   copula       linking verbs → DEF, never a relation (is, am, was, been)      → verb guard
//   modifier     adverbs/intensifiers/auxiliaries to   (much, more, quite, had) → verb guard
//                step over before the head verb        the ReVerb skip-list, by hand
// A consumer asks `is<Register>`; the ledger answers from seed ∪ learned.

export const SEED_SPEECH = Object.freeze([
  'said', 'says', 'say', 'asked', 'asks', 'replied', 'replies', 'told', 'tells',
  'cried', 'cries', 'shouted', 'whispered', 'muttered', 'answered', 'answers',
  'called', 'calls', 'exclaimed', 'declared', 'added', 'continued', 'thought',
  'thinks', 'wondered', 'murmured', 'repeated', 'insisted', 'remarked',
  'observed', 'screamed', 'begged', 'urged', 'warned', 'promised', 'admitted',
  'confessed', 'announced', 'wrote', 'writes',
]);

// A period after one of these (or a single capital initial, handled at the
// splitter) abbreviates; it is not a sentence end.
export const SEED_ABBREVIATIONS = Object.freeze([
  'mr', 'mrs', 'ms', 'dr', 'st', 'mt', 'messrs', 'mme', 'mlle',
  'prof', 'rev', 'hon', 'capt', 'col', 'gen', 'sgt', 'lt', 'cmdr', 'sr', 'jr',
  'esq', 'co', 'inc', 'ltd', 'no', 'vol', 'pp', 'rd', 'ave', 'fig',
  'vs', 'etc', 'al', 'eg', 'ie', 'cf', 'viz',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
]);

// Copulas link a subject to a predicate — a DEF on one referent, never a relation
// between two. Separated from the transitive case by construction (ClausIE's SVC),
// not swept into it. (eoreader4 had only is/are/was/were/be/been — "am" leaked
// through as a relation verb; here it is named.)
export const SEED_COPULA = Object.freeze([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
]);

// The skip-list: adverbs, intensifiers, and auxiliaries that sit before the head
// verb. ReVerb's relation-phrase constraint, by hand — step over these to find the
// real predicate, and if what remains is a copula or not verb-headed, emit no edge.
// Includes the intensifiers eoreader4 was missing (much, more, rather, quite, …)
// that let "Much --more--> Caroline" through.
export const SEED_MODIFIER = Object.freeze([
  // adverbs of time/manner/degree
  'then', 'now', 'also', 'just', 'once', 'soon', 'suddenly', 'slowly', 'quietly',
  'gently', 'again', 'still', 'only', 'even', 'simply', 'quickly', 'immediately',
  'finally', 'however', 'never', 'always', 'often', 'already', 'almost', 'nearly',
  'merely', 'truly', 'indeed', 'perhaps', 'really', 'quite', 'rather', 'very',
  'much', 'more', 'most', 'less', 'so', 'too', 'such', 'thus', 'hence',
  // auxiliaries / modals
  'had', 'has', 'have', 'having', 'would', 'could', 'will', 'shall', 'should',
  'did', 'does', 'do', 'not', 'must', 'might', 'may', 'can',
]);

const SEEDS = {
  'attribution-verb': SEED_SPEECH,
  'abbreviation': SEED_ABBREVIATIONS,
  'copula': SEED_COPULA,
  'modifier': SEED_MODIFIER,
};

export const createConventions = () => {
  const rules = [];                 // learned REC entries, append-only (→ the doc log)
  const reg = {};                   // kind → Map(token → weight)
  const learned = new Set();        // 'kind:token' the document taught (vs seed)
  for (const [kind, seed] of Object.entries(SEEDS)) {
    reg[kind] = new Map(seed.map((t) => [t, 0]));
  }
  const norm = (v) => String(v || '').toLowerCase().replace(/\.$/, '');

  const learn = (kind, token, weight = 1) => {
    const t = norm(token);
    if (!reg[kind]) reg[kind] = new Map();
    reg[kind].set(t, (reg[kind].get(t) || 0) + weight);
    learned.add(`${kind}:${t}`);
    rules.push({ op: 'REC', kind, token: t, weight, t: Date.now() });
  };
  const has = (kind, v) => !!reg[kind] && reg[kind].has(norm(v));

  return {
    learn,
    learnAttribution: (token, weight = 1) => learn('attribution-verb', token, weight),
    learnAbbreviation: (token, weight = 1) => learn('abbreviation', token, weight),
    isAttributionVerb: (v) => has('attribution-verb', v),
    isAbbreviation: (v) => has('abbreviation', v),
    isCopula: (v) => has('copula', v),
    isModifier: (v) => has('modifier', v),
    weightOf: (v) => reg['attribution-verb'].get(norm(v)) || 0,
    get rules() { return rules; },
    get attribution() { return reg['attribution-verb']; },
    get abbreviation() { return reg['abbreviation']; },
    // The full language spec — conventions.jsonl. A line per convention, DEF for
    // the seed it started from, REC for what the document taught. This is where the
    // language-specific stuff lives; the parser and splitter only read it.
    exportJSONL() {
      const out = [];
      for (const [kind, m] of Object.entries(reg))
        for (const [token, weight] of m)
          out.push(JSON.stringify({ op: learned.has(`${kind}:${token}`) ? 'REC' : 'DEF', kind, token, weight }));
      return out.join('\n');
    },
  };
};
