// The raw web-content store — keep it ALL, as binary, in the Origin Private File System.
// (the user's directive: "save it all as binary into opfs, but we also must READ it on ingestion")
//
// A fetched page is admitted as a parsed prose doc (websource.js), but the parse keeps only what
// it could read. This store retains the FULL original bytes, uncapped, keyed by content hash, so
// nothing a site gave us is thrown away: a later turn can re-read the whole page without a refetch,
// and the provenance is the bytes themselves. Browser-only (navigator.storage.getDirectory);
// degrades to an in-memory Map where OPFS is absent (Node, tests, private-mode quirks), so callers
// never branch on capability — they always get a working put/get.

const enc = () => new TextEncoder();
const dec = () => new TextDecoder();

export const opfsAvailable = () =>
  typeof navigator !== 'undefined' && !!navigator.storage &&
  typeof navigator.storage.getDirectory === 'function';

// createRawStore({ dir }) → { put, get, has, available }. Keys are content hashes (or any string);
// values are text persisted as UTF-8 bytes. Every method is async and never throws — an OPFS fault
// falls back to the in-memory cache so admission proceeds.
export const createRawStore = ({ dir = 'eoreader-web' } = {}) => {
  const mem = new Map();           // write-through cache + the fallback when OPFS is unavailable
  let dirPromise = null;
  const directory = async () => {
    if (!opfsAvailable()) return null;
    if (!dirPromise) dirPromise = navigator.storage.getDirectory()
      .then((root) => root.getDirectoryHandle(dir, { create: true }))
      .catch(() => null);
    return dirPromise;
  };
  // OPFS file names are restricted; a content hash ("fnv:ab12…") is sanitised to a safe filename.
  const fileNameOf = (key) => `${String(key).replace(/[^a-z0-9_.-]/gi, '_')}.bin`;

  const put = async (key, text) => {
    if (key == null) return { key, bytes: 0, persisted: false };
    const bytes = enc().encode(String(text ?? ''));
    mem.set(key, bytes);
    const d = await directory();
    if (!d) return { key, bytes: bytes.length, persisted: false };
    try {
      const fh = await d.getFileHandle(fileNameOf(key), { create: true });
      const w  = await fh.createWritable();
      await w.write(bytes);
      await w.close();
      return { key, bytes: bytes.length, persisted: true };
    } catch { return { key, bytes: bytes.length, persisted: false }; }
  };

  const get = async (key) => {
    if (key == null) return null;
    if (mem.has(key)) return dec().decode(mem.get(key));
    const d = await directory();
    if (!d) return null;
    try {
      const fh  = await d.getFileHandle(fileNameOf(key));
      const buf = new Uint8Array(await (await fh.getFile()).arrayBuffer());
      mem.set(key, buf);
      return dec().decode(buf);
    } catch { return null; }
  };

  const has = async (key) => (key != null) && (mem.has(key) || (await get(key)) != null);

  return { put, get, has, available: opfsAvailable };
};
