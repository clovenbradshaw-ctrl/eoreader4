import { test } from 'node:test';
import assert from 'node:assert/strict';

import { binTtl, makeReadingBin, sweepReadings, nextReadingExpiry } from '../src/turn/reading-bin.js';

// The reading bin (src/turn/reading-bin.js): a curiosity walk PARSES every page but leashes on
// saliency — a strayed page is not stored as a source. Instead of throwing the reading away, it is
// HELD in a bin, leased to delete after a duration set by HOW MUCH CONTENT it processed, then swept.
// Clock-injectable so expiries are deterministic offline — no wall clock baked in.

// ── binTtl: the lease scales with content processed, floored and capped ───────

test('binTtl scales the lease linearly with characters processed', () => {
  const a = binTtl(1000, { msPerChar: 40, min: 0, max: 1e12 });
  const b = binTtl(2000, { msPerChar: 40, min: 0, max: 1e12 });
  assert.equal(a, 40_000);
  assert.equal(b, 80_000, 'twice the content buys twice the lease');
});

test('binTtl floors a tiny reading and caps a huge one', () => {
  assert.equal(binTtl(1, { msPerChar: 40, min: 30_000, max: 3_600_000 }), 30_000, 'a snippet still gets the floor');
  assert.equal(binTtl(10_000_000, { msPerChar: 40, min: 30_000, max: 3_600_000 }), 3_600_000, 'a huge page hits the cap');
});

test('binTtl coerces junk to 0 content and returns the floor', () => {
  assert.equal(binTtl(undefined, { min: 30_000 }), 30_000);
  assert.equal(binTtl(-500, { min: 30_000 }), 30_000, 'negative content clamps to the floor');
});

// ── makeReadingBin: hold, lease by content, sweep on schedule ─────────────────

test('a held reading is leased by its own content length, stamped by the injected clock', () => {
  let t = 1000;
  const bin = makeReadingBin({ clock: () => t, msPerChar: 10, min: 0, max: 1e12 });
  const e = bin.hold({ text: 'x'.repeat(500), docId: 'd1', web: { title: 'T', url: 'u' } }, { reason: 'strayed' });
  assert.equal(e.chars, 500);
  assert.equal(e.ttlMs, 5000, 'lease = chars × msPerChar');
  assert.equal(e.binnedAt, 1000);
  assert.equal(e.expiresAt, 6000, 'binnedAt + ttl');
  assert.equal(e.reason, 'strayed', 'the meta rides along');
  assert.equal(e.title, 'T');
  assert.equal(bin.size, 1);
});

test('a bigger reading is held longer than a smaller one (duration by content, not flat time)', () => {
  const bin = makeReadingBin({ clock: () => 0, msPerChar: 10, min: 0, max: 1e12 });
  const small = bin.hold({ text: 'x'.repeat(100) });
  const big = bin.hold({ text: 'x'.repeat(5000) });
  assert.ok(big.expiresAt > small.expiresAt, 'the page with more content processed outlives the snippet');
});

test('sweep deletes only readings whose lease has run out, and returns them', () => {
  let t = 0;
  const bin = makeReadingBin({ clock: () => t, msPerChar: 1, min: 0, max: 1e12 });
  bin.hold({ text: 'x'.repeat(100) });   // expires at 100
  bin.hold({ text: 'x'.repeat(900) });   // expires at 900
  t = 500;
  const dropped = bin.sweep();
  assert.equal(dropped.length, 1, 'only the short-lease reading expired at t=500');
  assert.equal(bin.size, 1, 'the longer lease survives');
  t = 1000;
  bin.sweep();
  assert.equal(bin.size, 0, 'the rest deletes once its content-scaled lease elapses');
});

test('nextExpiry names the soonest lease to arm a single timer', () => {
  const bin = makeReadingBin({ clock: () => 0, msPerChar: 1, min: 0, max: 1e12 });
  assert.equal(bin.nextExpiry(), null, 'empty bin arms nothing');
  bin.hold({ text: 'x'.repeat(300) });
  bin.hold({ text: 'x'.repeat(50) });
  assert.equal(bin.nextExpiry(), 50, 'the soonest expiry across the bin');
});

test('the reading itself is held, so a circle-back re-uses it instead of re-reading', () => {
  const bin = makeReadingBin({ clock: () => 0 });
  const e = bin.hold({ text: 'the strayed prose', docId: 'd9' });
  assert.equal(e.text, 'the strayed prose', 'the parsed reading is retained in the bin');
  assert.equal(e.docId, 'd9');
});

// ── sweepReadings / nextReadingExpiry: the same, over a plain session array ────

test('sweepReadings partitions a plain array into kept and dropped, non-mutating', () => {
  const entries = [{ expiresAt: 100 }, { expiresAt: 900 }, { expiresAt: 500 }];
  const { kept, dropped } = sweepReadings(entries, 500);
  assert.equal(dropped.length, 2, 'expiresAt ≤ now are dropped (100 and 500)');
  assert.equal(kept.length, 1);
  assert.equal(entries.length, 3, 'the input array is untouched');
});

test('sweepReadings and nextReadingExpiry tolerate junk input', () => {
  assert.deepEqual(sweepReadings(null, 0), { kept: [], dropped: [] });
  assert.equal(nextReadingExpiry(undefined), null);
  assert.equal(nextReadingExpiry([{ expiresAt: 200 }, { expiresAt: 80 }]), 80);
});
