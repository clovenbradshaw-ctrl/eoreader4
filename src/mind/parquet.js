// The corpus as a book source — a Project Gutenberg parquet, read in place.
//
// The file is never downloaded whole. hyparquet reads it through an AsyncBuffer
// of HTTP range requests, decoding one row group at a time; the ZSTD pages are
// decoded by hyparquet-compressors. Both are loaded by URL on first use, the
// same way model/embed.js loads transformers.js — no build step, no bundle.
//
// The decoder is injectable (loadLib): the Node preparse passes the installed
// package, a test passes a fake corpus, and the browser falls back to the CDN.
//
// Two roles, one source: build streams every group once (groups()); the
// resolver fetches a single book's text on demand to materialise a cited span
// (getBookText), caching the group it lands in.

const HYPARQUET   = 'https://cdn.jsdelivr.net/npm/hyparquet@1/+esm';
const COMPRESSORS = 'https://cdn.jsdelivr.net/npm/hyparquet-compressors@1/+esm';

const cdnLoad = async () => {
  const [hp, hc] = await Promise.all([import(/* @vite-ignore */ HYPARQUET), import(/* @vite-ignore */ COMPRESSORS)]);
  return { parquetMetadataAsync: hp.parquetMetadataAsync, parquetReadObjects: hp.parquetReadObjects, compressors: hc.compressors };
};

const parseMeta = (raw) => { try { return JSON.parse(raw || '{}'); } catch { return {}; } };

export const createParquetSource = ({ url, loadLib = cdnLoad, fetchImpl = fetch } = {}) => {
  let lib = null, meta = null, size = 0, etag = '', groupRows = null;

  const asyncBuffer = (total) => ({
    byteLength: total,
    async slice(start, end) {
      const last = (end ?? total) - 1;
      const res = await fetchImpl(url, { headers: { Range: `bytes=${start}-${last}` } });
      return res.arrayBuffer();
    },
  });
  let file = null;

  const init = async () => {
    if (meta) return;
    lib = await loadLib();
    const head = await fetchImpl(url, { method: 'HEAD' });
    size = Number(head.headers.get('content-length')) || 0;
    etag = head.headers.get('etag') || String(size);
    file = asyncBuffer(size);
    meta = await lib.parquetMetadataAsync(file);
    // Cumulative [rowStart, rowEnd) per row group — the rows() windows.
    groupRows = [];
    let acc = 0;
    for (const rg of meta.row_groups) { const n = Number(rg.num_rows); groupRows.push([acc, acc + n]); acc += n; }
  };

  const groupCache = new Map();                       // group → rows (LRU-ish, capped)
  const readGroup = async (g) => {
    if (groupCache.has(g)) return groupCache.get(g);
    const [s, e] = groupRows[g];
    const rows = await lib.parquetReadObjects({ file, compressors: lib.compressors, rowStart: s, rowEnd: e });
    if (groupCache.size > 3) groupCache.delete(groupCache.keys().next().value);
    groupCache.set(g, rows);
    return rows;
  };

  const toBook = (r, globalRow, group) => {
    const md = parseMeta(r.METADATA);
    return {
      text_id: md.text_id, title: md.title, authors: md.authors,
      subjects: md.subjects, locc: md.locc, text: r.TEXT || '',
      row: globalRow, group,
    };
  };

  const source = {
    get groupCount() { return meta ? meta.row_groups.length : 0; },
    async signature() { await init(); return { etag, size, rows: Number(meta.num_rows) }; },
    async *groups() {
      await init();
      for (let g = 0; g < meta.row_groups.length; g++) {
        const [s] = groupRows[g];
        const rows = await readGroup(g);
        yield { group: g, books: rows.map((r, i) => toBook(r, s + i, g)) };
        groupCache.delete(g);                          // build is one-pass — don't pin groups
      }
    },
    async getBookText(book) {
      await init();
      const rows = await readGroup(book.group);
      const [s] = groupRows[book.group];
      return rows[book.row - s]?.TEXT || '';
    },
  };
  return source;
};
