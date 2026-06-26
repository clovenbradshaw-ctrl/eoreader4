// Preparse the corpus — the Node twin of the in-browser build.
//
// The browser builds the mind by streaming the parquet and writing shards to
// OPFS. This does the IDENTICAL work to a directory on disk, using the same
// build (buildMind) and the same store path scheme — only the backend differs
// (a filesystem backend here vs. OPFS in the tab). The output is therefore the
// exact OPFS layout (manifest.json, vocab.json, idx/g*/b*.json), so a prebuilt
// index can be hosted and hydrated into OPFS instead of paying the build in the
// tab — the "preparse it" path, for those who would rather not read 1.5 GB in a
// browser.
//
// Requires hyparquet + hyparquet-compressors (devDependencies). The runtime
// browser path needs neither — it loads them from a CDN.
//
//   node scripts/preparse-corpus.mjs [url] [outDir] [--buckets N] [--groups N]

import { mkdir, writeFile, readFile, rm, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createStore } from '../src/mind/store.js';
import { buildMind, DEFAULT_BUCKETS } from '../src/mind/build.js';
import { createParquetSource } from '../src/mind/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_URL = 'https://storage.googleapis.com/intelechia-content/eo-mind/gutenberg_en_3400.parquet';

const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));

const url     = positional[0] || DEFAULT_URL;
const outDir  = join(ROOT, positional[1] || 'mind-index');
const buckets = Number(flag('--buckets', DEFAULT_BUCKETS));
const maxGroups = flag('--groups', null) != null ? Number(flag('--groups', null)) : Infinity;

// A filesystem backend with the same surface as store.js's memory/OPFS backends.
const fsBackend = (base) => ({
  kind: 'fs',
  async getJSON(path) { try { return JSON.parse(await readFile(join(base, path), 'utf8')); } catch { return null; } },
  async putJSON(path, value) { await mkdir(dirname(join(base, path)), { recursive: true }); await writeFile(join(base, path), JSON.stringify(value)); },
  async has(path) { try { await access(join(base, path)); return true; } catch { return false; } },
  async clear() { await rm(base, { recursive: true, force: true }); },
});

const loadLib = async () => {
  try {
    const [hp, hc] = await Promise.all([import('hyparquet'), import('hyparquet-compressors')]);
    return { parquetMetadataAsync: hp.parquetMetadataAsync, parquetReadObjects: hp.parquetReadObjects, compressors: hc.compressors };
  } catch {
    console.error('Missing parquet deps. Install them:\n  npm i -D hyparquet hyparquet-compressors');
    process.exit(1);
  }
};

const real = createParquetSource({ url, loadLib });
// Optionally cap the number of groups (for a quick partial build / smoke test).
const source = maxGroups === Infinity ? real : {
  get groupCount() { return real.groupCount; },
  signature: () => real.signature(),
  async *groups() { let n = 0; for await (const g of real.groups()) { if (n++ >= maxGroups) break; yield g; } },
  getBookText: (b) => real.getBookText(b),
};

console.log(`preparsing ${url}\n  → ${outDir}  (buckets ${buckets}${maxGroups === Infinity ? '' : `, first ${maxGroups} groups`})`);
const t0 = Date.now();
const store = createStore(fsBackend(outDir));
const man = await buildMind({
  source, store, buckets,
  onProgress: ({ group, groups, books, sentences, phase }) => {
    if (phase === 'flush') console.log(`  group ${group}${groups ? `/${groups - 1}` : ''} flushed · ${books} books · ${sentences.toLocaleString()} sentences`);
  },
});
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${man.books.length} books · ${man.totalSentences.toLocaleString()} sentences · vocab ${man.vocabSize?.toLocaleString?.() || '?'}`);
