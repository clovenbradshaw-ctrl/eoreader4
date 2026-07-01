// The bridge between core/log.js and a corpus store.
//
// attachPersistence(log, store, meta) makes a live log durable: it ensures the
// document's record exists, then subscribes to the log so every appended event
// is written through the store's driver. Writes are coalesced to a microtask so
// a burst of appends (a whole document ingesting) becomes a few store writes,
// not one per operator. Returns an unsubscribe; call it (or flush()) when done.
//
// rehydrateLog(createLog, record) is the inverse: rebuild a log from a stored
// record by replaying its events. The document's derived structures (spans,
// mentions, graph) are then a fold of that log — never stored, always rebuilt —
// which is exactly the eoreader4 spine: "you can lose the graph at any moment
// and rebuild it by replay."

export function attachPersistence(log, store, meta = {}) {
  if (!log || typeof log.subscribe !== 'function') throw new Error('attachPersistence: a core log is required');
  if (!store || typeof store.appendEvents !== 'function') throw new Error('attachPersistence: a corpus store is required');
  const docId = meta.docId ?? log.docId;
  if (!docId) throw new Error('attachPersistence: a docId is required (in meta or on the log)');

  let pending = [];
  let flushing = null;
  let closed = false;

  // Seed the record (and persist whatever the log already holds) up front, so a
  // log attached after ingest is captured, not just future appends.
  const seeded = store.has(docId).then(async (exists) => {
    if (exists) return;
    await store.put({
      docId,
      modality: meta.modality ?? null,
      name: meta.name ?? docId,
      source: meta.source ?? null,
      meta: meta.meta ?? null,
      events: log.snapshot(),
    });
  });

  const flush = async () => {
    await seeded;
    if (!pending.length) return;
    const batch = pending;
    pending = [];
    await store.appendEvents(docId, batch);
  };

  const scheduleFlush = () => {
    if (flushing || closed) return;
    flushing = Promise.resolve().then(async () => {
      flushing = null;
      try { await flush(); } catch { /* persistence is best-effort; the log is still authoritative */ }
    });
  };

  const unsubscribe = log.subscribe((event) => {
    if (closed) return;
    pending.push(event);
    scheduleFlush();
  });

  return {
    // await the initial seed + any queued writes (tests and teardown use this)
    async flush() { await seeded; await flush(); },
    async close() { closed = true; unsubscribe(); await this.flush(); },
  };
}

// Rebuild a log from a stored record. `createLog` is injected (from core/log.js)
// so this module stays a leaf with no core import cycle.
export function rehydrateLog(createLog, record) {
  if (typeof createLog !== 'function') throw new Error('rehydrateLog: createLog must be a function');
  const log = createLog({ docId: record?.docId });
  for (const ev of record?.events ?? []) {
    // Strip the seal fields (seq/eo are recomputed by append; t is preserved via ev.t).
    const { seq, eo, ...op } = ev;
    log.append(op);
  }
  return log;
}
