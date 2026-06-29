// answerable — the answerability gate, in FRONT of the navigate face (spec-planner.md §3).
//
// A grounded system can still lie, and the lie is not a false fact — it is a false
// SHAPE. The worked failure: a directions question against a corpus that holds an
// address, a sentence that the place is seven miles out by a trail, and a map link,
// but NO route. The honest answer is one atom: the sources do not contain the
// directions, here is the address and the link. A shapeless walk instead inflates
// the three thin spans into "Getting there" / "Transportation Options" sections — a
// procedure that does not exist, every word grounded, the shape invented. The void
// gate cannot catch it: the lie is not at the token grain, it is the gap between
// what the question asked for and what the ground can give, papered with grounded
// filler.
//
// So before the walk, read the question and TYPE what it wants — a fact, a
// procedure, a route, a comparison, a definition, a judgment, a list, a summary —
// then ask whether the ground can supply THAT TYPE, not whether it holds anything
// at all. If the wanted type is not a type the ground can supply, the walk does not
// run: the response is the refusal atom and nothing more. The SAME gate licenses the
// follow-up offer — "want me to go deeper on X" is an offer to walk again next turn,
// so it may only name regions the field can actually develop.
//
// Pure, deterministic, no model — the same discipline answerability.md already runs
// on the response, lifted to the SHAPE the question wants. This complements
// surfer/answerable.js (is there ANYTHING here) with the orthogonal question (does
// what is here answer the TYPE asked).

// ── The wanted-type test ─────────────────────────────────────────────────────

export const WANTED_TYPES = Object.freeze([
  'route', 'procedure', 'comparison', 'definition', 'judgment', 'list', 'summary', 'fact',
]);

// Type the question by what it WANTS. Order matters: the more specific patterns
// (a route is a procedure of movement; a definition is a narrowed fact) are tried
// first, and `fact` is the lenient default.
export const classifyWantedType = (question = '') => {
  const q = String(question || '').toLowerCase().trim();
  if (!q) return 'fact';

  if (/\b(directions?|route|how (do|can|would) (i|you|one) (get|drive|travel|walk|navigate)|how to get|get (there|to)\b)/.test(q))
    return 'route';
  if (/\b(how (do|to|can)\b|steps?\b|step[- ]by[- ]step|process\b|procedure\b|instructions?\b|how is .* (made|done))/.test(q))
    return 'procedure';
  if (/\b(compare|comparison|versus|\bvs\b|difference between|differ|better than|worse than|which is (better|worse))/.test(q))
    return 'comparison';
  if (/^(what|whats|what's) (is|are|was|were)\b|\bdefine\b|\bdefinition of\b|\bmeaning of\b|what does .* mean/.test(q))
    return 'definition';
  if (/\b(should\b|is it (good|bad|worth|right|wrong)|do you think|your opinion|evaluate|assess|is .* (better|worth it)|recommend)/.test(q))
    return 'judgment';
  if (/\b(list\b|what are the\b|examples? of\b|enumerate|name (the|some)|which (ones|of))/.test(q))
    return 'list';
  if (/\b(summar(y|ize|ise)|overview|tl;?dr|gist\b|main points|in short)/.test(q))
    return 'summary';
  return 'fact';
};

// ── Does the ground supply that type? ────────────────────────────────────────

// Movement/imperative tokens that mark a route step, and sequence markers that mark
// any procedure step. A `route` needs movement steps; a `procedure` needs sequence
// or imperative steps. Both need at least two — one instruction is not a sequence.
const MOVE_VERB = /\b(turn|head|go|drive|walk|follow|take|continue|merge|exit|proceed|cross|bear|veer|keep|stay|enter|arrive|return)\b/;
const SEQ_MARK = /\b(first|second|third|then|next|after that|afterwards?|finally|lastly|begin by|start by|once you)\b|^\s*\d+[.)]/;
const IMPERATIVE = /^(add|press|click|select|open|close|set|enter|choose|insert|remove|run|install|configure|connect|tap|hold|release|mix|pour|heat|cut|place)\b/;

const stepSpans = (ground, { movement = false } = {}) =>
  (ground || []).filter((s) => {
    const t = String(s?.text || '').trim().toLowerCase();
    if (!t) return false;
    if (movement) return MOVE_VERB.test(t) && /\b(left|right|north|south|east|west|onto|toward|towards|past|until|exit|road|street|highway|mile|block|turn)\b/.test(t);
    return SEQ_MARK.test(t) || IMPERATIVE.test(t);
  });

// Distinct figures (proper nouns) the ground names — the constituents a comparison
// needs two of, with an edge between them.
const distinctFigures = (ground) => {
  const set = new Set();
  for (const s of ground || []) {
    for (const m of String(s?.text || '').match(/\b[A-Z][A-Za-z'’-]{2,}\b/g) || []) set.add(m);
  }
  return set;
};
const CONTRAST = /\b(than|whereas|while|but|however|unlike|compared|more|less|better|worse|faster|slower|larger|smaller)\b/;

// A defining span — one that says what a thing IS, not merely mentions it.
const DEFINING = /\b(is a|is an|is the|are|means|refers to|defined as|known as|consists of|denotes)\b/;

// Does the ground supply the wanted TYPE? Returns { ok, reason } — `reason` names
// what was missing when it does not, so the refusal atom can be specific.
export const groundSupplies = (wantedType, ground = [], graph = null) => {
  const hasContent = (ground || []).some(s => String(s?.text || '').trim().length > 0);
  if (!hasContent) return { ok: false, reason: 'no-ground' };

  switch (wantedType) {
    case 'route': {
      const steps = stepSpans(ground, { movement: true });
      return steps.length >= 2
        ? { ok: true, reason: null }
        : { ok: false, reason: 'no-route' };
    }
    case 'procedure': {
      const steps = stepSpans(ground, { movement: false });
      return steps.length >= 2
        ? { ok: true, reason: null }
        : { ok: false, reason: 'no-procedure' };
    }
    case 'comparison': {
      const figs = distinctFigures(ground);
      const edge = (ground || []).some(s => CONTRAST.test(String(s?.text || '')))
        || (graph && (graph.relations || graph.edges || []).length > 0);
      return figs.size >= 2 && edge
        ? { ok: true, reason: null }
        : { ok: false, reason: 'no-comparison' };
    }
    case 'definition': {
      const def = (ground || []).some(s => DEFINING.test(String(s?.text || '')));
      return def ? { ok: true, reason: null } : { ok: false, reason: 'no-definition' };
    }
    // fact, list, summary, judgment — any real content supplies these; the floor and
    // the void gate catch an invented claim on the way back. Lenient by design: a
    // false refusal of an answerable question is worse than a missed one.
    default:
      return { ok: true, reason: null };
  }
};

// ── The gate ─────────────────────────────────────────────────────────────────

// The phrasing for each unmet type, used in the refusal atom.
const MISSING_PHRASE = Object.freeze({
  'no-route': 'directions or a route',
  'no-procedure': 'step-by-step instructions',
  'no-comparison': 'a comparison',
  'no-definition': 'a definition',
  'no-ground': 'anything on this',
});

// The licensing decision. When a `question` is given, type it and test the ground
// against the type. `licensed:false` carries a `refusal` atom — the response when
// the walk must not run. No question → licensed (nothing to type-test; the loop's
// other stops still apply).
export const answerabilityGate = ({ question = '', ground = [], graph = null } = {}) => {
  if (!question) return { licensed: true, wantedType: null, reason: null, refusal: null };
  const wantedType = classifyWantedType(question);
  const supply = groundSupplies(wantedType, ground, graph);
  if (supply.ok) return { licensed: true, wantedType, reason: null, refusal: null };
  return {
    licensed: false,
    wantedType,
    reason: supply.reason,
    refusal: refusalAtom(supply.reason, ground),
  };
};

// The refusal atom — one unit: the sources do not contain <wanted type>, here is
// what they DO hold. Grounded on the held spans (so it cites, never invents), and
// short by construction (the honest one-sentence answer).
export const refusalAtom = (reason, ground = []) => {
  const phrase = MISSING_PHRASE[reason] || 'what was asked';
  const held = (ground || [])
    .filter(s => String(s?.text || '').trim())
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);
  const sources = held.map(s => s.idx).filter(Number.isInteger);
  const heldText = held.length
    ? ' They do hold: ' + held.map(s => trim(s.text)).join('; ') + '.'
    : '';
  const text = `The sources do not contain ${phrase}.` + heldText;
  return Object.freeze({ refusal: true, reason, text, sources, spans: held });
};

// ── The follow-up offer, gated by the same test ──────────────────────────────

// Regions the field can actually develop next turn — uncovered spans with enough
// mass and content to support a further walk without confabulating. A region the
// ground holds one thin sentence about is NOT developable: offering to go deeper on
// it is an invitation to confabulate, and the gate forbids it.
const DEVELOPABLE_SCORE = 0.4;   // a region thinner than this is not worth offering
const DEVELOPABLE_LEN = 24;      // and one too short to develop is not offered either

export const developableRegions = (ground = [], covered = new Set(), { max = 3 } = {}) => {
  const cov = covered instanceof Set ? covered : new Set(covered || []);
  return (ground || [])
    .map((s, idx) => ({ ...s, idx: s.idx ?? idx }))
    .filter(s => !cov.has(s.idx))
    .filter(s => (s.score || 0) >= DEVELOPABLE_SCORE && String(s.text || '').trim().length >= DEVELOPABLE_LEN)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, max)
    .map(s => ({ idx: s.idx, topic: trim(s.text, 60) }));
};

// The follow-up offer string, or '' when no region is developable (no offer is
// better than an offer to confabulate).
export const followUpOffer = (ground = [], covered = new Set()) => {
  const regions = developableRegions(ground, covered);
  if (!regions.length) return '';
  return 'I can go deeper on: ' + regions.map(r => r.topic).join('; ') + '.';
};

const trim = (s, n = 80) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…';
};
