// Entity admission — the ceiling the low places on what the high may claim.
//
// A capitalised span is a candidate on first sighting and admitted on the
// second. Only admitted entities can be subjects of relations or be cited
// as sources for facts.
//
// Two changes over the bare two-sighting rule, both lifting recall without
// inventing nodes:
//   - A *multi-word* proper name (e.g. "Gregor Samsa", "Project Gutenberg")
//     is almost never a sentence-starter accident, so it is admitted on
//     first sighting. Single-token names still need the second sighting.
//   - Titles ("Mr.", "Mrs.", "Professor") are kept joined to the name and
//     the trailing period normalised, so "Mr. Samsa" is one entity, not a
//     spurious bare "Mr".
//
// The admission also remembers, per entity, the sentence indices where it
// was mentioned. The graph view uses this to jump from a node to its lines;
// the integral fold uses it to name the figures a passage turns on.

const TITLE = String.raw`(?:Mr|Mrs|Ms|Dr|Miss|Mister|Sir|Madam|Madame|Lady|Lord|Professor|Prof|Capt|Captain|Rev|St|Aunt|Uncle)\.?`;
// A lowercase connector (von, of, the) only counts when it sits *between* two
// capitalised words — never trailing, so "Grete the news" is just "Grete".
const CONN  = String.raw`de|von|van|der|del|di|du|la|le|of|the`;
const NAME  = String.raw`[A-Z][a-zA-Z]+(?:\s+(?:${CONN}\s+)?[A-Z][a-zA-Z]+)*`;
const CAP_RE = new RegExp(String.raw`\b(?:${TITLE}\s+)?${NAME}\b`, 'g');

// Sentence-initial capitals that aren't names. The greedy regex above will
// happily eat "Then Alice" as one phrase; we strip these leading starters
// before counting so admission tracks the real entity.
const CAP_STARTERS = new Set([
  'The','A','An','This','That','These','Those',
  'I','You','He','She','It','We','They',
  'My','Your','His','Her','Its','Our','Their',
  'Then','Now','Here','There','When','Where','Why','How','What','Who','Whom','Which',
  'Yes','No','Maybe','Perhaps','Otherwise','Also','However','Indeed','Still','Yet',
  'But','And','So','Or','Nor','For','Because','Although','While','Since','As',
  'In','On','At','To','From','By','With','Of','Up','Down','Over','Under','Into','Out',
  'If','Unless','Until','Once','Just','Only','Even','Soon','Again','Almost','Nearly',
  'Suddenly','Finally','Meanwhile','Nevertheless','Therefore','Thus','Hence','Anyway',
  'Well','Oh','Ah','Eh','Alas','Look','Listen',
  'Can','Could','Would','Should','Shall','Will','May','Might','Must',
  'Do','Does','Did','Have','Has','Had','Is','Are','Was','Were','Be','Been','Being',
  'Not','Never','Always','Often','Sometimes','Perhaps',
]);

const TITLE_WORDS = new Set([
  'Mr','Mrs','Ms','Dr','Miss','Mister','Sir','Madam','Madame','Lady','Lord',
  'Professor','Prof','Capt','Captain','Rev','St','Aunt','Uncle',
]);

const idFor = (label) =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

const cleanLabel = (raw) => {
  let words = raw.trim().split(/\s+/);
  while (words.length > 0 && CAP_STARTERS.has(words[0])) words.shift();
  if (words.length === 0) return null;
  // Normalise a leading title: drop the trailing period, keep it joined.
  const head = words[0].replace(/\.$/, '');
  if (TITLE_WORDS.has(head)) {
    if (words.length === 1) return null; // a bare title is not an entity
    words = [head, ...words.slice(1)];
  }
  if (words.length === 1 && CAP_STARTERS.has(words[0])) return null;
  return words.join(' ');
};

export const createEntityAdmission = () => {
  const counts    = new Map(); // label → count
  const admitted  = new Map(); // label → id (post-admission)
  const sightSent = new Map(); // label → number[] (every sighting's sentIdx)
  const mentions  = new Map(); // id    → number[] (sentence indices, ordered)

  const noteMention = (id, sentIdx) => {
    if (sentIdx == null) return;
    const arr = mentions.get(id) || [];
    arr.push(sentIdx);
    mentions.set(id, arr);
  };

  // Name-containment synthesis (SYN): a single-token name that is the head or
  // tail of an already-admitted 2–3 word name is the same referent ("Gregor"
  // ⊂ "Gregor Samsa"). This is the high-confidence identity join — distinct
  // from the soft pronoun field, which never merges. Returns the existing id.
  const aliasOf = (label) => {
    const t = label.split(' ');
    for (const [lab, id] of admitted) {
      const lt = lab.split(' ');
      if (t.length === 1 && lt.length >= 2 && lt.length <= 3 &&
          (lt[0] === t[0] || lt[lt.length - 1] === t[0])) return id;
      if (lt.length === 1 && t.length >= 2 && t.length <= 3 &&
          (t[0] === lt[0] || t[t.length - 1] === lt[0])) return id;
    }
    return null;
  };

  const observe = (sentence, sentIdx = null) => {
    const seenInSentence = new Set();
    const out = [];
    const re = new RegExp(CAP_RE.source, 'g');
    let m;
    while ((m = re.exec(sentence)) !== null) {
      const label = cleanLabel(m[0]);
      if (!label) continue;
      if (seenInSentence.has(label)) continue;
      seenInSentence.add(label);

      if (sentIdx != null) {
        const s = sightSent.get(label) || [];
        s.push(sentIdx);
        sightSent.set(label, s);
      }

      const c = (counts.get(label) ?? 0) + 1;
      counts.set(label, c);
      const multiword = label.includes(' ');

      if (admitted.has(label)) {
        const id = admitted.get(label);
        noteMention(id, sentIdx);
        out.push({ status: 'present', id, label });
      } else if (c >= 2 || multiword) {
        const rawId = idFor(label);
        const alias = aliasOf(label);
        const id = alias || rawId;
        admitted.set(label, id);
        // Seed/accumulate mentions under the (possibly shared) referent id;
        // the candidate sighting had no id yet, so the first line is not lost.
        if (!mentions.has(id)) mentions.set(id, []);
        for (const si of (sightSent.get(label) || [])) mentions.get(id).push(si);
        out.push({ status: 'admit', id, label, aliasOf: alias, rawId });
      } else {
        out.push({ status: 'candidate', label });
      }
    }
    return out;
  };

  return {
    observe,
    isAdmitted: (label) => admitted.has(label),
    idOf:       (label) => admitted.get(label),
    labelOf:    (id)    => {
      for (const [label, eid] of admitted) if (eid === id) return label;
      return null;
    },
    get counts()   { return counts; },
    get admitted() { return admitted; },
    get mentions() { return mentions; },
  };
};

// Exposed so the relation parser can share the exact same entity scanner.
export const scanEntities = (text) => {
  const re = new RegExp(CAP_RE.source, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const label = cleanLabel(m[0]);
    if (label) out.push({ label, start: m.index, end: m.index + m[0].length });
  }
  return out;
};
