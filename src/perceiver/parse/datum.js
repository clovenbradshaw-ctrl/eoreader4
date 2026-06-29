// The datum reader — the natural-language convention that a LABEL bound to a VALUE is a
// fact, and the regime switch that finds it when the prose grammar breaks down.
//
// A line of prose is a sentence: subjects, verbs, the bonds between figures. A line of
// DATA is not — it is a key and a value set side by side ("High 66°", "Chance of Rain
// 70%", "Feels Like 61°"). The sentence grammar reads such a line as noise: the value is
// a bare number the degenerate guard (parse/chrome.js) holds as NUL — "carries no figure"
// — and the label, stripped of its value, says nothing. The temperature, the price, the
// dosage falls out of the reading even though it was right there on the page.
//
// This module teaches the reader the convention it was missing: a value adjacent to its
// key BINDS, into the same DEF datum (core/datum.js) the image organ emits for a region's
// attribute and the front-matter harvest emits for a labeled field. And it makes the
// BREAKAGE the trigger — the move the user asked for: a line the prose grammar can only
// call degenerate is itself the evidence that this region is NOT prose, so the rigid
// sentence rules YIELD and the region is read as data instead (the regime switch). That
// is why this runs before chrome's NUL in the pipeline: the rule that would discard the
// value gets a chance to find its meaning first.
//
// Conservative by construction, like metadata.js. A lone mid-prose colon ("She had one
// goal: survival.") or a stray page number never trips it. Two gates do the work:
//   • a value must carry an unmistakable UNIT (°, %, a currency mark, a known unit word)
//     to bind on its own — a bare integer is too easily a footnote or a page number;
//   • once a RUN of ≥2 such bindings confirms the region IS data, the rules relax inside
//     it (a colon field with no unit, a bare number) — the regime has switched.
// With neither gate met it harvests NOTHING and the parse is byte-identical.
//
// What is text-specific lives here — what a value LOOKS like in prose. What is universal
// lives in core/datum.js — the binding and the shape it commits to. Modality at the edge,
// meaning in the interior, exactly as omnimodal-core.md asks.

const MAX_KEY_WORDS = 4;
const MAX_KEY_CHARS = 40;

// The VALUE surface in text. A number — optionally signed, decimalized, thousands-grouped,
// with a leading currency mark — optionally followed by a unit. The UNIT is what makes a
// value unmistakable: a degree sign, a percent, a currency mark, or a short known unit
// word. A unit-bearing value is STRONG (binds on its own); a bare number is WEAK (binds
// only inside a confirmed data run).
const NUMBER = String.raw`[−–+-]?(?:\$|£|€|¥)?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?`;
const UNIT = String.raw`°[CFKcfk]?|℃|℉|%|‰|\$|£|€|¥|mph|km\/h|kph|kg|lbs?|oz|mg|ml|cm|mm|km|hrs?|mins?|secs?|bpm|hz|khz|mhz|ghz|mb|gb|tb|kb|px|pt|°`;
const STRONG_VALUE = new RegExp(`^${NUMBER}\\s*(?:${UNIT})$`, 'iu');
const BARE_NUMBER = new RegExp(`^${NUMBER}$`, 'u');
const LEADING_CCY = /^[−–+-]?(?:\$|£|€|¥)\d/u;

// A normalized value reading off a line, with its strength. null when the line is not a
// value at all. STRONG when it carries an unmistakable unit — a trailing °/%/unit-word, or
// a leading currency mark ($1,299.00) — and so can bind on its own; WEAK when it is a bare
// number, which binds only inside a confirmed data run. Whitespace-trimmed; the verbatim
// surface is kept as the value.
export const valueShape = (line) => {
  const s = String(line || '').trim();
  if (!s) return null;
  if (STRONG_VALUE.test(s) || (LEADING_CCY.test(s) && BARE_NUMBER.test(s))) return { value: s, strong: true };
  if (BARE_NUMBER.test(s)) return { value: s, strong: false };
  return null;
};

// A KEY is a short label: a few words, mostly letters, no terminal sentence punctuation,
// and NOT itself a value. "Feels Like", "High", "Chance of Rain", "Population". A trailing
// colon is allowed (and stripped) — a key-line in a stacked layout often keeps its colon.
const keyShape = (line) => {
  const raw = String(line || '').trim().replace(/\s*:\s*$/, '');
  if (!raw || raw.length > MAX_KEY_CHARS) return null;
  if (valueShape(raw)) return null;                       // a value is not a key
  if (/[.!?]$/.test(raw)) return null;                    // a finished sentence is prose, not a label
  const words = raw.split(/\s+/);
  if (words.length > MAX_KEY_WORDS) return null;
  // Mostly letters: a label is words, not punctuation or a code. Allow the in-word marks a
  // label carries, but require it to start with a letter and hold no sentence-internal stop.
  if (!/^[A-Za-z][A-Za-z0-9 .&'’/À-ɏ-]*$/.test(raw)) return null;
  return raw;
};

// An INLINE datum on one line: "Key: value" or "Key value", where the value is STRONG (it
// carries a unit). The unit requirement is what keeps a prose colon safe — "one goal:
// survival" has no value on its right, so it never matches. Returns { key, value } | null.
export const inlineDatum = (line) => {
  const s = String(line || '').trim();
  if (!s) return null;
  // Colon form: split on the FIRST colon, key left, value right.
  const colon = s.indexOf(':');
  if (colon > 0) {
    const key = keyShape(s.slice(0, colon));
    const vs = valueShape(s.slice(colon + 1));
    if (key && vs && vs.strong) return { key, value: vs.value };
  }
  // No-colon form: a key word-group then a strong value ("High 66°", "Feels Like 61°").
  // The value is the unit-bearing tail; the key is everything before it.
  const m = new RegExp(`^(.*?)[\\s]+(${NUMBER}\\s*(?:${UNIT}))$`, 'iu').exec(s);
  if (m) {
    const key = keyShape(m[1]);
    if (key) return { key, value: m[2].trim() };
  }
  return null;
};

// Read the data in a sequence of units (the sentences/lines a parse walks). Returns a Map
// from unit index to a binding the per-unit pass acts on:
//   { role:'inline', key, value }              — a one-line datum
//   { role:'key',   key, partner }             — a key line whose value is the next line
//   { role:'value', key, value, partner }      — that value line, bound back to its key
// Only confirmed data is returned. The two regimes:
//   • A STRONG inline datum, or a key→strong-value adjacency, stands on its own (the unit
//     is proof enough).
//   • A bare-number value, or a colon field with no unit, is admitted ONLY when it sits in
//     a RUN with a strong neighbour — the regime has switched to data, so the rules relax.
// Everything else is left for the prose grammar (and chrome's NUL) exactly as before.
export const scanData = (units = []) => {
  const n = units.length;
  // Pass 1 — classify each unit on its own surface, conservatively (strong only).
  // kind[i]: 'inline' | 'keythenvalue' | 'value' | null, with the binding payload.
  const raw = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const line = units[i];
    const inl = inlineDatum(line);
    if (inl) { raw[i] = { role: 'inline', ...inl }; continue; }
    // A key line immediately followed by a STRONG value line is a stacked datum.
    if (i + 1 < n) {
      const key = keyShape(line);
      const vs = key ? valueShape(units[i + 1]) : null;
      if (key && vs && vs.strong) { raw[i] = { role: 'key', key, partner: i + 1 }; continue; }
    }
  }
  // Mark the value half of every stacked datum, so the per-unit pass binds it (not NUL).
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const r = raw[i];
    if (!r) continue;
    out.set(i, r);
    if (r.role === 'key') out.set(r.partner, { role: 'value', key: r.key, value: String(units[r.partner]).trim(), partner: i });
  }

  // Pass 2 — the regime relaxation. A line is "datatish" if it is already bound, looks like
  // a key or a value, or is blank. Walk each contiguous run of datatish lines; when one
  // holds ≥2 CONFIRMED (strong) bindings, the region has proven itself a table — so inside
  // it the WEAK forms the first pass held back are admitted: a colon field with no unit, and
  // a key→bare-number adjacency. This is the switch the user named: once the page is data, a
  // bare number in it is a value, not a footnote. The confirmation rides on the strong
  // bindings, so a not-yet-bound candidate sitting BETWEEN them ("Pressure / 1013") is
  // carried into the same regime. Outside such a run nothing relaxes — prose is byte-identical.
  const isBlank = (s) => String(s || '').trim().length < 3;
  const datatish = (k) => out.has(k) || isBlank(units[k]) || !!valueShape(units[k]) || !!keyShape(units[k]);
  const inRun = new Array(n).fill(false);
  let i = 0;
  while (i < n) {
    if (!datatish(i)) { i++; continue; }
    let j = i, bound = 0;
    while (j < n && datatish(j)) { if (out.has(j)) bound++; j++; }
    if (bound >= 2) for (let k = i; k < j; k++) inRun[k] = true;
    i = Math.max(j, i + 1);
  }
  for (let k = 0; k < n; k++) {
    if (out.has(k) || !inRun[k]) continue;
    // A weak colon field inside the run ("Wind: NNW", "Humidity: 81") — value is the tail.
    const s = String(units[k]).trim();
    const colon = s.indexOf(':');
    if (colon > 0) {
      const key = keyShape(s.slice(0, colon));
      const val = s.slice(colon + 1).trim();
      if (key && val && val.length <= MAX_KEY_CHARS) { out.set(k, { role: 'inline', key, value: val }); continue; }
    }
    // A key→bare-number adjacency inside the run.
    if (k + 1 < n && !out.has(k + 1)) {
      const key = keyShape(s);
      const vs = key ? valueShape(units[k + 1]) : null;
      if (key && vs) { out.set(k, { role: 'key', key, partner: k + 1 }); out.set(k + 1, { role: 'value', key, value: vs.value, partner: k }); }
    }
  }
  return out;
};
