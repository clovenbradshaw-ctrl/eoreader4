// Bonds carved by the talker, not by regex.
//
// The relation extractor in parse only fires on a sentence-initial subject —
// journalism (and most prose) hides subjects mid-clause, so the bonds go uncut.
// Rather than grow more patterns, we ask the model to read each sentence and
// state its relations. The model parses; we bind. Beyond regex by construction.
//
// Endpoints may be entities OR available tokens (every token is available for
// the graph): a carved bond can land on "man", "truck", "force" — a token node
// is minted for it on demand. Every carved event cites the source hash it read,
// and is kinded 'carved' so the audit can tell the talker's cuts from parse's.

import { tok } from '../parse/index.js';

const SPEECH = new Set(['said', 'told', 'asked', 'replied', 'reported', 'stated',
  'announced', 'claimed', 'whispered', 'shouted', 'wrote', 'says', 'tells']);

export const carveBonds = async (doc, model, { onProgress, maxSentences = 80 } = {}) => {
  if (!doc || !model) return { carved: 0, scanned: 0 };
  const events = typeof doc.log.snapshot === 'function' ? doc.log.snapshot() : (doc.log.events || []);
  const hashAt = new Map();
  for (const e of events) if (e.op === 'NUL' && e.kind === 'source') hashAt.set(e.sentIdx, e.hash);
  const names = [...(doc.admission?.admitted?.keys() || [])];

  let carved = 0, scanned = 0;
  for (let i = 0; i < doc.sentences.length && scanned < maxSentences; i++) {
    const sent = doc.sentences[i];
    const here = names.filter(n => sent.includes(n));
    if (here.length === 0) continue;     // need at least one anchored existent
    scanned++;

    let raw = '';
    try {
      raw = await model.phrase([
        { role: 'system', content: 'Extract the relations explicitly stated in the sentence. Output one per line as: SUBJECT | relation | OBJECT. Subject and object are noun phrases from the sentence. If there are none, output NONE. No other text.' },
        { role: 'user', content: `Sentence: ${sent}\nKnown names: ${here.join(', ')}` },
      ], { maxTokens: 120 });
    } catch { continue; }

    for (const t of parseTriples(raw)) {
      const src = resolve(t.s, sent, doc);
      const tgt = resolve(t.o, sent, doc);
      if (!src || !tgt || src.id === tgt.id) continue;
      const cites = hashAt.get(i);
      for (const n of [src, tgt]) {
        if (n.kind === 'token') doc.log.append({ op: 'INS', kind: 'token', id: n.id, label: n.label, sentIdx: i, cites });
      }
      const op = SPEECH.has(t.v.toLowerCase().split(/\s+/)[0]) ? 'SIG' : 'CON';
      doc.log.append({ op, kind: 'carved', src: src.id, tgt: tgt.id, via: t.v, sentIdx: i, cites });
      carved++;
    }
    onProgress?.({ at: i, total: doc.sentences.length, carved });
  }
  return { carved, scanned };
};

const parseTriples = (raw) => {
  const out = [];
  for (const line of String(raw || '').split('\n')) {
    const m = line.match(/^\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (!m) continue;
    const [, s, v, o] = m;
    if (/^none$/i.test(s)) continue;
    out.push({ s, v, o });
  }
  return out;
};

// Resolve a noun phrase to a graph node: an admitted entity if the phrase names
// one, else the head content token present in the sentence (an available token
// node). Null if it grounds in neither — never invent.
const resolve = (phrase, sent, doc) => {
  const p = String(phrase || '').trim();
  if (!p) return null;
  const adm = doc.admission;
  if (adm) {
    for (const [label, id] of adm.admitted) {
      const l = label.toLowerCase();
      if (p.toLowerCase().includes(l) || l.includes(p.toLowerCase())) return { id, kind: 'entity' };
    }
  }
  const sentToks = new Set(tok(sent));
  const pToks = tok(p);
  for (let k = pToks.length - 1; k >= 0; k--) {        // head-last heuristic
    if (sentToks.has(pToks[k])) return { id: `t:${pToks[k]}`, label: pToks[k], kind: 'token' };
  }
  return null;
};
