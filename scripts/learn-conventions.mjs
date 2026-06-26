// learn-conventions.mjs — harvest natural-language CONVENTIONS from the corpus into a file.
//
// THE SPLIT (the thing an LLM cannot keep). An LLM fuses two things its weights cannot tell
// apart: the conventions of the language (how a relation is written, how a sentence is
// shaped) and the content of what it read (who did what, what is true). We keep them
// ontologically separate. This script reads the 3400-book Gutenberg corpus ONLY to learn
// the HOW — the relation-verb vocabulary, each verb's operator, the operational shape of
// sentences — and writes that to a file in the repo. It learns NOTHING about any subject;
// it does not remember a single fact. Prediction is always about the document under reading,
// never about this corpus. The corpus is where tokens and conventions come from; it is not
// what we make claims about. The mind/ holon already draws that line for retrieval (its
// header: "a SEPARATE source... never folded into the document under discussion"); this
// draws the same line for generation conventions.
//
// The engine stays pure: it ships hand-seeded conventions (core/conventions SEED_RELATION_
// TYPES); this produces the corpus-grounded companion as DATA, loadable, never hardcoded.
//
//   node scripts/learn-conventions.mjs [--groups N] [--chars N] [--top N] [--url U] [--out P]
//
// Defaults read the whole corpus at 10k chars/book (a broad sample of every book, fast to
// parse) and write data/conventions/corpus-relations.json. Coverage is logged honestly —
// what was read and what was bounded out — so the file never overstates what it saw.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createParquetSource } from '../src/mind/index.js';
import { parseText } from '../src/perceiver/parse/index.js';
import { linkInventory, createLinkLearner, OPS } from '../src/surfer/index.js';
import { OPERATORS, createConventions } from '../src/core/index.js';

// A relation predicate, by the engine's OWN conventions: not a function word, not a
// determiner/quantifier "starter", not a bare initial. The parser sometimes logs a
// determiner as a bond via on odd text; we keep only content predicates so the conventions
// describe how RELATIONS are written, using the ledger's knowledge, not an invented stoplist.
const conv = createConventions();
const isPredicate = (via) => via && via.length > 1 && !conv.isFunction(via) && !conv.isStarter(via);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };

const URL_ = flag('--url', 'https://storage.googleapis.com/intelechia-content/eo-mind/gutenberg_en_3400.parquet');
const MAX_GROUPS = flag('--groups', null) != null ? Number(flag('--groups', null)) : Infinity;
const CHARS = Number(flag('--chars', 10000));
const TOP = Number(flag('--top', 400));
const OUT = join(ROOT, flag('--out', 'data/conventions/corpus-relations.json'));

const loadLib = async () => {
  const [hp, hc] = await Promise.all([import('hyparquet'), import('hyparquet-compressors')]);
  return { parquetMetadataAsync: hp.parquetMetadataAsync, parquetReadObjects: hp.parquetReadObjects, compressors: hc.compressors };
};

const source = createParquetSource({ url: URL_, loadLib });
const sig = await source.signature();
console.log(`corpus ${URL_}\n  ${(sig.size / 1e6).toFixed(0)} MB · ${sig.rows} books · ${source.groupCount} groups`);
console.log(`reading ${MAX_GROUPS === Infinity ? 'all' : MAX_GROUPS} groups at ${CHARS} chars/book\n`);

const verbs = new Map();         // via → { count, CON, SIG, buckets:{bucket:n} }
const learner = createLinkLearner({ minEvidence: 8, samples: 200 });
const opTotals = new Array(OPS.length).fill(0);
let booksRead = 0, booksBounded = 0, totalLinks = 0, typedLinks = 0;

const tally = (links) => {
  for (const l of links) {
    totalLinks++;
    if (l.relType) typedLinks++;
    let v = verbs.get(l.via); if (!v) verbs.set(l.via, v = { count: 0, CON: 0, SIG: 0, buckets: {} });
    v.count++; v[l.op] = (v[l.op] || 0) + 1;
    if (l.relType) v.buckets[l.relType] = (v.buckets[l.relType] || 0) + 1;
  }
};

let g = 0;
for await (const { group, books } of source.groups()) {
  if (g >= MAX_GROUPS) break;
  for (const b of books) {
    let text = b.text || '';
    const s = text.search(/\*\*\* ?START OF TH/i), e = text.search(/\*\*\* ?END OF TH/i);
    if (s >= 0) text = text.slice(text.indexOf('\n', s) + 1, e > s ? e : undefined);
    // Read from the BODY, not the front matter. The first chars of a Gutenberg book are a
    // title page / table of contents / chapter list — rigid, repetitive, not prose — and
    // would dominate the conventions (chapter headings, transcriber notes). Skip into the
    // book before sampling, so we learn how prose is written, not how front matter is set.
    const off = Math.min(Math.floor(text.length * 0.12), 6000);
    const slice = text.slice(off, off + CHARS);
    if (text.length > off + CHARS) booksBounded++;
    const doc = parseText(slice, { docId: 'b' + (b.text_id ?? b.row) });
    const links = linkInventory(doc).links.filter(l => isPredicate(l.via));   // content predicates only
    tally(links);
    learner.observeLinks(links, { evaluate: false });   // accumulate; evaluate once at the end
    // operational shape of the book (how sentences are structured), summed over the corpus
    const events = typeof doc?.log?.snapshot === 'function' ? doc.log.snapshot() : (doc?.log?.events || []);
    for (const e of events) { const i = OPS.indexOf(e.op); if (i >= 0) opTotals[i]++; }
    booksRead++;
  }
  console.log(`  group ${group}/${source.groupCount - 1} · ${booksRead} books · ${verbs.size} distinct relation-verbs · ${totalLinks} links`);
  g++;
}

console.log('\nevaluating structural promotion over the accumulated links…');
learner.evaluate();

// rank the relation-verb vocabulary; record each verb's dominant operator and the seed
// bucket it falls in (when the shipped table types it) — the convention, with its evidence.
const ranked = [...verbs.entries()]
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, TOP)
  .map(([via, v]) => {
    const op = v.SIG > v.CON ? 'SIG' : 'CON';
    const bucket = Object.entries(v.buckets).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    return { via, count: v.count, op, bucket };
  });

const opSum = opTotals.reduce((a, b) => a + b, 0) || 1;
const opShape = Object.fromEntries(OPS.map((o, i) => [o, Math.round((opTotals[i] / opSum) * 1e4) / 1e4]));

const out = {
  // THE SPLIT, stated in the artifact: this is the language's HOW, not the corpus's WHAT.
  _note: 'Conventions harvested from the corpus — how relations are written and how sentences are operationally shaped. The language\'s HOW, deliberately separate from any document\'s WHAT. The engine reads conventions; it predicts about the document under reading, never about this corpus. No fact from any book is stored here.',
  source: { url: URL_, sizeBytes: sig.size, books: sig.rows, groups: source.groupCount },
  coverage: {
    booksRead, ofBooks: sig.rows,
    charsPerBook: CHARS, booksBoundedByCharLimit: booksBounded,
    note: booksBounded ? `${booksBounded} books exceeded ${CHARS} chars and were sampled to that bound (no silent truncation — the rest of each long book was not read)` : 'every read book fit within the char bound',
  },
  totals: { relationLinks: totalLinks, typedByShippedVocabulary: typedLinks, typedFraction: totalLinks ? Math.round((typedLinks / totalLinks) * 1e4) / 1e4 : 0, distinctVerbs: verbs.size },
  // how sentences are operationally shaped, across the corpus (the cube's Act face mass).
  operationalShape: opShape,
  operatorLegend: Object.fromEntries(OPS.map(o => [o, `${OPERATORS[o].mode} · ${OPERATORS[o].domain}`])),
  // the relation-verb vocabulary: how relations are written, with operator + seed bucket.
  relationVerbs: ranked,
  // structurally PROMOTED link-types: verbs whose links cohere beyond a same-operator null
  // (structure alone earned a more-specific type). Expected to be sparse — most recurring
  // verbs name regularities structure cannot separate; that sparsity is itself the finding.
  learnedLinkTypes: learner.learnedTypes(),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

console.log(`\n${booksRead}/${sig.rows} books read · ${verbs.size} distinct relation-verbs · ${totalLinks} links (${(out.totals.typedFraction * 100).toFixed(1)}% typed by the shipped vocabulary)`);
console.log(`structurally promoted link-types: ${learner.learnedTypes().length}`);
console.log(`operational shape: ${OPS.map((o, i) => `${o} ${opShape[o]}`).join('  ')}`);
console.log(`\nwrote ${OUT}`);
