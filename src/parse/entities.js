// Entity admission by distributional role — no blocklist of "not-names".
//
// Capitalisation plus recurrence is the wrong test: "One", "Some", "After",
// "Good", an all-caps licence header — all capitalise and recur, none are
// names. A blocklist of such words can never be complete. So we don't keep
// one. Instead the document teaches the reader its own names:
//
//   A token is a proper noun only if it appears capitalised MID-sentence —
//   somewhere position did not force the capital. "Marlow", "Kurtz", "Thames"
//   do; "One", "After", "Some" only ever start a sentence, so they never
//   qualify. This is a learned convention (induceProperNouns), not a list.
//
// On top of that role signal the familiar rules still apply: a single-token
// name is admitted on its second sighting, a multi-word name on its first,
// and "Gregor" folds into "Gregor Samsa" as a SYN synthesis.

const WORD   = String.raw`(?:[A-Z][a-z]+(?:['’][a-z]+)?|[A-Z]{2,})`;       // titlecase word OR an acronym (THP, NDP)
const CONN   = new Set(['of', 'the', 'and', 'de', 'von', 'van', 'da', 'del', 'di', 'la', 'le', 'du', 'der']);
const TITLES = new Set(['Mr', 'Mrs', 'Ms', 'Dr', 'Miss', 'Mister', 'Sir', 'Lady', 'Lord', 'Professor',
                        'Prof', 'Captain', 'Capt', 'Rev', 'St', 'Aunt', 'Uncle', 'General', 'Colonel', 'Major']);
const CONN_RE  = [...CONN].join('|');
const TITLE_RE = [...TITLES].join('|') + String.raw`)\.?`;
const RUN_RE   = new RegExp(String.raw`\b(?:(?:${TITLE_RE}\s+)?${WORD}(?:\s+(?:(?:${CONN_RE})\s+)?${WORD})*`, 'g');

// A name word is titlecase (Marlow) OR an acronym (THP). Name-hood is then
// decided by distribution, not by this shape — shape only proposes candidates.
const isNameWord = (w) => /^[A-Z][a-z]+$/.test(w) || /^[A-Z]{2,}$/.test(w);
const baseOf = (w) => w.replace(/['’].*$/, '').replace(/\.$/, '');

// Pass: learn which capitalised words are names — the list-free way. A common
// word ("one", "some", "after", "don't") appears lowercase somewhere in the
// document; it only capitalises because position forced it. A name ("Marlow",
// "Kurtz") is *never* seen lowercase. So a titlecase token is a proper noun iff
// its lowercase form never occurs as a word. ALLCAPS (headings, "III") never
// qualifies — it isn't titlecase. The document teaches the reader its names.
export const induceProperNouns = (sentences) => {
  const lower = new Set();
  const caps  = new Set();
  for (const s of sentences) {
    for (const m of String(s).matchAll(/\b[a-z]+/g)) lower.add(m[0]);   // whole lowercase words only
    for (const m of String(s).matchAll(/[A-Z][a-z]+(?:['’][a-z]+)?|[A-Z]{2,}/g)) caps.add(m[0]);
  }
  const proper = new Set();
  for (const w of caps) {
    const base = baseOf(w);                       // "Marlow's" → "Marlow", "Don't" → "Don"
    if (!lower.has(w.toLowerCase().replace(/['’].*$/, '')) && !lower.has(base.toLowerCase())) {
      proper.add(base);
    }
  }
  return proper;
};

const idFor = (label) =>
  label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Trim a titlecase run to the proper-noun core: drop leading/trailing words
// the document never uses as names, keep connectors between names, keep a
// leading title. Returns null when the run carries no name.
const cleanLabel = (raw, proper) => {
  const words = raw.trim().split(/\s+/);
  const info = words.map((w) => {
    const isConn  = CONN.has(w.toLowerCase());
    const isTitle = TITLES.has(w.replace(/\.$/, ''));
    const base    = baseOf(w);
    const name    = !isConn && !isTitle && isNameWord(base) && (proper ? proper.has(base) : true);
    return { w, base, isConn, isTitle, name };
  });
  let a = info.findIndex((x) => x.name);
  if (a < 0) return null;
  let b = info.length - 1;
  while (b >= 0 && !info[b].name) b--;
  if (a > 0 && info[a - 1].isTitle) a--;
  const parts = [];
  for (let i = a; i <= b; i++) parts.push(info[i].isConn ? info[i].w.toLowerCase() : info[i].base);
  const label = parts.join(' ').trim();
  return label || null;
};

export const createEntityAdmission = ({ properWords = null } = {}) => {
  const proper    = properWords;
  const counts    = new Map();
  const admitted  = new Map();
  const sightSent = new Map();
  const mentions  = new Map();

  const scan = (text) => {
    const out = [];
    const re = new RegExp(RUN_RE.source, 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      const label = cleanLabel(m[0], proper);
      if (label) out.push({ label, start: m.index, end: m.index + m[0].length });
    }
    return out;
  };

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
    const seen = new Set();
    const out = [];
    for (const { label } of scan(sentence)) {
      if (seen.has(label)) continue;
      seen.add(label);
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
        if (sentIdx != null) (mentions.get(id) || mentions.set(id, []).get(id)).push(sentIdx);
        out.push({ status: 'present', id, label });
      } else if (c >= 2 || multiword) {
        const rawId = idFor(label);
        const alias = aliasOf(label);
        const id = alias || rawId;
        admitted.set(label, id);
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
    scan,
    isAdmitted: (label) => admitted.has(label),
    idOf:       (label) => admitted.get(label),
    labelOf:    (id)    => { for (const [l, e] of admitted) if (e === id) return l; return null; },
    get counts()   { return counts; },
    get admitted() { return admitted; },
    get mentions() { return mentions; },
  };
};
