// Export the WHOLE session as a single file — every stream of activity folded
// into one artifact. The app already exports each surface on its own (the audit
// as JSONL, each document's reading log as JSONL, the chat window as Markdown);
// this is the "give me everything, in one file" export, so a session can be
// archived, replayed, or audited end-to-end without grabbing four downloads.
//
// One JSON document carries the streams the session keeps:
//
//   • transcript — the chat window as it reads: each message, who spoke.
//   • audit      — every turn through the pipeline, the full machine-readable
//                  record (the same records the Audit pane's JSONL export hands
//                  back): prompt, raw output, reading, bindings, vetoes, flags.
//   • documents  — every loaded document's reading log: the append-only event
//                  log the graph is a fold of, verbatim, one entry per document.
//   • webSources — POINTERS to the web pages the session imported, NOT their text.
//                  The full bytes of every fetched page are kept as binary in OPFS
//                  (ingest/opfs-store.js); the export references each page by its
//                  url and its OPFS location (dir/file + content hash), so the
//                  artifact stays small and the page is re-readable from the web
//                  or the local cache — "don't include the full text it imported,
//                  but pointers to it on the web."
//
// A web-source document never carries its full reading log here either: in the
// documents stream it collapses to the same pointer (see webDocPointer), because
// its text is what OPFS holds and the export points at, not embeds.
//
// The builder is pure (data → object) and DOM-free, so the shape is unit-testable
// without a browser. The orchestrator is the only part that touches the session
// and the page.

import { downloadText } from './chat-export.js';
import { serializeLog } from './log-view.js';

// Parse a JSONL blob (what the existing serialisers hand back) into an array of
// objects, resilient per line so one malformed line can't sink the bundle —
// mirroring the per-line resilience serializeLog / exportJSONL already apply on
// the way out. A bad line is kept as a marker, never dropped silently.
const parseJSONL = (text) =>
  String(text || '')
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      try { return JSON.parse(line); }
      catch (err) { return { parse_error: String(err?.message || err), raw: line }; }
    });

// True when a loaded document originated on the web (websource.js stamps both).
// Such a document is exported as a pointer, never as its full reading log.
export const isWebDoc = (doc) =>
  !!doc && (doc.sourceKind === 'web-source' || !!doc.web);

// Build a pointer to a web-imported page from a loaded doc — the metadata an
// export carries IN PLACE of the page's text: where it lives on the web (url),
// where its full bytes are cached (the OPFS content hash), and its identity.
// `events` is the count of reading-log events DROPPED by reference, so the
// header stays honest about what the pointer stands in for. No page text.
export const webDocPointer = (docId, doc) => {
  const w = doc?.web || {};
  const events = doc?.log?.events?.length ?? doc?.log?.length ?? 0;
  return {
    docId, sourceKind: 'web-source', kind: 'web-pointer',
    pointer: {
      url: w.url || null, final_url: w.final_url || null, title: w.title || null,
      content_hash: w.content_hash || null,
      fetched_at: w.fetched_at || null, published: w.published || null,
      retrieval_query: w.retrieval_query || null, engine: w.engine || null,
    },
    events_omitted: events,    // the reading log lives in OPFS / on the web, referenced not embedded
  };
};

// Normalise a raw-store pointer (opfs-store.js `list()`) into the export shape —
// url + the OPFS location of the cached bytes (dir/file) + the content hash +
// byte count. Metadata only; the bytes stay in OPFS.
export const webSourcePointer = (p = {}) => ({
  content_hash: p.content_hash || p.key || null,
  url: p.url || null, final_url: p.final_url || null, title: p.title || null,
  fetched_at: p.fetched_at || null,
  bytes: p.bytes ?? null,
  opfs: (p.dir && p.file) ? `${p.dir}/${p.file}` : (p.file || null),
  persisted: p.persisted ?? null,
});

// Pure fold: take the streams as plain data and assemble the single bundle.
// `counts` is a header so a reader can see the shape without walking the whole
// file. Versioned so a downstream replay can branch on the schema.
export const buildActivityBundle = ({
  transcript = [], audit = [], documents = [], webSources = [], exportedAt = null,
} = {}) => ({
  kind: 'eoreader4-activity',
  version: 2,
  exportedAt,
  counts: {
    messages:    transcript.length,
    turns:       audit.length,
    documents:   documents.length,
    events:      documents.reduce((n, d) => n + (d.events?.length || 0), 0),
    webSources:  webSources.length,
  },
  transcript,
  audit,
  documents,
  webSources,
});

// Serialise the bundle to a single pretty-printed JSON string. Resilient: a
// circular ref that somehow survived into a record yields a minimal valid file
// rather than throwing the export away.
export const serializeActivity = (bundle) => {
  try { return JSON.stringify(bundle, null, 2); }
  catch (err) {
    return JSON.stringify({ kind: 'eoreader4-activity', export_error: String(err?.message || err) }, null, 2);
  }
};

// True when there is nothing to export yet — so the caller can refuse to hand
// back an empty file (matching exportAudit / exportLog / exportChat). A web
// pointer counts as content (a session that only gathered the web still has
// something to export).
const isEmpty = (b) =>
  !b.transcript.length && !b.audit.length && !b.webSources.length &&
  !b.documents.some((d) => (d.events?.length || d.events_omitted || 0));

// Orchestrate the single-file export. Gathers the live session: the chat
// transcript (STATE.history), the full audit (STATE.audit), every loaded
// document's reading log (STATE.docs, a docId→doc Map), and the pointer manifest
// of imported web pages (the OPFS raw store). A web-source document collapses to
// a pointer; its bytes are kept in OPFS and referenced, never embedded. Async
// because the raw store reads its manifest from OPFS. Resolves to false when
// nothing has happened yet, so the menu can report "nothing to export".
export const exportActivity = async ({ history = [], audit = null, docs = null, rawStore = null } = {}) => {
  const transcript = (history || [])
    .filter((m) => m && m.content)
    .map((m) => ({ role: m.role || 'note', content: String(m.content) }));
  const auditRecords = audit ? parseJSONL(audit.exportJSONL()) : [];
  const documents = [];
  for (const [docId, doc] of (docs || [])) {
    // A web-imported document is referenced by pointer (its text is in OPFS / on
    // the web); a local document carries its full reading log as before.
    documents.push(isWebDoc(doc) ? webDocPointer(docId, doc) : { docId, events: parseJSONL(serializeLog(doc)) });
  }
  // The pointer manifest of every page the session fetched — url + OPFS location,
  // never the page text. Best-effort: a store fault yields no web sources.
  let webSources = [];
  if (rawStore && typeof rawStore.list === 'function') {
    try { webSources = (await rawStore.list()).map(webSourcePointer); }
    catch { webSources = []; }
  }

  const stamp = new Date();
  const bundle = buildActivityBundle({
    transcript, audit: auditRecords, documents, webSources, exportedAt: stamp.toLocaleString(),
  });
  if (isEmpty(bundle)) return false;   // nothing read or said yet — no empty file

  const slug = stamp.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return downloadText(`eoreader4-activity-${slug}.json`, serializeActivity(bundle), 'application/json');
};
