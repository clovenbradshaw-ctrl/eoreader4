// External web pages as first-class groundable sources.
// (docs/web-search.md; ported from eoreader3 docs/web-source-admission.md)
//
// A page found on the web becomes a source with PROVENANCE: parsed, embedded, and admitted
// through the SAME pipeline an uploaded document travels (parseText → graph). Claims cite it the
// way they cite a file, and the veto checks them identically. This is a SOURCING function, not a
// model tool — the talker never reaches the network. The mechanical layer fetches (a proxy, off
// by default) and admits; the model only PROPOSES a query.
//
// Admission is OFFLINE and pure: given a fetched payload { url, text, … } it mints a frozen
// web-source/1 record and a prose doc that drops straight into the answer scope — the docs[]
// array runTurn folds into a composite, so the web source enters retrieval ranking and its
// cited spans trace back through the composite's origin() with no pipeline change. Search/fetch
// live behind the proxy seam; this core is what they feed.

import { parseText } from '../perceiver/parse/index.js';

// A deterministic content hash. The proxy computes a real sha256 at fetch time and ships it on
// the payload; absent that (offline / a test), a pure 64-bit FNV-1a stand-in keeps freeze /
// supersede / staleness working with no crypto dependency. Either way it is STABLE on the text,
// so a changed page → a changed hash → a new record.
export const webContentHash = (text) => {
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c + i) & 0xff), 0x01000193) >>> 0;
  }
  return 'fnv:' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
};

const hash16 = (contentHash) => String(contentHash).replace(/^[^:]*:/, '').slice(0, 16).padEnd(16, '0');

// The record id is colon-namespaced (web:<hash16>) for citation source_ids; the ENGINE doc id
// swaps the colon for a hyphen (web-<hash16>) because citation markers split on ':'. The two are
// a reversible bridge (eoreader3 reconciliation #2).
export const recordIdOf    = (contentHash) => `web:${hash16(contentHash)}`;
export const engineDocId   = (recordId)    => String(recordId).replace(':', '-');
export const recordIdForDoc = (engineId)   => String(engineId).replace(/^web-/, 'web:');

// Mint the frozen web-source/1 record from a fetched payload. status ∈ active|superseded|retracted.
export const webRecord = (payload = {}) => {
  const content_hash = payload.content_hash || webContentHash(payload.text);
  const id = recordIdOf(content_hash);
  return Object.freeze({
    schema: 'web-source/1', id, kind: 'web-source',
    url: payload.url || null, final_url: payload.final_url || payload.url || null,
    title: payload.title || null, byline: payload.byline || null,
    excerpt: (payload.excerpt || String(payload.text || '').replace(/\s+/g, ' ').trim().slice(0, 240)) || null,
    retrieval_query: payload.retrieval_query || null, engine: payload.engine || null,
    fetched_at: payload.fetched_at || null,    // stamped by the fetcher; never minted here
    content_hash, status: 'active',
  });
};

// admitWebSource(payload) → { doc, record }. The doc is a normal prose document (so every
// pipeline path treats it identically — eoreader3 reconciliation #1) whose WEB identity rides as
// additive metadata, and whose docId is unique + colon-free so its cited spans trace back through
// the composite's origin().
// Cap the prose handed to parseText. A real web page reduces to tens of thousands of chars
// (thousands of sentences); parseText is synchronous O(n) work on the main thread, so an
// uncapped page FREEZES the tab — the observed jank when search runs. The lede + first sections
// carry the answer for grounding; cap there. (~8k chars ≈ 100–130 sentences.)
const MAX_WEB_CHARS = 8000;

export const admitWebSource = (payload = {}) => {
  const record = webRecord(payload);
  const docId  = engineDocId(record.id);
  const doc    = parseText(String(payload.text || '').slice(0, MAX_WEB_CHARS), { docId });
  doc.sourceKind = 'web-source';
  doc.web = {
    url: record.url, final_url: record.final_url, title: record.title,
    fetched_at: record.fetched_at, content_hash: record.content_hash,
    retrieval_query: record.retrieval_query, engine: record.engine,
  };
  doc._webRecord = record;
  return { doc, record };
};

// The citation a web-grounded claim carries — the same char_span the veto's token check reads.
export const toWebCitation = (record, segment_id, char_span) => Object.freeze({
  type: 'web-source', source_id: record.id, segment_id, char_span,
  url: record.url, fetched_at: record.fetched_at, content_hash: record.content_hash,
});

// Provenance integrity (§13.9): a citation is honoured only against an ACTIVE record whose hash
// still matches — a superseded/retracted source, or a hash drift, fails closed.
export const verifyCitation = (record, citation) =>
  !!record && record.status === 'active' &&
  !!citation && citation.content_hash === record.content_hash;

// A minimal web-source store — freeze, supersede, retract; it never overwrites (the log's
// SEG/retract law, applied to sources). Keyed by url so the SAME page over time SUPERSEDES (a
// changed hash mints a new record, the old retained as 'superseded'); an unchanged page returns
// the existing source; a new url is a new entry.
export const createWebStore = () => {
  const byId = new Map();           // record id → { record, doc }
  const latestForUrl = new Map();   // url → record id

  const admit = (payload) => {
    const { doc, record } = admitWebSource(payload);
    const prevId = record.url ? latestForUrl.get(record.url) : null;
    if (prevId && byId.has(prevId)) {
      const prev = byId.get(prevId);
      if (prev.record.content_hash === record.content_hash) return { ...prev, fresh: false, superseded: null };
      byId.set(prevId, { ...prev, record: { ...prev.record, status: 'superseded' } });   // changed → supersede, retained
    }
    byId.set(record.id, { record, doc });
    if (record.url) latestForUrl.set(record.url, record.id);
    return { record, doc, fresh: true, superseded: (prevId && prevId !== record.id) ? prevId : null };
  };
  const retract = (id) => {
    const e = byId.get(id);
    if (!e) return null;
    byId.set(id, { ...e, record: { ...e.record, status: 'retracted' } });
    return id;
  };
  const get    = (id) => byId.get(id) || null;
  const active = () => [...byId.values()].filter(e => e.record.status === 'active');
  return { admit, retract, get, active };
};
