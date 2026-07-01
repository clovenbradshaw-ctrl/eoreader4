// The corpus store — durable memory for the documents a reader has opened and
// the event logs folded from them. Today eoreader4 keeps the whole corpus in
// memory (STATE.docs); a reload loses every loaded document and its reading.
// This store is the seam that makes them survive, WITHOUT a database or an
// app-managed API tier: it writes JSON records through a pluggable driver
// (local IndexedDB by default, a Matrix room optionally) and reads them back.
//
// A record is the minimum needed to bring a document back:
//
//   { docId, modality, name, source?, events, meta?, addedAt, updatedAt, eventCount }
//
// `events` is the append-only log's snapshot — the single source of truth; the
// doc's derived structures (spans, mentions, graph) are a fold of it and are
// rebuilt on rehydrate, never stored. `source` is the raw input (text, or a
// small descriptor) an adapter needs to re-ingest richer modalities.
//
// Keys in the driver:  index → the light catalogue (list() reads only this),
//                      doc:<docId> → the full record.
// The value handed to the driver passes through the envelope, so with a
// passwordEnvelope the driver only ever holds ciphertext.

const INDEX = 'index';
const recKey = (docId) => `doc:${docId}`;

const now = () => Date.now();

// The catalogue entry — everything list() needs without reading full logs.
const lightOf = (rec) => ({
  docId: rec.docId,
  modality: rec.modality ?? null,
  name: rec.name ?? rec.docId,
  addedAt: rec.addedAt,
  updatedAt: rec.updatedAt,
  eventCount: rec.eventCount ?? (Array.isArray(rec.events) ? rec.events.length : 0),
});

export function createCorpusStore({ driver, envelope } = {}) {
  if (!driver) throw new Error('createCorpusStore: a driver is required');
  const seal = envelope?.seal ? (s) => envelope.seal(s) : async (s) => s;
  const open = envelope?.open ? (s) => envelope.open(s) : async (s) => s;

  const readJSON = async (key) => {
    const raw = await driver.get(key);
    if (raw == null) return null;
    try { return JSON.parse(await open(raw)); } catch { return null; }
  };
  const writeJSON = async (key, obj) => { await driver.set(key, await seal(JSON.stringify(obj))); };

  const readIndex = async () => (await readJSON(INDEX)) ?? {};
  const writeIndex = (idx) => writeJSON(INDEX, idx);

  async function put(record) {
    if (!record || !record.docId) throw new Error('corpusStore.put: record.docId is required');
    const idx = await readIndex();
    const prior = idx[record.docId];
    const rec = {
      source: null,
      meta: null,
      ...record,
      events: Array.isArray(record.events) ? record.events : [],
      addedAt: prior?.addedAt ?? record.addedAt ?? now(),
      updatedAt: now(),
    };
    rec.eventCount = rec.events.length;
    await writeJSON(recKey(rec.docId), rec);
    idx[rec.docId] = lightOf(rec);
    await writeIndex(idx);
    return lightOf(rec);
  }

  async function get(docId) { return readJSON(recKey(docId)); }

  async function list() {
    const idx = await readIndex();
    return Object.values(idx).sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0));
  }

  async function has(docId) {
    const idx = await readIndex();
    return Object.prototype.hasOwnProperty.call(idx, docId);
  }

  async function remove(docId) {
    await driver.delete(recKey(docId));
    const idx = await readIndex();
    if (docId in idx) { delete idx[docId]; await writeIndex(idx); }
  }

  // Incremental append — the hot path for attachPersistence: fold new log events
  // into the stored record without re-reading a huge events array on every emit.
  // (Correct-but-simple: read-modify-write the record. A future optimization can
  // chunk events into separate keys the way amino's blocks.js does.)
  async function appendEvents(docId, events) {
    if (!events || !events.length) return;
    const rec = (await get(docId)) ?? { docId, events: [], addedAt: now() };
    rec.events = (rec.events || []).concat(events);
    await put(rec);
  }

  async function clear() {
    const idx = await readIndex();
    for (const docId of Object.keys(idx)) await driver.delete(recKey(docId));
    await driver.delete(INDEX);
  }

  return {
    driver, envelope: envelope ?? null,
    put, get, list, has, remove, appendEvents, clear,
  };
}
