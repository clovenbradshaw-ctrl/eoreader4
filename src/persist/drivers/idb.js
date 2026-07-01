// The IndexedDB driver — the default LOCAL backend. No homeserver, no network,
// no account: readings persist on the device that made them, exactly as the
// rest of eoreader4 runs (weights in OPFS, settings in localStorage).
//
// One object store, string keys → string values, satisfying the same four-op
// driver contract as memory.js. Larger corpora belong in IndexedDB rather than
// localStorage (no ~5 MB cap, async, off the main thread). Availability is
// checked by idbAvailable(); openCorpusStore() in ../index.js falls back to the
// memory driver where it is absent.

const DB_VERSION = 1;

export const idbAvailable = () => typeof indexedDB !== 'undefined';

function open(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, storeName, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const store = t.objectStore(storeName);
    let out;
    Promise.resolve(fn(store)).then((v) => { out = v; }).catch(reject);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const wrap = (req) => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export function idbDriver({ dbName = 'eoreader.corpus', storeName = 'records' } = {}) {
  if (!idbAvailable()) throw new Error('idbDriver: IndexedDB unavailable in this environment');
  let dbP = null;
  const db = () => (dbP ||= open(dbName, storeName));
  return {
    kind: 'idb',
    async get(key) { return tx(await db(), storeName, 'readonly', (s) => wrap(s.get(key))); },
    async set(key, value) { await tx(await db(), storeName, 'readwrite', (s) => wrap(s.put(String(value), key))); },
    async delete(key) { await tx(await db(), storeName, 'readwrite', (s) => wrap(s.delete(key))); },
    async keys() { return tx(await db(), storeName, 'readonly', (s) => wrap(s.getAllKeys())); },
  };
}
