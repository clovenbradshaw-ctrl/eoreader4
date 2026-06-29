// The proposition channel — the claim-grain veto for DEF predications (the P2
// channel the edge-grounding veto left open).
//
// The edge veto (correspond.js) parses the talker's prose into CON/SIG EDGES and
// checks each against the document graph. It is, by construction, EDGES-ONLY: a
// single-argument predication — "O'Connell is a council member" — has no second
// entity, produces no edge, and slips the check whole. That is exactly the miss
// this closes: a deep-research answer called Freddie O'Connell "a Metro Council
// member" while the very sources it stood on say "Mayor Freddie O'Connell". The
// stale role survived because nothing evaluated the PROPOSITION the answer made
// about a single figure.
//
// This channel does for DEF propositions what correspond.js does for edges:
//
//   1. EVALUATE every proposition the answer asserts — parseProps reads the
//      talker's prose into resolved props (the same parser the page is read with),
//      and this channel takes the DEF (one-place, subject + predicate) ones the
//      edge channel cannot see.
//   2. CHECK each against the SOURCES AT THE CORRECT CURSOR — the document's own
//      DEF propositions are read sentence-by-sentence, EACH at the cursor where it
//      sits, so "as a council member, he WAS a critic" (a past frame at its own
//      line) is read as a FORMER role, distinct from "he IS the mayor" read at the
//      line that asserts it. A claim is graded against the source reading that
//      governs it, not against a bag of words pooled across the corpus.
//
// The new verdicts, beside corroborated / unsupported:
//
//   superseded  the answer asserts an exclusive OFFICE (mayor, council member,
//               governor, …) as current, but the sources currently witness a
//               DIFFERENT exclusive office for the same person and do NOT currently
//               witness the claimed one. The role the answer gives has been
//               succeeded — the O'Connell catch. Flag-and-tell with the current
//               office and its citation, never a substitution.
//   stale       the answer asserts an office as current, but the sources mark that
//               same office as FORMER and do not currently witness it ("former
//               council member" against "is a council member").
//
// Like the edge veto this is a correspondence between two readings, never a claim
// against truth (edge-grounding.md): it makes the answer faithful to the sources at
// the cursor, not the sources faithful to the world. And it is conservative by
// construction — supersession fires only between offices a person holds ONE of at a
// time, only when the current office is positively witnessed, and only when the
// answer asserts the stale role AS current. False negatives (a title outside the
// exclusive set, a person sharing a surname) are the honest seam; a false refusal
// is the thing it must never do, so it only ever flags.

import { parseProps }          from '../enactor/props.js';
import { parseText }           from '../perceiver/parse/index.js';
import { attributesConflict }  from '../core/index.js';

// ── The office lexicon ──────────────────────────────────────────────────────
//
// Two tiers. EXCLUSIVE offices are seats a person holds one of at a time within a
// body — a transition between them (council member → mayor) is precisely the
// supersession this catches, so a conflict between two distinct exclusive heads is
// real. The broader OFFICE set is every title we RECOGNISE as a role (so a DEF
// naming one is graded as an office claim, corroborated or not), but a clash among
// these never supersedes — "chair", "director", "founder" co-occur freely.

// Multiword phrases → a single canonical head, longest first so "vice president"
// is read before "president". The value is `[canonical, exclusive]`.
const OFFICE_PHRASES = [
  ['city council member', ['councilmember', true]],
  ['council member',      ['councilmember', true]],
  ['prime minister',      ['prime-minister', true]],
  ['vice president',      ['vice-president', true]],
  ['lieutenant governor', ['lieutenant-governor', true]],
  ['attorney general',    ['attorney-general', true]],
  ['secretary of state',  ['secretary-of-state', true]],
  ['district attorney',   ['district-attorney', true]],
  ['chief justice',       ['chief-justice', true]],
  ['chief executive officer', ['ceo', true]],
  ['chief executive',     ['ceo', true]],
  ['head coach',          ['head-coach', true]],
  ['deputy mayor',        ['deputy-mayor', false]],   // a distinct seat from mayor — recognised, never supersedes it
  ['press secretary',     ['press-secretary', false]],
  ['executive director',  ['executive-director', false]],
  ['managing director',   ['managing-director', false]],
  ['editor in chief',     ['editor-in-chief', false]],
];

// Single-token offices → [canonical, exclusive]. Council variants collapse to the
// one seat; the exclusive tier is kept tight (clearly one-per-person seats) so a
// supersession is never minted between titles that genuinely co-occur.
const OFFICE_TOKENS = new Map([
  ['mayor', ['mayor', true]], ['governor', ['governor', true]],
  ['councilmember', ['councilmember', true]], ['councilman', ['councilmember', true]],
  ['councilwoman', ['councilmember', true]], ['councilor', ['councilmember', true]],
  ['councillor', ['councilmember', true]], ['councilperson', ['councilmember', true]],
  ['alderman', ['alderman', true]], ['alderwoman', ['alderman', true]],
  ['supervisor', ['supervisor', true]], ['senator', ['senator', true]],
  ['congressman', ['representative', true]], ['congresswoman', ['representative', true]],
  ['representative', ['representative', true]], ['delegate', ['delegate', true]],
  ['assemblyman', ['assemblyman', true]], ['assemblywoman', ['assemblyman', true]],
  ['president', ['president', true]], ['chancellor', ['chancellor', true]],
  ['premier', ['premier', true]], ['taoiseach', ['taoiseach', true]],
  ['sheriff', ['sheriff', true]], ['ambassador', ['ambassador', true]],
  ['king', ['king', true]], ['queen', ['queen', true]], ['emperor', ['emperor', true]],
  ['empress', ['empress', true]], ['pope', ['pope', true]], ['premier', ['premier', true]],
  // Recognised offices that DO NOT supersede (co-occurring titles).
  ['chair', ['chair', false]], ['chairman', ['chair', false]], ['chairwoman', ['chair', false]],
  ['chairperson', ['chair', false]], ['director', ['director', false]], ['chief', ['chief', false]],
  ['ceo', ['ceo', true]], ['cfo', ['cfo', false]], ['cto', ['cto', false]],
  ['dean', ['dean', false]], ['principal', ['principal', false]], ['commissioner', ['commissioner', false]],
  ['superintendent', ['superintendent', false]], ['founder', ['founder', false]],
  ['owner', ['owner', false]], ['publisher', ['publisher', false]], ['editor', ['editor', false]],
  ['treasurer', ['treasurer', false]], ['secretary', ['secretary', false]],
  ['minister', ['minister', false]], ['coach', ['coach', false]], ['captain', ['captain', false]],
  ['judge', ['judge', false]], ['justice', ['justice', false]], ['professor', ['professor', false]],
]);

const ALL_OFFICE_TOKENS = new Set(OFFICE_TOKENS.keys());
for (const [phrase] of OFFICE_PHRASES) for (const t of phrase.split(' ')) ALL_OFFICE_TOKENS.add(t);

// Honorifics and qualifiers dropped when reading a person's name out of a label, so
// "Mayor Freddie O'Connell" / "former O'Connell" / "the O'Connell" all key on the
// surname. Office tokens are dropped too (the title is not the name).
const NAME_NOISE = new Set([
  'mr', 'mrs', 'ms', 'miss', 'dr', 'sir', 'lord', 'lady', 'rev', 'hon', 'sen', 'rep', 'gov',
  'former', 'ex', 'onetime', 'one-time', 'erstwhile', 'outgoing', 'then', 'sometime', 'late',
  'retired', 'previous', 'incoming', 'acting', 'interim', 'earlier', 'later', 'now', 'current',
  'the', 'a', 'an', 'metro', 'city', 'county', 'state', 'us', 'u.s', 'new',
]);

// A value-level FORMER marker — the role itself is qualified as past ("a former
// council member", "the onetime mayor").
const FORMER_VALUE = /\b(former|ex|onetime|one-time|erstwhile|outgoing|sometime|previous|retired|then)\b/i;
// A surface-level past frame around the predication, absent a "now/currently" pull.
const FORMER_SURFACE = /\b(was|were|had been|used to|no longer|previously|formerly|stepped down|resigned|ousted|until)\b/i;
const PRESENT_NOW = /\b(now|currently|today|presently|these days)\b/i;

const lower = (s) => String(s ?? '').toLowerCase();
const tokens = (s) => lower(s).split(/[^a-z0-9']+/).filter(Boolean);

// The SPACE axis. A seat is bound to a jurisdiction — "mayor OF NASHVILLE", "council
// member IN SALT LAKE CITY". readPlace lifts that proper-noun place so a role can be
// grounded against WHERE, not just who and when: a Nashville council membership is a
// different fact from a Salt Lake City one, and one must never corroborate the other.
// Generic administrative words (metro, city, county) are NOT places — "a Metro Council
// member" carries no jurisdiction, so it can't false-mismatch a "Nashville" mention.
const GENERIC_PLACE = new Set(['metro', 'city', 'county', 'state', 'district', 'town', 'borough', 'council', 'the', 'us', 'usa', 'national']);
const PLACE_OF = /\b(?:of|in|for|from)\s+(?:the\s+)?([A-Z][A-Za-z.'’-]+(?:\s+(?:of\s+)?[A-Z][A-Za-z.'’-]+){0,3})/;
const readPlace = (value) => {
  const m = String(value || '').match(PLACE_OF);
  if (!m) return null;
  const p = m[1].toLowerCase().replace(/\./g, '').trim();
  return (!p || GENERIC_PLACE.has(p)) ? null : p;
};

// readOffice(value) → { head, exclusive, former, place } | null. Find the office a
// predicate value names (multiword first), whether the value marks it former, and the
// jurisdiction it is bound to (the space axis), if any.
export const readOffice = (value) => {
  const v = lower(value);
  if (!v) return null;
  const former = FORMER_VALUE.test(v);
  const place = readPlace(value);
  for (const [phrase, [head, exclusive]] of OFFICE_PHRASES) {
    if (v.includes(phrase)) return { head, exclusive, former, place };
  }
  for (const t of tokens(v)) {
    const hit = OFFICE_TOKENS.get(t);
    if (hit) return { head: hit[0], exclusive: hit[1], former, place };
  }
  return null;
};

// The person a label is about — its surname token, with titles, honorifics and
// time-qualifiers stripped. The bridge across name variants ("Freddie O'Connell",
// "O'Connell", "Mayor Freddie O'Connell") that separate admissions would otherwise
// key on different ids. Conservative: a shared surname is taken as the same person,
// which is the honest seam (two distinct people sharing a surname would merge here).
export const personKey = (label) => {
  // Apostrophes are stripped, not split on, so "O'Connell" / "O’Connell" (curly) /
  // "OConnell" all key on one surname — the variant the real failure turned on.
  const ts = lower(label).replace(/['’]/g, '').split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !NAME_NOISE.has(t) && !ALL_OFFICE_TOKENS.has(t));
  return ts.length ? ts[ts.length - 1] : null;
};

// defTense(surface, value) → 'former' | 'current'. The role is FORMER when the value
// marks it past, or the surface clause sits in a past frame with no present pull.
const defTense = (surface, value) => {
  if (FORMER_VALUE.test(lower(value))) return 'former';
  if (FORMER_SURFACE.test(surface) && !PRESENT_NOW.test(surface)) return 'former';
  return 'current';
};

// The CORROBORATION axis — "appears once" is not a fact. A witness is a (source · text)
// pair, and two witnesses are THE SAME witness when they come from the same source OR
// say the same thing verbatim — syndicated wire copy on three sites is one witness, not
// three. `meaningfulSupport` collapses those and returns the count of genuinely
// independent supports, so the audit can ask the user's question: are there ≥2
// meaningfully-different sources, or is this resting on a single mention?
const SUPPORT_STOP = new Set('the a an of to in on for and or but is are was were be been with as at by from this that his her their its he she they it him them who whom whose when where why which how not no into over under more most some any all said says say now then'.split(' '));
const contentWords = (t) => new Set(lower(t).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 3 && !SUPPORT_STOP.has(w)));
const nearDuplicate = (a, b) => {
  const A = contentWords(a), B = contentWords(b);
  if (!A.size || !B.size) return false;
  let inter = 0; for (const w of A) if (B.has(w)) inter += 1;
  return inter / (A.size + B.size - inter) >= 0.7;   // Jaccard ≥ .7 → the same statement reworded or copied
};
export const meaningfulSupport = (supports = []) => {
  const witnesses = [];
  for (const s of supports) {
    if (witnesses.some(w => (w.source && w.source === s.source) || nearDuplicate(w.text, s.text))) continue;
    witnesses.push(s);
  }
  return witnesses.length;
};

// The source a composite sentence came from — its origin doc id, so two supports can be
// told apart by WHERE they were read, not just THAT they were read. Falls back to the
// single doc's url/id when the doc is not a composite.
const sourceAt = (doc, sentIdx) =>
  (typeof doc?.origin === 'function' && doc.origin(sentIdx)?.docId) || doc?.web?.url || doc?.docId || null;

// documentOffices(doc) → Map<personKey, { current: Map<head,fact>, former: Map<head,fact> }>.
//
// The sources' OWN office propositions, RESOLVED THROUGH THE REFERENTS (parseProps reads
// each clause's subject through the document field, so "he is the mayor" binds to the
// hot referent, not a surface string) and read EACH at the cursor where it sits — the
// "correct cursor", so a past frame reads former. Folded by person across sources, with
// every fact carrying its WHERE (places) and its WITNESSES (source · text), so the three
// axes — identity, space, time — and corroboration are all available to the verdict.
//
// A `fact` is { sentIdx, value, exclusive, places:Set, supports:[{source,text}], referents:Set }.
export const documentOffices = (doc) => {
  const out = new Map();
  if (!doc?.admission) return out;
  const at = (pk) => out.get(pk) || out.set(pk, { current: new Map(), former: new Map() }).get(pk);
  const record = (pk, referent, office, tense, sentIdx, value, text) => {
    if (!pk || !office) return;
    const slot = tense === 'former' ? at(pk).former : at(pk).current;
    let f = slot.get(office.head);
    if (!f) { f = { sentIdx, value, exclusive: office.exclusive, places: new Set(), supports: [], referents: new Set() }; slot.set(office.head, f); }
    if (office.place) f.places.add(office.place);
    if (referent != null) f.referents.add(referent);
    f.supports.push({ source: sourceAt(doc, sentIdx), text: text || value || '' });
  };

  // DEF predicates, sentence by sentence, at the correct cursor — subject resolved to its
  // referent by parseProps (the identity axis), tense read from the clause (the time axis).
  const sentences = doc.sentences || [];
  for (let i = 0; i < sentences.length; i++) {
    for (const p of parseProps(sentences[i], doc, i)) {
      if (p.kind !== 'def') continue;
      const office = readOffice(p.attr?.value);
      if (!office) continue;
      const pk = personKey(doc.admission.labelOf?.(p.subj) || p.subj);
      record(pk, p.subj, office, defTense(p.surface || sentences[i], p.attr?.value), i, p.attr?.value, p.surface || sentences[i]);
    }
  }

  // Appositive titles carried in the entity label ("Mayor Freddie O'Connell") — the
  // referent is the admitted id itself, a present descriptor unless marked former.
  for (const [label, id] of (doc.admission.admitted || [])) {
    const office = readOffice(label);
    if (!office) continue;
    const sentIdx = (doc.mentions?.get(id) || [])[0] ?? null;
    record(personKey(label), id, office, FORMER_VALUE.test(lower(label)) ? 'former' : 'current', sentIdx, label, sentences[sentIdx] || label);
  }
  return out;
};

const cite = (c) => (c && c.sentIdx != null) ? `s${c.sentIdx}` : null;

// answerDefs(prose, doc, cursor) → the DEF propositions the ANSWER asserts, each as
// { value, surface, personKey, subj }. Read two ways and unioned, because the answer's
// subject can be either a figure the SOURCES admit (resolve it through the document
// field — the path that also binds a pronoun "he is the mayor" to the hottest source
// referent) OR a name the sources never admitted as that exact string ("Freddie
// O'Connell" when the corpus only ever wrote "Mayor O'Connell"). Parsing the answer as
// its own doc recovers the latter; the surname `personKey` is what reconciles the two
// to one person. Deduped by (person · value).
const answerDefs = (prose, doc, cursor) => {
  const rows = [];
  const add = (subj, value, surface, label) => {
    const pk = personKey(label || subj);
    rows.push({ subj, value: value || '', surface: surface || '', personKey: pk, label: label || subj });
  };
  for (const p of parseProps(prose, doc, cursor)) {
    if (p.kind === 'def') add(p.subj, p.attr?.value, p.surface, doc.admission.labelOf?.(p.subj));
  }
  // The answer parsed standalone — its own admission, so a named subject the corpus
  // never wrote verbatim still yields its DEF claim.
  try {
    const self = parseText(prose, { docId: 'answer' });
    for (const p of parseProps(prose, self, Infinity)) {
      if (p.kind === 'def') add(p.subj, p.attr?.value, p.surface, self.admission.labelOf?.(p.subj));
    }
  } catch { /* a malformed answer parse must never break the audit */ }
  const seen = new Set();
  return rows.filter(r => {
    const key = `${r.personKey || r.subj}::${lower(r.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// auditPropositions({ prose, doc, cursor }) → the per-proposition record + a
// flag-and-tell `fired` list for the surfacing layer.
//
//   verdicts  one row per DEF proposition the answer asserts: { subj, value, office,
//             verdict, reason, citation, supersededBy?, correction? }
//   superseded the rows whose role the sources have succeeded or marked former — the
//             actionable catch, also surfaced as `fired` (never refusing).
//   corrections short human strings ("the sources give O'Connell's current office as
//             mayor [s3]") for the answer's annotation.
//
// Edges (CON/SIG) are the edge channel's domain (correspond.js) and are not graded
// here — this is the DEF half, deliberately non-overlapping.
export const auditPropositions = ({ prose, doc, cursor = Infinity } = {}) => {
  const empty = { verdicts: [], superseded: [], corrections: [], fired: [], counts: { corroborated: 0, unsupported: 0, superseded: 0, stale: 0 } };
  if (!doc?.admission || !prose) return empty;

  const offices = documentOffices(doc);
  const verdicts = [];

  for (const claim of answerDefs(prose, doc, cursor)) {
    const { value, surface, personKey: pk, subj } = claim;
    // Prefer a real surface name for the correction: the source's label for this
    // person, else the name the answer itself wrote.
    const label = (pk && labelForPerson(doc, pk)) || claim.label || subj;
    const office = readOffice(value);
    const docFacts = pk ? offices.get(pk) : null;

    // A NON-office predicate is outside this channel's reach (no exclusive-slot
    // semantics to grade it by) — recorded, unwitnessed, never fired.
    if (!office) {
      verdicts.push({ subj, value, office: null, verdict: 'unsupported', reason: 'no-office-claim', citation: null, surface });
      continue;
    }

    const assertedCurrent = !office.former && defTense(surface, value) === 'current';

    // SPACE — the answer binds the role to a jurisdiction the sources never bind it to.
    // A Nashville council membership is not a Salt Lake City one; "he was never a council
    // member in Salt Lake City" is a wrong-place claim even if the role name matches.
    // Compared across BOTH tenses for this person, so a misplaced role is caught however
    // the answer dates it. Only fires when both sides carry a proper place that disagree.
    if (office.place && docFacts) {
      const matched = [docFacts.current.get(office.head), docFacts.former.get(office.head)].filter(Boolean);
      const docPlaces = new Set(matched.flatMap(f => [...f.places]));
      if (docPlaces.size && !docPlaces.has(office.place)) {
        const where = [...docPlaces][0];
        const correction = `the sources place ${displayName(label)}'s ${office.head.replace(/-/g, ' ')} in ${titleCasePlace(where)}, not ${titleCasePlace(office.place)}`;
        verdicts.push({ subj, value, office: office.head, place: office.place, verdict: 'place-mismatch', reason: 'wrong-jurisdiction', citation: cite(matched[0]), docPlaces: [...docPlaces], correction, surface });
        continue;
      }
    }

    // Is this exact office currently witnessed for this person? Then it STANDS — but with
    // its corroboration weight: how many MEANINGFULLY-DIFFERENT sources back it. One
    // mention is `single-source` (a hedge, and the trigger to go seek a second); ≥2
    // independent, non-duplicate witnesses is `corroborated`. "Appears once" is reported
    // as exactly that, never laundered into a flat fact.
    if (docFacts?.current?.has(office.head)) {
      const f = docFacts.current.get(office.head);
      const support = meaningfulSupport(f.supports);
      verdicts.push({ subj, value, office: office.head, verdict: 'corroborated', reason: 'office-current',
        support, weak: support < 2, citation: cite(f), places: [...f.places], surface });
      continue;
    }

    // SUPERSEDED — the answer gives an exclusive office as current, but the sources
    // currently witness a DIFFERENT exclusive office for this person (and not this
    // one). The role has been succeeded. Consult the conflict oracle so the
    // one-at-a-time semantics live in the one injected place.
    if (office.exclusive && assertedCurrent && docFacts) {
      const succeededBy = [...docFacts.current.entries()]
        .filter(([head, c]) => c.exclusive && head !== office.head &&
          attributesConflict('office', office.head, head, { functional: true }).conflict)
        .map(([head, c]) => ({ head, citation: cite(c), value: c.value }));
      if (succeededBy.length) {
        const correction = `the sources give ${displayName(label)}'s current office as ${succeededBy[0].head.replace(/-/g, ' ')}${succeededBy[0].citation ? ` [${succeededBy[0].citation}]` : ''}, not ${office.head.replace(/-/g, ' ')}`;
        verdicts.push({ subj, value, office: office.head, verdict: 'superseded', reason: 'office-succeeded', citation: succeededBy[0].citation, supersededBy: succeededBy, correction, surface });
        continue;
      }
    }

    // STALE — the answer gives the office as current, but the sources mark THIS office
    // former (and never current): "is a council member" against "former council member".
    if (assertedCurrent && docFacts?.former?.has(office.head)) {
      const c = docFacts.former.get(office.head);
      const correction = `the sources mark ${displayName(label)} as a former ${office.head.replace(/-/g, ' ')}${cite(c) ? ` [${cite(c)}]` : ''}`;
      verdicts.push({ subj, value, office: office.head, verdict: 'stale', reason: 'office-former', citation: cite(c), correction, surface });
      continue;
    }

    verdicts.push({ subj, value, office: office.head, verdict: 'unsupported', reason: 'office-unwitnessed', citation: null, surface });
  }

  // The corrected claims (a role succeeded, marked former, or placed in the wrong
  // jurisdiction) — the actionable catches, surfaced as a non-refusing flag.
  const corrected = verdicts.filter(v => v.verdict === 'superseded' || v.verdict === 'stale' || v.verdict === 'place-mismatch');
  // The weakly-grounded claims — current, but resting on a SINGLE meaningful source. Not
  // an error; the signal that the system should seek a second, meaningfully-different
  // witness before stating it flatly (the user's "can't say it because it appears once").
  const weak = verdicts.filter(v => v.verdict === 'corroborated' && v.weak);
  const counts = {
    corroborated: verdicts.filter(v => v.verdict === 'corroborated' && !v.weak).length,
    singleSource: weak.length,
    unsupported:  verdicts.filter(v => v.verdict === 'unsupported').length,
    superseded:   verdicts.filter(v => v.verdict === 'superseded').length,
    stale:        verdicts.filter(v => v.verdict === 'stale').length,
    placeMismatch: verdicts.filter(v => v.verdict === 'place-mismatch').length,
  };
  const corrections = corrected.map(v => v.correction).filter(Boolean);
  const fired = corrected.length ? [{
    id: 'proposition-superseded', refuses: false,
    message: corrections.length ? corrections.join('; ') : 'The answer asserts a status the sources do not bear out.',
    corrections,
  }] : [];

  // `superseded` kept for back-compat (the prior field name); `corrected` is the wider set.
  return { verdicts, superseded: corrected, corrected, weak, corrections, fired, counts };
};

// Re-title a lowercased place for a correction string ("salt lake city" → "Salt Lake City").
const titleCasePlace = (p) => String(p || '').replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

// A label rendered back for a correction string: the surface label with its noise
// words kept (it reads as written), trimmed of a leading article.
const displayName = (label) => String(label || '').replace(/^(the|a|an)\s+/i, '').trim() || String(label || '');

// The source's surface name for a person (by surname key), preferring the SHORTEST
// admitted label that keys to them — "O'Connell" over "Mayor Freddie O'Connell" — so
// a correction names the person, not their title. Null when the corpus never wrote
// a bare name for them.
const labelForPerson = (doc, pk) => {
  let best = null;
  for (const [label] of (doc?.admission?.admitted || [])) {
    if (personKey(label) !== pk) continue;
    const bare = displayName(label.replace(new RegExp(`\\b(${[...ALL_OFFICE_TOKENS].join('|')})\\b`, 'gi'), '').replace(/\s+/g, ' ').trim());
    if (bare && (!best || bare.length < best.length)) best = bare;
  }
  return best;
};
