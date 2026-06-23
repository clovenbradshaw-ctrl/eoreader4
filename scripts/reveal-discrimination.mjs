#!/usr/bin/env node
// reveal-discrimination — a P0 measurement in the one-cursor pattern.
//
// READ-ONLY. Touches no production code, changes no rules. It measures THREE
// independent quantities per line of every document in data/reveal-stimulus.json,
// over PRIOR CONTEXT ONLY, and emits them to data/reveal-out.jsonl. It selects
// nothing, scores nothing, flags no "reveal". There is no answer key in the input
// and this script does not invent one. The selection happens elsewhere, against a
// held key this script never sees.
//
// THE THREE CHANNELS measure three genuinely different things:
//
//   surprisal        token improbability (surface). Mean negative log2 probability
//                    of the line's tokens under a generative backend, conditioned
//                    on every prior line in the same condition. bits per token.
//                    Backend: the transformers.js SmolLM2-360M ONNX path the repo's
//                    onnx.js names (src/model/onnx.js) — the cheapest local model
//                    that exposes a next-token distribution. The repo registers it
//                    with phrase() only, so this script reads its next-token
//                    distribution directly via the same ONNX causal-LM forward
//                    (teacher-forced scoring), which is what propose() would expose.
//                    If it will not load, surprisal is null for every line and a
//                    warning prints at the top of the run — never a silent proxy.
//
//   embeddingNovelty distance from the running meaning centroid (meaning space).
//                    1 - cosine(embed(line), prior), where prior is the γ-weighted
//                    mean of the embeddings of all prior lines (γ = 0.7, the
//                    reading.js prior weight). embed() is the MiniLM organ
//                    (paraphrase-multilingual-MiniLM-L12-v2 — the SAME model
//                    src/model/embed.js loads in the browser; here it is loaded for
//                    Node via the transformers.js npm package, identical weights and
//                    space). This is the flat-retriever baseline: what a
//                    novelty-ranking RAG reader treats as "new". It is identical to
//                    the meaning reader's 1-cos surprise (src/enact/meaning.js).
//                    If MiniLM will not load, embeddingNovelty is null for every
//                    line and a warning prints — never a hash-space number, which
//                    would measure spelling, not meaning.
//
//   bayesSurprise    how far the figure-field POSTERIOR moves (graph reorganization).
//                    D_KL(posterior ‖ prior) over the proposition/figure field, read
//                    off the engine's own significance channel by stepping the reader
//                    one line at a time: readingAt(doc, cursor).bayesBits
//                    (src/perceiver/reading.js, the KL in src/core/surprise.js, per
//                    docs/bayesian-surprise.md). This channel is built from the
//                    LEXICAL parse (src/perceiver/parse) and is embedder-independent —
//                    it is structural, not semantic, and is NOT surprisal in token
//                    space at all. calibratedBand is the per-document confirm band
//                    calibrateReader fits to this text's normal step (the scale the
//                    KL was measured against); it does NOT enter ranking.
//
// The three are designed to dissociate. This script emits all three honestly and
// lets the held key sort it out. The run can come back negative — that is the point.
//
// CAUSALITY. Line k sees lines 0..k-1 only; no lookahead.
//   - surprisal: a causal LM attends left-to-right, so one forward over the
//     concatenated document already conditions each token on prior tokens only.
//   - embeddingNovelty: the prior is the γ-mean of lines 0..k-1 by construction.
//   - bayesSurprise: the reader is fed the CUMULATIVE log through line k (re-parse of
//     lines[0..k]) and read at that cursor, so the KL is posterior-after-k against
//     prior-before-k, with no future line shaping the parse.
//
// THE UNIT IS THE INPUT LINE, not the proposition. If the parser segments a line
// into several propositions, each is mapped back to its source line by character
// offset, and the line's bayesSurprise is the MAX proposition KL whose span falls
// inside it (the reveal is one proposition; averaging dilutes it). propCount records
// how many propositions a line carried.
//
//   Usage:  node scripts/reveal-discrimination.mjs
//   Models load CPU-side via the transformers.js npm package; if it is not installed
//   (it is gitignored, not a repo dependency), install it for this run with:
//       npm install --no-save @huggingface/transformers@4.2.0
//   Without it, bayesSurprise still runs (pure engine); the two model channels
//   degrade to null with a printed warning.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText }       from '../src/perceiver/parse/index.js';
import { readingAt }       from '../src/perceiver/index.js';
import { calibrateReader } from '../src/core/enacted/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN   = join(ROOT, 'data', 'reveal-stimulus.json');
const OUT  = join(ROOT, 'data', 'reveal-out.jsonl');

const GAMMA       = 0.7;   // the reading.js prior weight (recency decay)
const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';   // the MiniLM organ (embed.js)
const GEN_MODEL   = 'HuggingFaceTB/SmolLM2-360M-Instruct';            // the SmolLM2 ONNX path (onnx.js)
const CONDITIONS  = ['unmarked', 'marked'];

const round3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);

// ── transformers.js (optional, CPU) ──────────────────────────────────────────────
// Resolved as a bare specifier from the repo's node_modules. Absent → both model
// channels degrade to null; the engine channel is unaffected.
let tf = null;
try {
  tf = await import('@huggingface/transformers');
} catch {
  try { tf = await import(pathToFileURL(join(ROOT, 'node_modules/@huggingface/transformers/dist/transformers.node.cjs')).href); }
  catch { tf = null; }
}

// The MiniLM organ for Node — same model, space, pooling, and normalization as the
// browser embedder (src/model/embed.js). measuresMeaning:true: a cosine here is a
// meaning-distance, the firewall the meaning reader and classifier read.
async function loadEmbedder() {
  if (!tf) return null;
  try {
    const pipe = await tf.pipeline('feature-extraction', EMBED_MODEL, { dtype: 'q8' });
    const cache = new Map();
    return {
      id: 'minilm', model: EMBED_MODEL, measuresMeaning: true,
      async embed(text) {
        const key = String(text);
        if (cache.has(key)) return cache.get(key);
        const o = await pipe(key, { pooling: 'mean', normalize: true });
        const v = Float32Array.from(o.data);
        cache.set(key, v);
        return v;
      },
    };
  } catch (e) { embedderError = e?.message || String(e); return null; }
}

// The SmolLM2-360M causal LM for Node — teacher-forced per-token scoring (the
// next-token distribution propose() would expose), raw text, one forward per doc.
async function loadScorer() {
  if (!tf) return null;
  try {
    const tok   = await tf.AutoTokenizer.from_pretrained(GEN_MODEL);
    const model = await tf.AutoModelForCausalLM.from_pretrained(GEN_MODEL, { dtype: 'q4' });
    return { id: 'smollm2-360m', model: GEN_MODEL, tok, model_: model };
  } catch (e) { scorerError = e?.message || String(e); return null; }
}
let embedderError = null, scorerError = null;

// ── bayesSurprise: the engine's significance channel, causally, per line ─────────
// Char ranges of each line within lines.join("\n").
const lineRanges = (lines) => {
  const r = []; let pos = 0;
  for (const ln of lines) { r.push({ start: pos, end: pos + ln.length }); pos += ln.length + 1; }
  return r;
};
// First character offset of each parsed unit within the joined text, scanned forward.
const unitOffsets = (joined, units) => {
  const offs = []; let from = 0;
  for (const u of units) {
    const t = String(u).trim();
    let idx = t ? joined.indexOf(t, from) : -1;
    if (idx < 0 && t) idx = joined.indexOf(t.slice(0, Math.min(24, t.length)), from);
    offs.push(idx); if (idx >= 0) from = idx + t.length;
  }
  return offs;
};

// For each line k: re-parse the cumulative prefix lines[0..k] (so no future line
// shapes the parse), map the parse's units back to source lines, and take the MAX
// bayesBits over the units that fall inside line k. Returns per-line { bayes, prop }.
function bayesPerLine(docId, lines) {
  const bayes = [], prop = [];
  for (let k = 0; k < lines.length; k++) {
    const prefix = lines.slice(0, k + 1);
    const joined = prefix.join('\n');
    const doc    = parseText(joined, { docId });
    const ranges = lineRanges(prefix);
    const offs   = unitOffsets(joined, doc.units);
    const cursorsOfK = [];
    for (let c = 0; c < doc.units.length; c++) {
      const o = offs[c];
      if (o >= 0 && o >= ranges[k].start && o <= ranges[k].end) cursorsOfK.push(c);
    }
    // Fallback: if offset mapping found nothing (it never did on this set), the last
    // unit of the prefix is line k's — the cumulative parse's final cursor.
    const cs = cursorsOfK.length ? cursorsOfK : [doc.units.length - 1];
    let maxKL = 0;
    for (const c of cs) { const b = readingAt(doc, c).bayesBits; if (b > maxKL) maxKL = b; }
    bayes.push(round3(maxKL));
    prop.push(cs.length);
  }
  return { bayes, prop };
}

// ── embeddingNovelty: 1 - cos(line, γ-mean of prior lines) ───────────────────────
async function embeddingNoveltyPerLine(embedder, lines) {
  if (!embedder) return lines.map(() => null);
  const E = []; for (const s of lines) E.push(await embedder.embed(s));
  const D = E[0]?.length || 0;
  const out = [];
  for (let k = 0; k < lines.length; k++) {
    if (k === 0 || !D) { out.push(k === 0 ? 0 : null); continue; }   // opening cannot be novel
    const prior = new Float64Array(D);
    for (let j = 0; j < k; j++) { const w = Math.pow(GAMMA, k - 1 - j); for (let i = 0; i < D; i++) prior[i] += w * E[j][i]; }
    let dot = 0, np = 0, ne = 0;
    for (let i = 0; i < D; i++) { dot += E[k][i] * prior[i]; np += prior[i] * prior[i]; ne += E[k][i] * E[k][i]; }
    const cos = dot / (Math.sqrt(np) * Math.sqrt(ne) + 1e-9);
    out.push(round3(Math.max(0, 1 - cos)));
  }
  return out;
}

// ── surprisal: mean -log2 p per line under the causal LM, one forward, exact spans ─
async function surprisalPerLine(scorer, lines) {
  if (!scorer) return lines.map(() => null);
  const { tok, model_ } = scorer;
  const bos = tok.bos_token_id ?? null;
  const enc = (s) => tok.encode(s, { add_special_tokens: false });
  // Cumulative token counts over lines[0..k].join("\n"); verify prefix-monotonic so
  // line spans tile the sequence exactly (true for \n-joined text under this BPE).
  const encs = lines.map((_, k) => enc(lines.slice(0, k + 1).join('\n')));
  let monotonic = true;
  for (let k = 1; k < encs.length && monotonic; k++) {
    const prev = encs[k - 1], cur = encs[k];
    if (cur.length < prev.length) { monotonic = false; break; }
    for (let i = 0; i < prev.length; i++) if (cur[i] !== prev[i]) { monotonic = false; break; }
  }
  if (!monotonic) { surprisalNote = `tokenizer non-monotonic on a document — surprisal null there`; return lines.map(() => null); }

  const full   = encs[encs.length - 1];
  const ids    = bos != null ? [bos, ...full] : [...full];
  const bosOff = bos != null ? 1 : 0;
  const T = ids.length;
  if (T < 2) return lines.map(() => null);

  const input_ids      = new tf.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, T]);
  const attention_mask = new tf.Tensor('int64', BigInt64Array.from(ids.map(() => 1n)), [1, T]);
  const out = await model_({ input_ids, attention_mask });
  const [, , V] = out.logits.dims;
  const arr = out.logits.data;
  // logits at position p (0-based) score token at ids[p+1].
  const tokenBits = (p, tgt) => {
    const off = p * V; let mx = -Infinity;
    for (let v = 0; v < V; v++) { const z = arr[off + v]; if (z > mx) mx = z; }
    let den = 0; for (let v = 0; v < V; v++) den += Math.exp(arr[off + v] - mx);
    const lp = (arr[off + tgt] - mx) - Math.log(den);
    return -lp / Math.LN2;
  };
  const e = encs.map(a => a.length);                  // e[k] = tokens through line k (no bos)
  const surprisal = [];
  for (let k = 0; k < lines.length; k++) {
    const sTok = (k === 0 ? 0 : e[k - 1]) + bosOff;   // first ids index of line k
    const eTok = e[k] + bosOff;                        // one past line k's last token
    let bits = 0, n = 0;
    for (let j = sTok; j < eTok; j++) { if (j < 1) continue; bits += tokenBits(j - 1, ids[j]); n++; }
    surprisal.push(n ? round3(bits / n) : null);
  }
  return surprisal;
}
let surprisalNote = null;

// Descending rank of line indices by a measure; nulls excluded; ties by lineIdx asc.
const rankDesc = (vals) =>
  vals.map((v, i) => [i, v]).filter(([, v]) => v != null)
      .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0])).map(([i]) => i);

// ── run ──────────────────────────────────────────────────────────────────────────
const stim = JSON.parse(readFileSync(IN, 'utf8'));
const embedder = await loadEmbedder();
const scorer   = await loadScorer();

console.log('# reveal-discrimination — read-only measurement (one-cursor P0)');
console.log(`# embedder (embeddingNovelty): ${embedder ? `${embedder.id} · ${embedder.model} · measuresMeaning=true` : 'NONE'}`);
if (!embedder) console.log(`#   WARNING: MiniLM did not load — embeddingNovelty is null for every line.${embedderError ? ' (' + embedderError + ')' : tf ? '' : ' (transformers.js not installed: npm install --no-save @huggingface/transformers@4.2.0)'}`);
console.log(`# backend  (surprisal):        ${scorer ? `${scorer.id} · ${scorer.model}` : 'NONE'}`);
if (!scorer) console.log(`#   WARNING: no propose-capable backend loaded — surprisal is null for every line.${scorerError ? ' (' + scorerError + ')' : ''}`);
console.log(`# bayesSurprise: engine channel readingAt().bayesBits (always on, embedder-independent), γ=${GAMMA}`);

const records = [];
const summaries = [];
for (const [docId, conds] of Object.entries(stim.documents)) {
  for (const condition of CONDITIONS) {
    const lines = conds[condition];
    if (!Array.isArray(lines) || !lines.length) continue;
    const { bayes, prop } = bayesPerLine(docId, lines);
    const novelty   = await embeddingNoveltyPerLine(embedder, lines);
    const surprisal = await surprisalPerLine(scorer, lines);
    const band = round3(calibrateReader(bayes).confirmBand);

    for (let k = 0; k < lines.length; k++) {
      records.push({
        docId, condition, lineIdx: k, text: lines[k],
        surprisal: surprisal[k], embeddingNovelty: novelty[k],
        bayesSurprise: bayes[k], calibratedBand: band, propCount: prop[k],
      });
    }
    summaries.push({
      summary: true, docId, condition,
      rankBySurprisal:        rankDesc(surprisal),
      rankByEmbeddingNovelty: rankDesc(novelty),
      rankByBayesSurprise:    rankDesc(bayes),
    });
    console.log(`  ${docId}/${condition}: ${lines.length} lines · band=${band} · ` +
                `surprisal=${surprisal.every(v => v == null) ? 'null' : 'ok'} · ` +
                `embeddingNovelty=${novelty.every(v => v == null) ? 'null' : 'ok'}`);
  }
}
if (surprisalNote) console.log(`#   NOTE: ${surprisalNote}`);

writeFileSync(OUT, [...records, ...summaries].map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`\n# wrote ${records.length} line records + ${summaries.length} summaries → ${OUT.replace(ROOT + '/', '')}`);
