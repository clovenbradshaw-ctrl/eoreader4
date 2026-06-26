// The mind's store — where the MEMORIES live, not the books.
//
// The mind never keeps a copy of the corpus text. What it keeps is the
// irreducible memory of having read it: an inverted index (token → the
// sentences that hold it) and a book table mapping each text to its source
// URI. A cited span is materialised on demand, from the source, by the
// resolver (retrieve.js) — never from anything stored here. This is the
// repo's own tenet at corpus scale: the source is truth; the mind is a
// projection that points back to it.
//
// The store is backend-agnostic. The browser persists to the Origin Private
// File System (process-once, then hydrate); a test drives it against an
// in-memory Map with the identical surface. Every consumer (build, retrieve)
// speaks only this interface, so neither knows nor cares which backend it has.
//
// LAYOUT (paths the build writes and retrieve reads):
//   manifest.json            — signature, book table, group cursor, bucket count
//   vocab.json               — the corpus token vocabulary (for the fuzzy seam)
//   idx/g<g>/b<b>.json       — postings shard: { token: [globalSentId, …] }
//
// Postings are sharded by (row-group g) × (token-bucket b). Per-group shards
// mean a build flushes each group once and never rewrites — the cursor in the
// manifest makes the whole build resumable after an interrupted load, exactly
// the survives-interruption property a holon owes (architecture.md).

// Which bucket a token falls in — a stable string hash, independent of any
// runtime (so the Node preparse and the browser build agree byte-for-byte).
export const bucketOf = (token, buckets) => {
  let h = 2166136261;                       // FNV-1a, the same family embed-hash uses
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % buckets;
};

const shardPath = (g, b) => `idx/g${g}/b${b}.json`;

// An in-memory backend — the test substrate, and the reference the OPFS
// backend must behave identically to. A plain path→value Map.
export const memoryBackend = () => {
  const m = new Map();
  return {
    kind: 'memory',
    async getJSON(path) { return m.has(path) ? structuredClone(m.get(path)) : null; },
    async putJSON(path, value) { m.set(path, structuredClone(value)); },
    async has(path) { return m.has(path); },
    async clear() { m.clear(); },
  };
};

// The OPFS backend — one directory tree under the origin's private file
// system. Files are written whole (the shards are append-once), so there is
// no partial-write hazard: an interrupted build leaves complete shards up to
// the last flushed group, and the manifest cursor names exactly that group.
export const opfsBackend = async (root = 'mind') => {
  if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory)
    throw new Error('OPFS unavailable');
  const base = await navigator.storage.getDirectory();
  const dir = await base.getDirectoryHandle(root, { create: true });

  // Resolve a/b/c.json to its containing directory handle, creating dirs.
  const dirFor = async (path) => {
    const parts = path.split('/');
    let d = dir;
    for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
    return [d, parts[parts.length - 1]];
  };

  return {
    kind: 'opfs',
    async getJSON(path) {
      try {
        const [d, name] = await dirFor(path);
        const fh = await d.getFileHandle(name);
        const text = await (await fh.getFile()).text();
        return JSON.parse(text);
      } catch { return null; }                 // missing file → null, never throws
    },
    async putJSON(path, value) {
      const [d, name] = await dirFor(path);
      const fh = await d.getFileHandle(name, { create: true });
      const w = await fh.createWritable();
      await w.write(JSON.stringify(value));
      await w.close();
    },
    async has(path) {
      try { const [d, name] = await dirFor(path); await d.getFileHandle(name); return true; }
      catch { return false; }
    },
    async clear() {
      try { await base.removeEntry(root, { recursive: true }); } catch { /* already gone */ }
    },
  };
};

// The store: a thin, typed surface over whichever backend it was handed. It
// owns the path scheme; consumers never spell a path themselves.
export const createStore = (backend) => ({
  backend,
  async manifest()              { return backend.getJSON('manifest.json'); },
  async writeManifest(m)        { return backend.putJSON('manifest.json', m); },
  async vocab()                 { return (await backend.getJSON('vocab.json')) || []; },
  async writeVocab(list)        { return backend.putJSON('vocab.json', list); },
  async shard(g, b)             { return (await backend.getJSON(shardPath(g, b))) || {}; },
  async writeShard(g, b, obj)   { return backend.putJSON(shardPath(g, b), obj); },
  async clear()                 { return backend.clear(); },
});
