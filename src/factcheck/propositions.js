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

// readOffice(value) → { head, exclusive, former } | null. Find the office a
// predicate value names (multiword first), and whether the value marks it former.
export const readOffice = (value) => {
  const v = lower(value);
  if (!v) return null;
  const former = FORMER_VALUE.test(v);
  for (const [phrase, [head, exclusive]] of OFFICE_PHRASES) {
    if (v.includes(phrase)) return { head, exclusive, former };
  }
  for (const t of tokens(v)) {
    const hit = OFFICE_TOKENS.get(t);
    if (hit) return { head: hit[0], exclusive: hit[1], former };
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

// documentOffices(doc) → Map<personKey, { current: Map<head,cite>, former: Map<head,cite> }>.
//
// The sources' OWN office propositions, each read at the cursor where it sits — the
// "correct cursor". Two witnesses are mined and folded by person:
//
//   · DEF predicates    parseProps over EACH sentence at its own index, so the tense
//                       of the clause that carries the role is the tense recorded.
//   · appositive titles "Mayor Freddie O'Connell" names O'Connell's current office in
//                       the entity label itself — a present descriptor, mined from the
//                       admission so a title that never appears as a copular DEF still
//                       counts (it usually does not — the parser folds it into the id).
//
// A `cite` is { sentIdx, value } — the line and the surface phrase that witnessed the
// office, so a verdict can point the reader at it.
export const documentOffices = (doc) => {
  const out = new Map();
  if (!doc?.admission) return out;
  const at = (pk) => out.get(pk) || out.set(pk, { current: new Map(), former: new Map() }).get(pk);
  const record = (pk, office, tense, cite) => {
    if (!pk || !office) return;
    const slot = tense === 'former' ? at(pk).former : at(pk).current;
    if (!slot.has(office.head)) slot.set(office.head, { ...cite, exclusive: office.exclusive });
  };

  // DEF predicates, sentence by sentence, at the correct cursor.
  const sentences = doc.sentences || [];
  for (let i = 0; i < sentences.length; i++) {
    for (const p of parseProps(sentences[i], doc, i)) {
      if (p.kind !== 'def') continue;
      const office = readOffice(p.attr?.value);
      if (!office) continue;
      const pk = personKey(doc.admission.labelOf?.(p.subj) || p.subj);
      record(pk, office, defTense(p.surface || sentences[i], p.attr?.value), { sentIdx: i, value: p.attr?.value });
    }
  }

  // Appositive titles carried in the entity label ("Mayor Freddie O'Connell").
  for (const [label, id] of (doc.admission.admitted || [])) {
    const office = readOffice(label);
    if (!office) continue;
    const pk = personKey(label);
    const sentIdx = (doc.mentions?.get(id) || [])[0] ?? null;
    record(pk, office, FORMER_VALUE.test(lower(label)) ? 'former' : 'current', { sentIdx, value: label });
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

    // Is this exact office currently witnessed for this person? Then it stands.
    if (docFacts?.current?.has(office.head)) {
      verdicts.push({ subj, value, office: office.head, verdict: 'corroborated', reason: 'office-current', citation: cite(docFacts.current.get(office.head)), surface });
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

  const superseded = verdicts.filter(v => v.verdict === 'superseded' || v.verdict === 'stale');
  const counts = {
    corroborated: verdicts.filter(v => v.verdict === 'corroborated').length,
    unsupported:  verdicts.filter(v => v.verdict === 'unsupported').length,
    superseded:   verdicts.filter(v => v.verdict === 'superseded').length,
    stale:        verdicts.filter(v => v.verdict === 'stale').length,
  };
  const corrections = superseded.map(v => v.correction).filter(Boolean);
  const fired = superseded.length ? [{
    id: 'proposition-superseded', refuses: false,
    message: corrections.length ? corrections.join('; ') : 'The answer asserts a status the sources mark as no longer current.',
    corrections,
  }] : [];

  return { verdicts, superseded, corrections, fired, counts };
};

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
