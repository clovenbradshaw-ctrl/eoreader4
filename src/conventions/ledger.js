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

// The relation-type vocabulary (move 3): the open verb on a bond → a small CLOSED
// set of predicate types, the comparable grouping key the graph pivot reads next.
// `speech` is the attribution register (already → SIG), so it is not duplicated here;
// the rest are seeded and, like every register, learnable later. Typing is ADDITIVE:
// a verb outside the table is honestly untyped (relationType → null) and its bond
// still stands — never a drop, so recall is unchanged. The boilerplate the acceptance
// names (`day`, `he`, `probably`) never reaches here: it is stepped over as a modifier
// or fails the recurrence gate before it can be a relation.
export const SEED_RELATION_TYPES = Object.freeze({
  motion: ['crawled', 'crawl', 'crawls', 'crawling', 'ran', 'run', 'runs', 'running',
    'walked', 'walk', 'walks', 'walking', 'jumped', 'jump', 'climbed', 'climb', 'rushed',
    'rush', 'fled', 'flee', 'moved', 'move', 'moves', 'turned', 'turn', 'rose', 'rise',
    'fell', 'fall', 'came', 'come', 'comes', 'went', 'go', 'goes', 'entered', 'enter',
    'left', 'leave', 'leaves', 'approached', 'approach', 'crept', 'creep', 'slipped',
    'slip', 'flew', 'fly', 'dragged', 'drag', 'pushed', 'push', 'pulled', 'pull',
    'rolled', 'roll', 'marched', 'march', 'stepped', 'step', 'hurried', 'hurry',
    'wandered', 'wander', 'followed', 'follow', 'chased', 'chase', 'escaped', 'escape',
    'returned', 'return', 'arrived', 'arrive', 'departed', 'depart'],
  perception: ['saw', 'see', 'sees', 'seeing', 'looked', 'look', 'looks', 'looking',
    'watched', 'watch', 'watches', 'heard', 'hear', 'hears', 'noticed', 'notice',
    'observed', 'observe', 'stared', 'stare', 'glanced', 'glance', 'felt', 'feel',
    'feels', 'smelled', 'smell', 'gazed', 'gaze', 'beheld', 'behold', 'spotted', 'spot',
    'glimpsed', 'glimpse', 'sensed', 'sense'],
  possession: ['held', 'hold', 'holds', 'holding', 'carried', 'carry', 'carries',
    'owned', 'own', 'owns', 'kept', 'keep', 'keeps', 'grasped', 'grasp', 'grabbed',
    'grab', 'seized', 'seize', 'clutched', 'clutch', 'gripped', 'grip', 'took', 'take',
    'takes', 'brought', 'bring', 'wore', 'wear', 'wears', 'possessed', 'possess', 'bore',
    'bears', 'dropped', 'drop'],
  spatial: ['stood', 'stand', 'stands', 'standing', 'sat', 'sit', 'sits', 'sitting',
    'lay', 'lie', 'lies', 'lying', 'hung', 'hang', 'hangs', 'lived', 'live', 'lives',
    'remained', 'remain', 'rested', 'rest', 'perched', 'perch', 'leaned', 'lean',
    'leant', 'filled', 'fill', 'covered', 'cover'],
  affect: ['feared', 'fear', 'fears', 'loved', 'love', 'loves', 'hated', 'hate', 'hates',
    'liked', 'like', 'likes', 'wanted', 'want', 'wants', 'hoped', 'hope', 'hopes',
    'wished', 'wish', 'dreaded', 'dread', 'enjoyed', 'enjoy', 'missed', 'miss', 'trusted',
    'trust', 'admired', 'admire', 'envied', 'envy', 'pitied', 'pity', 'needed', 'need'],
  communication: ['wrote', 'write', 'writes', 'called', 'call', 'calls', 'signalled',
    'signaled', 'signal', 'greeted', 'greet', 'greets', 'nodded', 'nod', 'waved', 'wave',
    'beckoned', 'beckon', 'summoned', 'summon', 'knocked', 'knock'],
  // Kinship / social role bonds (via = the kin noun on a kinship CON or a derived
  // descriptor edge). The fine sibling/parent split stays the read-layer bridge's
  // job; here it is the coarse bucket the graph groups on.
  kinship: ['father', 'mother', 'sister', 'brother', 'son', 'daughter', 'wife',
    'husband', 'parents', 'parent', 'uncle', 'aunt', 'cousin', 'nephew', 'niece',
    'grandfather', 'grandmother', 'sibling', 'child', 'spouse', 'dad', 'mom', 'friend',
    'master', 'servant', 'boss', 'chief', 'partner', 'neighbour', 'neighbor',
    'colleague', 'lover', 'fiance', 'fiancee'],
});

// token → bucket, built once. The attribution register supplies `speech` at lookup
// time (so a document's LEARNED speech verbs type as speech too), so it is not folded
// in here; the first writer wins on any incidental overlap.
const RELATION_TYPE = new Map();
for (const [bucket, toks] of Object.entries(SEED_RELATION_TYPES))
  for (const t of toks) if (!RELATION_TYPE.has(t)) RELATION_TYPE.set(t, bucket);

// Prepositions — a name just after one is the object of the preposition, a
// participant in a proposition ("unto Noah", "to Abraham"). Read by entity
// admission to weigh a sighting's referential gravity. Seeded, learnable.
export const SEED_PREPOSITION = Object.freeze([
  'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'into', 'onto', 'upon', 'over',
  'under', 'through', 'after', 'before', 'between', 'among', 'against', 'about', 'as',
  'unto', 'toward', 'towards', 'for', 'near', 'beside', 'within', 'without', 'beyond',
  'beneath', 'above', 'below', 'behind', 'around', 'past',
]);

// Auxiliaries / copulas as a set — a name immediately before one is the SUBJECT of
// a predication ("Alice is a baker", "Sarah shall bear"). Copulas keep their own
// register (SEED_COPULA); these add the modal/have/do auxiliaries, incl. archaic.
export const SEED_AUXILIARY = Object.freeze([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'shall', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can',
  'hath', 'hast', 'doth', 'dost', 'art', 'wast', 'wilt', 'shalt',
]);

// Role / kin / naming words that, sitting just before a name, make it an apposition
// bearer or possessed referent ("his son Seth", "named Eve", "Abram's wife Sarah").
export const SEED_ROLE = Object.freeze([
  'son', 'sons', 'daughter', 'daughters', 'father', 'mother', 'brother', 'brethren',
  'sister', 'sisters', 'wife', 'wives', 'husband', 'child', 'children', 'firstborn',
  'seed', 'name', 'named', 'called', 'uncle', 'aunt', 'cousin', 'nephew', 'niece',
  'his', 'her', 'their', 'my', 'thy', 'our', 'your', 'thine',
]);

// Closed-class words that are never a content head — so a name beside one is not
// thereby a verb's argument. The union of the function categories; a word may sit in
// several registers, which is fine — they answer different questions.
export const SEED_FUNCTION = Object.freeze([
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'and', 'or', 'but', 'nor', 'so', 'yet',
  'he', 'she', 'it', 'they', 'we', 'i', 'you', 'him', 'them', 'us', 'me', 'thee',
  'thou', 'ye', 'who', 'whom', 'whose', 'which', 'what', 'his', 'her', 'its', 'their',
  'our', 'my', 'your', 'thy', 'thine', 'mine', 'hers', 'ours', 'yours',
  'there', 'then', 'now', 'here', 'very', 'not', 'also', 'thus', 'lo', 'behold',
  'yea', 'nay', 'verily', 'when', 'where', 'why', 'how', 'if', 'because', 'while',
  'though', 'although', 'until', 'unless', 'whether', 'else', 'ever', 'never',
  ...SEED_PREPOSITION, ...SEED_AUXILIARY,
]);

// Sentence-opening words that begin a clause but name no one — stripped from a
// candidate phrase before admission so "Then Alice" admits "Alice". Early-modern
// openers (Behold, Lo, Verily, Hast, Thou) belong here too: they are the KJV
// equivalents of "Then"/"He"/"Can", and without them clause-openers masquerade as
// characters. Seeded; a corpus can teach its own.
export const SEED_STARTER = Object.freeze([
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'then', 'now', 'here', 'there', 'when', 'where', 'why', 'how', 'what', 'who', 'whom', 'which',
  'yes', 'no', 'maybe', 'perhaps', 'otherwise', 'also', 'however', 'indeed', 'still', 'yet',
  'but', 'and', 'so', 'or', 'nor', 'for', 'because', 'although', 'while', 'since', 'as',
  'in', 'on', 'at', 'to', 'from', 'by', 'with', 'of', 'up', 'down', 'over', 'under', 'into', 'out',
  'if', 'unless', 'until', 'once', 'just', 'only', 'even', 'soon', 'again', 'almost', 'nearly',
  'suddenly', 'finally', 'meanwhile', 'nevertheless', 'therefore', 'thus', 'hence', 'anyway',
  'well', 'oh', 'ah', 'eh', 'alas', 'look', 'listen',
  'can', 'could', 'would', 'should', 'shall', 'will', 'may', 'might', 'must', 'let',
  'do', 'does', 'did', 'have', 'has', 'had', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'not', 'never', 'always', 'often', 'sometimes',
  'thou', 'thee', 'thy', 'thine', 'ye', 'behold', 'lo', 'verily', 'yea', 'nay',
  'hast', 'hath', 'doth', 'dost', 'art', 'wast', 'wilt', 'shalt', 'unto',
]);

const SEEDS = {
  'attribution-verb': SEED_SPEECH,
  'abbreviation': SEED_ABBREVIATIONS,
  'copula': SEED_COPULA,
  'modifier': SEED_MODIFIER,
  'preposition': SEED_PREPOSITION,
  'auxiliary': SEED_AUXILIARY,
  'role': SEED_ROLE,
  'function': SEED_FUNCTION,
  'starter': SEED_STARTER,
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
    // Registers entity admission reads to weigh a sighting's referential gravity.
    isPreposition: (v) => has('preposition', v),
    isAuxiliary: (v) => has('auxiliary', v) || has('copula', v),
    isRole: (v) => has('role', v),
    isFunction: (v) => has('function', v),
    isStarter: (v) => has('starter', v),
    // Type a relation predicate to its closed-vocab bucket (move 3), or null when it
    // is outside the table — additive, never a drop. Speech is read live from the
    // attribution register so a learned speech verb types as `speech` too.
    relationType: (v) => {
      const t = norm(v);
      if (!t) return null;
      if (has('attribution-verb', t)) return 'speech';
      return RELATION_TYPE.get(t) || null;
    },
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
