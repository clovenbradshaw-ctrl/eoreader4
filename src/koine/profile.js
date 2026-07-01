// koine/profile — infer each data variable's TYPE from its values (the SIG stage).
//
// A dataset is a set of columns; profiling types each one on the four axes compile() reasons
// over (schema.js): role (domain axis vs. measure), measurement (nominal/ordinal/interval/
// ratio/cyclic — the ORDER type of the data), temporal character (state/event/rate/static),
// and cardinality/range/distribution. Deterministic heuristics only — no model. A caller that
// knows better passes `hints[colId]` to override any inferred field (the SIG that a reader or
// a finding supplies). `importance` is such a hint: the finding says what matters (§8 Q2).
//
// Input is tolerant: an array of row objects (columns = the union of keys), or a columnar
// { columns: [{ id, values }] }. Values that don't parse stay as their string form.

import { makeVariable } from './schema.js';

const isNum  = (v) => v !== '' && v != null && Number.isFinite(Number(v));
const isDate = (v) => typeof v === 'string' && /^\d{4}(-\d{2}(-\d{2})?)?([T ]\d)?/.test(v) && !Number.isNaN(Date.parse(v));
const NAME_TIME   = /(^|_)(date|time|day|year|month|timestamp|ts|when)($|_)/i;
const NAME_CYCLIC = /(^|_)(month|weekday|dow|day_of_week|hour|season|phase|angle)($|_)/i;
const NAME_AXIS   = /(^|_)(x|y|lon|lat|longitude|latitude|index|idx|step|t|position|depth)($|_)/i;

const columnsOf = (dataset) => {
  if (dataset && Array.isArray(dataset.columns)) return dataset.columns.map((c) => ({ id: c.id, values: c.values || [] }));
  const rows = Array.isArray(dataset) ? dataset : [];
  const ids = [];
  const seen = new Set();
  for (const r of rows) for (const k of Object.keys(r || {})) if (!seen.has(k)) { seen.add(k); ids.push(k); }
  return ids.map((id) => ({ id, values: rows.map((r) => r?.[id]) }));
};

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Distribution shape from the numbers: log-wide span, or a right/left skew (median far from
// the mid-range), else linear. Bimodal is not inferred here (a hint sets it).
const distributionOf = (nums) => {
  const lo = Math.min(...nums), hi = Math.max(...nums);
  if (lo > 0 && hi / lo >= 100) return 'log';
  const med = median(nums), mid = (lo + hi) / 2, span = hi - lo || 1;
  if (Math.abs(med - mid) / span >= 0.25) return 'skewed';
  return 'linear';
};

// Type one column from its values, then let a hint override any field.
const profileColumn = (id, rawValues, hint = {}) => {
  const values = rawValues.filter((v) => v !== '' && v != null);
  const distinct = new Set(values.map(String));
  const nums = values.filter(isNum).map(Number);
  const allNum  = values.length > 0 && nums.length === values.length;
  const allDate = values.length > 0 && values.every(isDate);

  let measurement = 'nominal', role = 'measure', temporal = 'static';
  let range = null, categories = null, distribution_hint = 'linear';

  if (allDate || NAME_TIME.test(id)) {
    measurement = 'interval'; role = 'domain'; temporal = 'event';   // a time axis of events
    const ts = values.map((v) => Date.parse(v)).filter(Number.isFinite);
    if (ts.length) range = [Math.min(...ts), Math.max(...ts)];
  } else if (NAME_CYCLIC.test(id)) {
    measurement = 'cyclic'; role = 'domain';
    categories = [...distinct];
  } else if (allNum) {
    measurement = 'ratio';
    range = [Math.min(...nums), Math.max(...nums)];
    distribution_hint = distributionOf(nums);
    // an AXIS-NAMED numeric column is an independent frame axis; anything else is a measure.
    // (A measure that happens to arrive sorted is still a measure — order in the rows is not
    // an axis; only a name or an explicit hint makes a column a domain.)
    role = NAME_AXIS.test(id) ? 'domain' : 'measure';
  } else {
    measurement = 'nominal';
    categories = [...distinct];
  }

  const cardinality = measurement === 'ratio' || measurement === 'interval' ? 'continuous' : distinct.size;

  return makeVariable({
    id, role, measurement, temporal, cardinality, range, categories, distribution_hint,
    importance: 0.5,
    ...hint,      // caller/finding overrides: role, measurement, temporal, importance, distribution_hint, …
  });
};

// profile(dataset, hints) → Variable[]. hints is { colId: {…overrides} }.
export const profile = (dataset, hints = {}) => {
  const cols = columnsOf(dataset);
  return Object.freeze(cols.map((c) => profileColumn(c.id, c.values, hints[c.id] || {})));
};

export { profileColumn };
