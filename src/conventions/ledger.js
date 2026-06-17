// The conventions ledger — eoreader3's RULES_LEDGER / conventions.jsonl.
//
// An append-only store of conventions the reader has *learned* about a
// document, each one a REC ("learn a rule") entry. It sits beside the event
// log the way the global ledger sits beside per-doc events: the log is what
// the document said, the ledger is what the reader learned to expect of it.
//
// Conventions are weights, not switches. `isAttributionVerb` answers from the
// learned set unioned with the built-in seed, so a document can extend how
// speech is marked without anyone editing a whitelist. Export is JSONL, the
// same shape as the audit trail — tune the reader against the record.

const SEED_SPEECH = [
  'said', 'says', 'asked', 'replied', 'told', 'cried', 'shouted', 'whispered',
  'muttered', 'answered', 'called', 'exclaimed', 'thought', 'continued', 'added',
];

export const createConventions = () => {
  const rules = [];                 // REC entries, append-only
  const attribution = new Map();    // verb → weight

  for (const v of SEED_SPEECH) attribution.set(v, 0); // seed at zero weight

  const learnAttribution = (token, weight = 1) => {
    attribution.set(token, (attribution.get(token) || 0) + weight);
    rules.push({ op: 'REC', kind: 'attribution-verb', token, weight, t: Date.now() });
  };

  return {
    learnAttribution,
    isAttributionVerb: (v) => attribution.has(String(v || '').toLowerCase()),
    weightOf: (v) => attribution.get(String(v || '').toLowerCase()) || 0,
    get rules() { return rules; },
    get attribution() { return attribution; },
    exportJSONL() { return rules.map(r => JSON.stringify(r)).join('\n'); },
  };
};
