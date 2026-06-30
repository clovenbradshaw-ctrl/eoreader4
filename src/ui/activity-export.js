// Export the WHOLE session as a single file — every stream of activity folded
// into one artifact. The app already exports each surface on its own (the audit
// as JSONL, each document's reading log as JSONL, the chat window as Markdown);
// this is the "give me everything, in one file" export, so a session can be
// archived, replayed, or audited end-to-end without grabbing four downloads.
//
// One JSON document carries all three streams the session keeps:
//
//   • transcript — the chat window as it reads: each message, who spoke.
//   • audit      — every turn through the pipeline, the full machine-readable
//                  record (the same records the Audit pane's JSONL export hands
//                  back): prompt, raw output, reading, bindings, vetoes, flags.
//   • documents  — every loaded document's reading log: the append-only event
//                  log the graph is a fold of, verbatim, one entry per document.
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

// Pure fold: take the three streams as plain data and assemble the single
// bundle. `counts` is a header so a reader can see the shape without walking the
// whole file. Versioned so a downstream replay can branch on the schema.
export const buildActivityBundle = ({
  transcript = [], audit = [], documents = [], exportedAt = null,
} = {}) => ({
  kind: 'eoreader4-activity',
  version: 1,
  exportedAt,
  counts: {
    messages:  transcript.length,
    turns:     audit.length,
    documents: documents.length,
    events:    documents.reduce((n, d) => n + (d.events?.length || 0), 0),
  },
  transcript,
  audit,
  documents,
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
// back an empty file (matching exportAudit / exportLog / exportChat).
const isEmpty = (b) =>
  !b.transcript.length && !b.audit.length && !b.documents.some((d) => d.events.length);

// Orchestrate the single-file export. Gathers the live session: the chat
// transcript (STATE.history), the full audit (STATE.audit), and every loaded
// document's reading log (STATE.docs, a docId→doc Map). Returns false when
// nothing has happened yet, so the menu can report "nothing to export".
export const exportActivity = ({ history = [], audit = null, docs = null } = {}) => {
  const transcript = (history || [])
    .filter((m) => m && m.content)
    .map((m) => ({ role: m.role || 'note', content: String(m.content) }));
  const auditRecords = audit ? parseJSONL(audit.exportJSONL()) : [];
  const documents = [];
  for (const [docId, doc] of (docs || [])) {
    documents.push({ docId, events: parseJSONL(serializeLog(doc)) });
  }

  const stamp = new Date();
  const bundle = buildActivityBundle({
    transcript, audit: auditRecords, documents, exportedAt: stamp.toLocaleString(),
  });
  if (isEmpty(bundle)) return false;   // nothing read or said yet — no empty file

  const slug = stamp.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  return downloadText(`eoreader4-activity-${slug}.json`, serializeActivity(bundle), 'application/json');
};
