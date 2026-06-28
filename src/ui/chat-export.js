// Exporting the chat window. Two flavours, both downloaded as a Markdown file:
//
//   • TEXT ONLY — the conversation as it reads: each turn, who spoke, what they
//     said. The clean transcript, nothing else. This is the "give me the chat"
//     export — paste it into a doc, an email, another model.
//
//   • FULL AUDIT — everything going on behind each answer: the pipeline stages,
//     the reading the surfer delivered (the spans, the per-cursor surprise
//     field), the verbatim prompt the model received, its raw output, the bound
//     claims, the vetoes and flags. The same record the Audit pane shows, laid
//     out as one readable document so the prompting and surfing are legible end
//     to end. (The Audit pane's own button still hands back machine-readable
//     JSONL; this is the human-readable companion.)
//
// The builders are pure — they take data, return a string — so the formatting
// is unit-testable without the DOM. The download helper is the only part that
// touches the page.

// ── Text-only transcript ───────────────────────────────────────────────────
//
// Walk the running transcript (role + content) the session feeds back each
// turn. This carries the whole window — including any messages a fork seeded —
// not just the turns that reached the audit log.
export const buildTranscriptText = (history = [], meta = {}) => {
  const lines = [];
  lines.push('# eoreader4 — chat transcript');
  if (meta.exportedAt) lines.push(`_Exported ${meta.exportedAt}_`);
  lines.push('');
  let n = 0;
  for (const msg of history) {
    if (!msg || !msg.content) continue;
    const who = msg.role === 'assistant' ? 'Assistant' : (msg.role === 'user' ? 'You' : (msg.role || 'note'));
    lines.push(`## ${who}`);
    lines.push(String(msg.content).trim());
    lines.push('');
    n++;
  }
  if (!n) lines.push('_(no messages yet)_');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
};

// ── Full audit — the prompting and surfing, made readable ────────────────────
//
// One section per turn, in order. Pulls the structured record off the audit
// turns (the same objects the Audit pane renders): the question, the answer,
// the pipeline steps, the mechanical reading (spans + surfer field + note), the
// verbatim prompt, the raw output, the bound claims, vetoes, and flags. Each
// block is omitted when the turn doesn't carry it, so a plain chat turn stays
// short and a grounded/surfed turn shows its full machinery.
export const buildFullAuditText = (turns = [], meta = {}) => {
  const lines = [];
  lines.push('# eoreader4 — chat, full audit');
  lines.push('');
  lines.push('Every answer with the machinery behind it: the pipeline stages, the');
  lines.push('reading the surfer delivered, the verbatim prompt, the raw model output,');
  lines.push('the bound claims, and the vetoes. The chat is the surface; this is the trail.');
  if (meta.exportedAt) { lines.push(''); lines.push(`_Exported ${meta.exportedAt}_`); }
  lines.push('');

  if (!turns.length) { lines.push('_(no turns recorded yet)_'); return lines.join('\n') + '\n'; }

  let i = 0;
  for (const t of turns) {
    i++;
    const head = [`route: ${t.route ?? '—'}`];
    if (t.durationMs != null) head.push(`${t.durationMs}ms`);
    if (t.grounding) head.push(`grounding: ${t.grounding}`);
    if (t.gated) head.push('gated');
    lines.push(`## Turn ${i} · ${head.join(' · ')}`);
    lines.push('');
    lines.push('### You');
    lines.push(String(t.question ?? '').trim() || '_(empty)_');
    lines.push('');
    lines.push('### Assistant');
    lines.push(String(t.answer ?? '').trim() || '_(no answer)_');
    lines.push('');

    // Pipeline stages — the route the turn walked, each with its offset.
    if (Array.isArray(t.steps) && t.steps.length) {
      lines.push('### Pipeline');
      for (const s of t.steps) {
        lines.push(`- \`+${s.t ?? 0}ms\` **${s.name}** ${compact(s.data)}`.trimEnd());
      }
      lines.push('');
    }

    // The mechanical reading — what the surfer/retrieval actually delivered.
    const r = t.reading;
    if (r) {
      lines.push('### Reading (surfing)');
      if (Array.isArray(r.spans) && r.spans.length) {
        lines.push('');
        lines.push('Spans delivered to the phraser:');
        for (const s of r.spans) {
          const tag = `[s${s.idx}]` + (s.via ? ` ${s.via}` : '') + (s.terrain ? ` · ${s.terrain}` : '') +
            (s.score != null ? ` (score ${s.score})` : '');
          lines.push(`- ${tag}: ${oneLine(s.text)}`);
        }
      }
      if (r.surf && Array.isArray(r.surf.field) && r.surf.field.length) {
        const peak = r.surf.peak, stops = new Set(r.surf.stops || []), recs = new Set(r.surf.recCursors || []);
        lines.push('');
        lines.push(`Surfer field — surprise per cursor (★ peak · ⟳ frame-break · • stop)${r.surf.rode ? ` · rode ${r.surf.rode}` : ''}:`);
        for (const f of r.surf.field) {
          const mark = (f.idx === peak ? '★' : '') + (recs.has(f.idx) ? '⟳' : '') + (stops.has(f.idx) ? '•' : '') || '·';
          lines.push(`- ${mark} c${f.idx}${f.focus ? ` ${f.focus}` : ''} · bayes ${f.bayes ?? '–'} · surprise ${f.surprisalBits ?? '–'} bits`);
        }
      }
      if (r.note) { lines.push(''); lines.push('Note handed to the phraser:'); lines.push(block(r.note)); }
      if (r.llm) {
        lines.push('');
        lines.push(`What the LLM would be told${r.llm.focus ? ` · focus ${r.llm.focus}` : ''}:`);
        lines.push(block([r.llm.system, r.llm.user].filter(Boolean).join('\n\n')));
        if (r.llm.draft) { lines.push('No-LLM render (speakTriples):'); lines.push(block(r.llm.draft)); }
      }
      lines.push('');
    }

    if (t.prompt)    { lines.push('### Prompt sent to the model'); lines.push(block(t.prompt)); lines.push(''); }
    if (t.rawOutput) { lines.push('### Raw model output'); lines.push(block(t.rawOutput)); lines.push(''); }
    if (Array.isArray(t.bound) && t.bound.length) {
      lines.push('### Bound claims'); lines.push(block(stringify(t.bound))); lines.push('');
    }
    if (Array.isArray(t.vetoes) && t.vetoes.length) {
      lines.push('### Vetoes'); lines.push(block(stringify(t.vetoes))); lines.push('');
    }
    if (Array.isArray(t.flags) && t.flags.length) {
      lines.push('### Flags');
      for (const f of t.flags) lines.push(`- ${f.refuses ? '⛔ ' : ''}${f.id}${f.message ? ` — ${f.message}` : ''}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
};

// A short, single-line gloss of a step's data object for the pipeline list.
const compact = (data) => {
  if (data == null || typeof data !== 'object') return data == null ? '' : String(data);
  const parts = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === 'ms') continue;
    parts.push(`${k}=${Array.isArray(v) ? `[${v.join(',')}]` : oneLine(v, 80)}`);
  }
  return parts.join(' ');
};

// Collapse whitespace and cap length — for inline span/field text.
const oneLine = (s, max = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
};

// A fenced code block, so verbatim prompt/output/JSON survives Markdown intact.
const block = (text) => '```\n' + String(text ?? '').replace(/```/g, '`​``') + '\n```';

const stringify = (x) => { try { return JSON.stringify(x, null, 2); } catch { return String(x); } };

// ── Download ─────────────────────────────────────────────────────────────────
//
// The only DOM-touching part. The anchor must be in the document for the click
// to start a download in Firefox/Safari (mirrors exportAudit in audit-view.js).
export const downloadText = (filename, text, mime = 'text/markdown') => {
  if (!text) return false;
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
};

// Orchestrate one export. `mode` is 'text' (transcript) or 'full' (audit).
// `history` is the running transcript; `turns` are the audit turns.
export const exportChat = (mode, { history = [], turns = [] } = {}) => {
  const stamp = new Date();
  const meta = { exportedAt: stamp.toLocaleString() };
  const slug = stamp.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  if (mode === 'full') {
    return downloadText(`eoreader4-chat-full-${slug}.md`, buildFullAuditText(turns, meta));
  }
  return downloadText(`eoreader4-chat-${slug}.md`, buildTranscriptText(history, meta));
};
