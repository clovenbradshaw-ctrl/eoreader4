// The reading bin — where a parsed-but-not-salient research reading is HELD, not lost.
//
// A curiosity walk (research.js, deep-research.js) PARSES every page it fetches, then leashes: a
// page whose Born overlap with the question falls below the floor has STRAYED, and a strayed page
// is not grounded — it never becomes a source, the answer never stands on it, and the provenance
// never lists it (docs/deep-research.md, "the strayed page never reached the ground"). That gate
// is right: an off-topic page should not appear in the sources. But until now the strayed reading
// was thrown away the instant it strayed, and the reading had already HAPPENED — the fetch, the
// parse, the surprise/saliency measurement all cost work, and a strayed page is often on the very
// EDGE of the question. The next hop, or a sibling facet, can make it salient after all; discarding
// it means re-reading from scratch if the walk circles back.
//
// The bin is the middle ground: parse every source, but if it is not salient to the discourse do
// NOT store it as a source — hold the READING in a bin instead, leased to delete after a duration
// set by HOW MUCH CONTENT was processed, not a flat clock. A big page read and set aside is worth
// holding longer than a snippet: more work sunk into it, more chance it pays back. So the lease
// scales with the reading's character count (binTtl), floored so even a snippet gets a real grace
// window and capped so nothing pins the bin forever. `sweep` is the scheduled deletion: drop every
// entry whose lease has run out.
//
// Pure and clock-injectable. `makeReadingBin({ clock })` takes `now` from an injected clock
// (default Date.now), so a walk stamps DETERMINISTIC expiries in a unit test and real ones in the
// browser — the same discipline the rest of the turn holon keeps (offline-testable, no wall clock
// baked in). `sweepReadings(entries, at)` is the same deletion over a plain array, for a session
// that parks readings from many walks in one place and sweeps them on a timer.

// binTtl(chars, opts) → milliseconds a reading of `chars` characters is held before it is deleted.
// The lease is set by CONTENT PROCESSED, not a flat time: linear in the characters actually read,
// floored so even a snippet gets a real grace window, capped so one huge page can't pin the bin.
//   msPerChar   how long a single character of processed content buys — the content→time rate.
//   min / max   the lease floor and ceiling (default 30s … 1h).
export const binTtl = (chars, { msPerChar = 40, min = 30_000, max = 3_600_000 } = {}) => {
  const c = Math.max(0, Number(chars) || 0);
  return Math.min(max, Math.max(min, Math.round(c * msPerChar)));
};

// readingText(reading) → the parsed prose a bin entry is measured by. Accepts the same shapes a
// walk holds: a doc ({ text }), an admitted result ({ doc: { text } }), or a bare string. Falls
// back to the source excerpt a snippet-only result still carries — the same accessor the walks read.
const readingText = (reading) =>
  String(reading?.text ?? reading?.doc?.text ?? reading?.web?.excerpt ?? reading?.excerpt ??
         (typeof reading === 'string' ? reading : '') ?? '');

const docIdOf = (reading) => reading?.docId ?? reading?.doc?.docId ?? null;
const webOf   = (reading) => reading?.web ?? reading?.doc?.web ?? null;

// makeReadingBin({ clock, ...ttlOpts }) → a small holder for strayed readings. `clock()` supplies
// `now` (default Date.now) so expiries are deterministic under an injected clock. The ttl options
// (msPerChar/min/max) flow straight into binTtl. Not a store — an in-memory bin the walk fills and
// the caller drains; a session persists it by reading `entries()` and re-holding them if it wants.
export const makeReadingBin = ({ clock = () => Date.now(), ...ttlOpts } = {}) => {
  const items = [];
  const now = () => { try { const t = Number(clock()); return Number.isFinite(t) ? t : 0; } catch { return 0; } };

  // hold(reading, meta) — take a strayed reading OUT of the discourse and INTO the bin, leased for
  // binTtl(its content length). `meta` records WHY it was set aside (the thread, the surprise and
  // saliency that failed the leash, the reason) so a later audit can see what was held and why.
  const hold = (reading, meta = {}) => {
    const text = readingText(reading);
    const chars = text.length;
    const ttlMs = binTtl(chars, ttlOpts);
    const t = now();
    const web = webOf(reading);
    const entry = {
      docId: docIdOf(reading),
      title: meta.title ?? web?.title ?? '',
      url: meta.url ?? web?.url ?? web?.final_url ?? '',
      text,                                   // the reading itself — held so a circle-back re-uses it
      chars, ttlMs, binnedAt: t, expiresAt: t + ttlMs,
      ...meta,
    };
    items.push(entry);
    return entry;
  };

  // sweep(at) — the scheduled deletion. Drop every reading whose lease has expired (expiresAt ≤ at)
  // and return the entries deleted, so a caller can log what a sweep reclaimed. Mutates in place.
  const sweep = (at = now()) => {
    const dropped = [];
    for (let i = items.length - 1; i >= 0; i--) if (items[i].expiresAt <= at) dropped.push(items.splice(i, 1)[0]);
    return dropped;
  };

  // nextExpiry() → the soonest lease expiry (a single timer can be armed to it), or null if empty.
  const nextExpiry = () => items.reduce((m, e) => (m == null || e.expiresAt < m ? e.expiresAt : m), null);

  return {
    hold, sweep, nextExpiry,
    entries: () => items.slice(),
    get size() { return items.length; },
  };
};

// sweepReadings(entries, at) → { kept, dropped } — the scheduled deletion over a PLAIN array,
// non-mutating. A session that parks the readings from many walks in one list sweeps it with this:
// `kept` is the readings whose lease still runs, `dropped` the ones deleted at time `at`.
export const sweepReadings = (entries, at) => {
  const kept = [], dropped = [];
  for (const e of Array.isArray(entries) ? entries : []) ((e && e.expiresAt <= at) ? dropped : kept).push(e);
  return { kept, dropped };
};

// nextReadingExpiry(entries) → the soonest lease expiry across a plain array, or null if empty —
// the timestamp a session arms its single sweep timer to.
export const nextReadingExpiry = (entries) =>
  (Array.isArray(entries) ? entries : []).reduce((m, e) => (e && (m == null || e.expiresAt < m) ? e.expiresAt : m), null);
