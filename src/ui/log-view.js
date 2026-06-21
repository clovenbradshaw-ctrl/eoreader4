// The log view — see the append-only log the graph is a fold of, organised by
// the recursive levels of reading. The graph is not the source of truth; this
// is. Each level reads what the level below admitted and refines it, so the
// meaning is approached in passes, never decided in one:
//
//   Pass 0 · conventions   REC          what the document taught the reader
//   Level 1 · existence    NUL · INS    what is held, what is admitted
//   Level 2 · structure    SYN CON SIG DEF SEG   how figures bond and merge
//   Level 3 · significance DEF role     the role a unit plays (site vs figure)
//
// Every event traces to the line it came from — click [sN] to jump there.
//
// Each row also carries its eo-address — operator(Site, Stance) — computed
// live by `eoNotation`, never stamped on the event. The log stays the single
// source of truth; the address is a reading of it. Surfacing it per row makes
// "the spec is the notation" literal: every line is a point on the EO cube.

import { eoNotation, eoAddressOfEvent } from '../core/index.js';
import { positionElements } from '../reader/parse/index.js';

const LEVELS = [
  { key: 'p0', name: 'Pass 0 · conventions', note: 'what this document taught the reader',
    match: (e) => e.op === 'REC' },
  { key: 'l1', name: 'Level 1 · existence', note: 'lines held, figures admitted — counting',
    match: (e) => e.op === 'NUL' || e.op === 'INS' },
  { key: 'l2', name: 'Level 2 · structure', note: 'bonds, attributions, syntheses — the graph',
    match: (e) => e.op === 'CON' || e.op === 'SIG' || e.op === 'SYN' || e.op === 'SEG' ||
                  (e.op === 'DEF' && e.key !== 'role') },
  { key: 'l3', name: 'Level 3 · significance / role', note: 'the role a unit plays — semantic',
    match: (e) => (e.op === 'DEF' && e.key === 'role') || e.op === 'EVA' },
];

export const renderLog = (doc, root, { onSelectSentence } = {}) => {
  root.innerHTML = '';
  if (!doc || !doc.log) {
    root.innerHTML = `<div class="graph-empty">No document yet — the event log appears here once one is read.</div>`;
    return;
  }
  const events = doc.log.events || doc.log.snapshot?.() || [];
  const label = new Map();
  for (const e of events) if (e.op === 'INS' && !label.has(e.id)) label.set(e.id, e.label);
  const name = (id) => label.get(id) || id;

  const head = document.createElement('div');
  head.className = 'log-head';
  head.innerHTML =
    `<div class="log-head-top">` +
      `<div class="log-title">${events.length} events — the graph is a fold of this log</div>` +
      `<button type="button" class="small log-export"${events.length ? '' : ' disabled'}>Export JSONL</button>` +
    `</div>` +
    `<div class="log-sub">each level reads what the one below admitted, approaching the meaning in passes</div>` +
    `<div class="log-sub">every row carries its address — <span class="log-addr">operator(Site, Stance)</span> — read live, never stored</div>`;
  root.appendChild(head);
  // The button hands back the *whole* log — every event, in seq order — not the
  // level-grouped subset rendered below (which filters to the operators each
  // level reads). The log is the single source of truth; the export is it, in full.
  head.querySelector('.log-export')?.addEventListener('click', () => exportLog(doc));

  for (const lvl of LEVELS) {
    const evs = events.filter(lvl.match);
    if (evs.length === 0) continue;
    const sec = document.createElement('div');
    sec.className = 'log-level';
    sec.innerHTML =
      `<div class="log-level-head"><span class="op ${opOf(evs[0])}">${lvl.name}</span>` +
      `<span class="log-count">${evs.length}</span><span class="log-note">${lvl.note}</span></div>`;
    const list = document.createElement('div');
    list.className = 'log-rows';
    for (const e of evs) list.appendChild(row(e, name));
    sec.appendChild(list);
    root.appendChild(sec);
  }

  root.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-idx]');
    if (a && onSelectSentence) onSelectSentence(parseInt(a.dataset.idx, 10));
  });
};

// Serialise the FULL reading log as JSONL — one sealed event per line, in append
// (seq) order. This is the whole log, not the levelled view above: that view
// groups by reading level and shows only the operators each level reads, so it is
// a lossy projection. The export is the source of truth verbatim, so a reading
// can be replayed or audited downstream with nothing dropped. Pure and DOM-free,
// so it is unit-testable; resilient per line so one bad event can't sink the file.
export const serializeLog = (doc) => {
  const log = doc?.log;
  if (!log) return '';
  const events = log.events || log.snapshot?.() || [];
  return events.map((e) => {
    try {
      return JSON.stringify(e);
    } catch (err) {
      // One un-serialisable event (e.g. a circular ref reached a payload) must
      // not sink the whole export — emit a minimal valid line that still holds
      // its place in the stream by seq.
      return JSON.stringify({ seq: e?.seq, op: e?.op, export_error: String(err?.message || err) });
    }
  }).join('\n');
};

// Hand the full log back as a downloadable JSONL file. Mirrors exportAudit: the
// anchor must be IN the document for Firefox/Safari to start the download.
export const exportLog = (doc) => {
  const text = serializeLog(doc);
  if (!text) return;            // nothing read yet — don't hand back an empty file
  const blob = new Blob([text], { type: 'application/x-ndjson' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `eoreader4-log-${slug(doc?.docId)}-${Date.now()}.jsonl`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// docId is the source filename (or a doc-<ts> stub) — keep it filename-safe.
const slug = (s) =>
  String(s || 'doc').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'doc';

const opOf = (e) => (e.op === 'DEF' && e.key === 'role') ? 'SEG' : e.op;

const row = (e, name) => {
  const el = document.createElement('div');
  el.className = 'log-row';
  const src = e.sentIdx != null ? `<span class="log-cite" data-idx="${e.sentIdx}">s${e.sentIdx}</span>` : '';
  el.innerHTML =
    `<span class="op ${e.op}">${e.op}</span>` +
    addr(e) +
    `<span class="log-desc">${describe(e, name)}</span>${src}`;
  return el;
};

// The reading's address, computed from the event at read time. eoNotation
// gives the compact operator(Domain,Grain) — e.g. DEF(Int,Fig); the tooltip
// spells out the three faces the cube reads off it: Site (where), Stance
// (how held) and Act (the operator's mode×domain).
const addr = (e) => {
  const a = eoAddressOfEvent(e);
  if (!a) return '';
  const tip =
    `Site ${a.site.domain}·${a.site.grain} (where) · ` +
    `Stance ${a.resolution.mode}·${a.resolution.grain} (how held) · ` +
    `Act ${a.act.mode}×${a.act.domain}`;
  return `<span class="log-addr" title="${escapeHtml(tip)}">${escapeHtml(eoNotation(e))}</span>`;
};

const describe = (e, name) => {
  const esc = escapeHtml;
  switch (e.op) {
    case 'REC': return `learn: “${esc(e.token)}” marks speech${e.weight ? ` ×${e.weight}` : ''}`;
    case 'NUL': return `hold: “${esc(trunc(e.text))}”`;
    case 'INS': return `${esc(e.label)}`;
    case 'SYN': return `${esc(name(e.from))} ≡ ${esc(name(e.to))}`;
    case 'CON': return `${esc(name(e.src))} —${neg(e)}${esc(e.via || 'with')}→ ${esc(name(e.tgt))}${mood(e)}${weight(e)}`;
    case 'SIG': return `${esc(name(e.src))} ⟨${neg(e)}${esc(e.via || 'says')}⟩ ${esc(name(e.tgt))}${mood(e)}${weight(e)}`;
    case 'DEF': return e.key === 'role'
      ? `${esc(e.id)} → role: ${esc(e.value)}`
      : `${esc(name(e.id))}: ${neg(e)}${esc(e.value)}${mood(e)}`;
    case 'SEG': return e.kind === 'argspan' ? argspanDesc(e) : `retract #${e.refSeq}`;
    default:    return esc(JSON.stringify(e));
  }
};

// The argument-span SEG (§3): the subject / verb / object spans the SVO parse read
// out of the clause, positioned into Ground / Figure / Pattern by information
// structure (positionElements, §4 Step C). Each position points at one verbatim span
// of the original line — the subject is the given (Ground), the object is the new
// (Figure), the verb is the relation (Pattern) — rendered as a citation that jumps to
// where it was read. The "cells" are the operator-grain bands, a separate axis, held
// at no-commit until the meaning reader is live — which is what "cells held" says.
// Exported so the serialisation is unit-testable without a DOM.
export const argspanDesc = (e) => {
  const esc = escapeHtml;
  const p = positionElements(e);
  // Each element points back to its span — a click jumps to the line it was read from.
  const cite = (sp) => sp && sp.text != null
    ? (e.sentIdx != null
        ? `<span class="log-cite" data-idx="${e.sentIdx}">“${esc(sp.text)}”</span>`
        : `“${esc(sp.text)}”`)
    : '—';
  const cells = (pos) => pos.elements.map(cite).join(', ') || '—';
  return `subj “${esc(e.subject?.text)}” · <em>${esc(e.verb?.text)}</em> · obj “${esc(e.object?.text)}” ` +
    `<span class="log-w">Ground⟨${cells(p.ground)}⟩ Figure⟨${cells(p.figure)}⟩ Pattern⟨${cells(p.pattern)}⟩ · cells held</span>`;
};

// Polarity and modality, the EO note channel the flat arrow dropped: a negated bond
// reads with a ¬ on its relation, a non-realis one trails its mood ⟨epistemic⟩.
const neg  = (e) => e.polarity === '−' ? '¬' : '';
const mood = (e) => (e.modality && e.modality !== 'realis')
  ? ` <span class="log-w">⟨${escapeHtml(e.modality)}⟩</span>` : '';
const weight = (e) => (e.w != null && e.w < 1) ? ` <span class="log-w">coupling ${e.w}</span>` : '';
const trunc = (s) => { const t = String(s || ''); return t.length > 60 ? t.slice(0, 60) + '…' : t; };
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
