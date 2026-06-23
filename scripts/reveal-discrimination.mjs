#!/usr/bin/env node
// reveal-discrimination — a P0 measurement in the one-cursor pattern.
//
// READ-ONLY. Touches no production code, changes no rules. It emits, per line of
// every document in data/reveal-stimulus.json, every surprise/novelty quantity the
// engine already computes at that cursor — over PRIOR CONTEXT ONLY — to
// data/reveal-out.jsonl. It selects nothing, scores nothing, flags no "reveal".
// There is no answer key in the input and this script does not invent one. The
// selection happens elsewhere, against a held key this script never sees.
//
// WHY THE SWEEP. The lexical Bayesian channel (bayesSurprise) failed the reveal
// test under the held key: the planted reveal — a relational bond between two
// entities already in the cast — barely moves the figure field, which is built from
// the embedder-free lexical parse, so the reorganization left almost no structural
// trace. Before building a new meaning KL, this measures whether anything the engine
// ALREADY computes in MEANING space separates the reveal from the noise. It can come
// back null; a null sweep is the finding (the honest next move would then be the
// enacted significance loop, src/enact + docs/significance-loop.md — not another
// channel). So this run reads off what exists; it invents no measure.
//
// THE CHANNELS, each read off an existing reader.
//
//   surprisal        token improbability (surface). Mean -log2 p of the line's
//                    tokens under SmolLM2-360M (the transformers.js ONNX path
//                    src/model/onnx.js names), conditioned on every prior line. One
//                    causal forward per condition (teacher-forced — the next-token
//                    distribution propose() would expose). null + warning if it
//                    will not load.
//
//   embeddingNovelty 1 - cos(line, γ-weighted mean of prior-line embeddings),
//                    γ=0.7. embed() is the MiniLM organ (paraphrase-multilingual-
//                    MiniLM-L12-v2, the same model src/model/embed.js loads). The
//                    flat-retriever baseline. (Equals meaningSurprise; kept as the
//                    original named baseline.)
//
//   meaningSurprise  the meaning reader's own 1-cos surprise, read straight off
//                    src/enact/meaning.js (buildMeaningRead): distance from the
//                    γ-decayed semantic prior to the line, in MiniLM space. Same
//                    quantity as embeddingNovelty, sourced from the engine reader
//                    (clamped to [0,1]).
//
//   predictSurprise  embedding distance from the model's PREDICTED next line to the
//                    actual next line, read off src/perceiver/predict.js
//                    (predictNext): model.phrase predicts line k from lines k-4..k-1,
//                    1 - cos(embed(prediction), embed(actual)). null at line 0 and
//                    where the model/embedder are absent.
//
//   bayesSurprise    how far the figure-field POSTERIOR moves (graph reorganization).
//                    readingAt().bayesBits — D_KL(posterior‖prior) over the
//                    proposition/figure field (src/core/surprise.js, per
//                    docs/bayesian-surprise.md). Built from the LEXICAL parse, so it
//                    is structural, NOT semantic — not in token space at all.
//                    calibratedBand is the per-document calibrateReader confirm band
//                    (the scale the KL was measured against); it does NOT rank.
//
//   phasepostMargin  the line's Figure-band cell-commit margin under the geometric
//                    reader (src/classify/phasepost.js): own cell similarity minus
//                    the nearest competitor's, in MiniLM centroid space. null when
//                    the Figure band does not commit, or when the classifier is not
//                    live (hash organ / no centroids — a phasepost number off the
//                    hash organ is spelling, not meaning).
//
//   figureBandKL     D_KL over the Figure-band CELL distribution — the same KL core
//                    (src/core/surprise.js surpriseAt) the bayes channel uses, but
//                    over the meaning-space cells the classifier commits to: deposit
//                    at line k is the committed Figure cell, prior is the γ-decayed
//                    histogram of Figure cells committed on lines 0..k-1. The
//                    meaning-space analogue of bayesSurprise. null when the
//                    classifier is not live.
//
// CAUSALITY. Line k sees lines 0..k-1 only; no lookahead.
//   - surprisal: a causal LM attends left-to-right; one forward over the
//     concatenation conditions each token on prior tokens only.
//   - embeddingNovelty / meaningSurprise: the prior is the γ-mass of lines 0..k-1.
//   - predictSurprise: predictNext reads lines k-4..k-1 (context) and line k (the
//     target) only.
//   - bayesSurprise: the reader is fed the CUMULATIVE log through line k (re-parse of
//     lines[0..k]) and read at that cursor — no future line shapes the parse.
//   - figureBandKL: the prior is the committed-cell histogram of lines 0..k-1.
//
// THE UNIT IS THE INPUT LINE, not the proposition. Parsed units are mapped back to
// their source line by character offset (a forward-scanning indexOf, robust to a
// line splitting into several propositions); bayesSurprise is the MAX proposition KL
// inside a line. propCount records how many propositions a line carried. On this
// stimulus every line is one proposition (propCount = 1), reached via the live
// offset path — verified at the end of the run by an offset-mapping integrity count
// (zero fallbacks). (The earlier worry that the mapping silently fell through to the
// last cursor does not hold here; the count proves it.)
//
//   Usage:  node scripts/reveal-discrimination.mjs
//   Models load CPU-side via the transformers.js npm package (gitignored, not a repo
//   dependency); install it for this run with:
//       npm install --no-save @huggingface/transformers@4.2.0
//   Without it, bayesSurprise still runs (pure engine); the model/meaning channels
//   degrade to null with a printed warning.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

import { parseText }                from '../src/perceiver/parse/index.js';
import { readingAt, predictNext }   from '../src/perceiver/index.js';
import { calibrateReader }          from '../src/core/enacted/index.js';
import { surpriseAt }               from '../src/core/index.js';
import { buildMeaningRead }         from '../src/enact/meaning.js';
import { createPhasepostClassifier } from '../src/classify/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN             = join(ROOT, 'data', 'reveal-stimulus.json');
const OUT            = join(ROOT, 'data', 'reveal-out.jsonl');
const CELLS_FILE     = join(ROOT, 'data', 'phasepost-cells.json');
const CENTROIDS_FILE = join(ROOT, 'data', 'centroids-27.json');

const GAMMA       = 0.7;   // the reading.js prior weight (recency decay)
const EMBED_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';   // the MiniLM organ (embed.js)
const GEN_MODEL   = 'HuggingFaceTB/SmolLM2-360M-Instruct';            // the SmolLM2 ONNX path (onnx.js)
const CONDITIONS  = ['unmarked', 'marked'];

const round3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
let embedderError = null, lmError = null, surprisalNote = null;

// ── transformers.js (optional, CPU) ──────────────────────────────────────────────
let tf = null;
try {
  tf = await import('@huggingface/transformers');
} catch {
  try { tf = await import(pathToFileURL(join(ROOT, 'node_modules/@huggingface/transformers/dist/transformers.node.cjs')).href); }
  catch { tf = null; }
}

// The MiniLM organ for Node — same model, space, pooling, normalization as the
// browser embedder (src/model/embed.js). measuresMeaning:true is the firewall the
// meaning reader and the classifier read to decide a cosine means meaning.
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

// SmolLM2-360M as one text-generation pipeline, serving BOTH:
//   - teacher-forced logit scoring (surprisal), via pipe.model + pipe.tokenizer;
//   - greedy generation (predictNext's model.phrase), via pipe(messages).
async function loadLM() {
  if (!tf) return null;
  try {
    const pipe = await tf.pipeline('text-generation', GEN_MODEL, { dtype: 'q4' });
    return {
      id: 'smollm2-360m', model: GEN_MODEL, tok: pipe.tokenizer, lm: pipe.model,
      // The model.phrase contract predictNext drives (greedy → deterministic).
      async phrase(messages, opts = {}) {
        const out = await pipe(messages, { max_new_tokens: opts.maxTokens ?? 48, do_sample: false, return_full_text: false });
        const g = Array.isArray(out) ? out[0]?.generated_text : out?.generated_text;
        if (Array.isArray(g)) return String(g[g.length - 1]?.content || '').trim();
        return String(g || '').trim();
      },
    };
  } catch (e) { lmError = e?.message || String(e); return null; }
}

// The geometric reader, wired exactly as src/boot/index.js wires it: the 27-cell
// registry (phasepost-cells.json .CELLS) + the verified centroid bundle
// (centroids-27.json) + the MiniLM organ. Live only when the embedder measures
// meaning AND the centroids are present.
function loadClassifier(embedder) {
  if (!embedder) return null;
  let cells = null, centroids = null;
  try { cells = JSON.parse(readFileSync(CELLS_FILE, 'utf8')).CELLS || null; } catch {}
  try { centroids = JSON.parse(readFileSync(CENTROIDS_FILE, 'utf8')); } catch {}
  if (!cells || !centroids) return null;
  return createPhasepostClassifier({ cells, centroids, embedder });
}

// ── bayesSurprise: the engine's significance channel, causally, per line ─────────
// Char ranges of each line within lines.join("\n").
const lineRanges = (lines) => {
  const r = []; let pos = 0;
  for (const ln of lines) { r.push({ start: pos, end: pos + ln.length }); pos += ln.length + 1; }
  return r;
};
// First character offset of each parsed unit within the joined text, scanned forward
// (handles a line splitting into several units and duplicate text). −1 if not found.
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
// shapes the parse), map units back to source lines, and take the MAX bayesBits over
// the units inside line k. Returns { bayes, prop, fallbacks } — fallbacks counts
// lines where the offset map found nothing and the last-cursor fallback was used.
function bayesPerLine(docId, lines) {
  const bayes = [], prop = []; let fallbacks = 0;
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
    let cs = cursorsOfK;
    if (!cs.length) { cs = [doc.units.length - 1]; fallbacks++; }   // last cursor is still a fair posterior-after-k
    let maxKL = 0;
    for (const c of cs) { const b = readingAt(doc, c).bayesBits; if (b > maxKL) maxKL = b; }
    bayes.push(round3(maxKL));
    prop.push(cs.length);
  }
  return { bayes, prop, fallbacks };
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

// ── meaningSurprise: the engine meaning reader's 1-cos, read off src/enact/meaning.js
async function meaningSurprisePerLine(embedder, lines) {
  if (!embedder) return lines.map(() => null);
  const mr = await buildMeaningRead({ units: lines, sentences: lines }, embedder, { gamma: GAMMA });
  if (!mr) return lines.map(() => null);
  return mr.surprise.map(round3);
}

// ── predictSurprise: 1 - cos(model-predicted next, actual next), via predict.js ──
async function predictSurprisePerLine(lm, embedder, lines) {
  if (!lm || !embedder) return lines.map(() => null);
  const doc = { units: lines, sentences: lines };
  const out = [null];                                  // line 0 has no prediction
  for (let k = 1; k < lines.length; k++) {
    const r = await predictNext(doc, k - 1, { model: lm, embedder, window: 4 });
    out.push(r ? round3(r.surprise) : null);
  }
  return out;
}

// ── phasepostMargin + figureBandKL: the geometric reader's Figure band ───────────
// Classify each line once (the classifier memoizes by query). phasepostMargin is the
// Figure-band commit margin (null on no-commit). figureBandKL is the KL over the
// committed Figure-cell field — the bayes KL core, in meaning-space cells.
async function phasepostPerLine(classifier, lines) {
  const nulls = lines.map(() => null);
  if (!classifier || !classifier.isLive()) return { phasepostMargin: nulls, figureBandKL: nulls.slice() };
  const figCell = [], margin = [];
  for (const ln of lines) {
    const p = await classifier.classify(ln);
    figCell.push(p.figure?.cell ?? null);
    margin.push(p.figure?.margin ?? null);
  }
  const figureBandKL = [];
  for (let k = 0; k < lines.length; k++) {
    const prior = new Map();
    for (let j = 0; j < k; j++) {
      const c = figCell[j]; if (c == null) continue;
      prior.set(c, (prior.get(c) || 0) + Math.pow(GAMMA, k - 1 - j));
    }
    const deposit = new Map();
    if (figCell[k] != null) deposit.set(figCell[k], 1);
    figureBandKL.push(round3(surpriseAt(prior, deposit, { gamma: GAMMA }).bayesBits));
  }
  return { phasepostMargin: margin.map(round3), figureBandKL };
}

// ── surprisal: mean -log2 p per line under the causal LM, one forward, exact spans ─
async function surprisalPerLine(lm, lines) {
  if (!lm) return lines.map(() => null);
  const tok = lm.tok, model = lm.lm;
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
  if (!monotonic) { surprisalNote = 'tokenizer non-monotonic on a document — surprisal null there'; return lines.map(() => null); }

  const full   = encs[encs.length - 1];
  const ids    = bos != null ? [bos, ...full] : [...full];
  const bosOff = bos != null ? 1 : 0;
  const T = ids.length;
  if (T < 2) return lines.map(() => null);

  const input_ids      = new tf.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, T]);
  const attention_mask = new tf.Tensor('int64', BigInt64Array.from(ids.map(() => 1n)), [1, T]);
  const out = await model({ input_ids, attention_mask });
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
    const eTok = e[k] + bosOff;                         // one past line k's last token
    let bits = 0, n = 0;
    for (let j = sTok; j < eTok; j++) { if (j < 1) continue; bits += tokenBits(j - 1, ids[j]); n++; }
    surprisal.push(n ? round3(bits / n) : null);
  }
  return surprisal;
}

// Descending rank of line indices by a measure; nulls excluded; ties by lineIdx asc.
const rankDesc = (vals) =>
  vals.map((v, i) => [i, v]).filter(([, v]) => v != null)
      .sort((a, b) => (b[1] - a[1]) || (a[0] - b[0])).map(([i]) => i);

// ── run ──────────────────────────────────────────────────────────────────────────
const stim = JSON.parse(readFileSync(IN, 'utf8'));
const embedder   = await loadEmbedder();
const lm         = await loadLM();
const classifier = loadClassifier(embedder);
const classifierLive = !!(classifier && classifier.isLive());

console.log('# reveal-discrimination — read-only meaning-space sweep (one-cursor P0)');
console.log(`# embedder:   ${embedder ? `${embedder.id} · ${embedder.model} · measuresMeaning=true` : 'NONE'}`);
if (!embedder) console.log(`#   WARNING: MiniLM did not load — embeddingNovelty/meaningSurprise/predictSurprise/phasepost columns null.${embedderError ? ' (' + embedderError + ')' : tf ? '' : ' (npm install --no-save @huggingface/transformers@4.2.0)'}`);
console.log(`# backend:    ${lm ? `${lm.id} · ${lm.model} (surprisal + predictSurprise)` : 'NONE'}`);
if (!lm) console.log(`#   WARNING: SmolLM2 did not load — surprisal + predictSurprise null.${lmError ? ' (' + lmError + ')' : ''}`);
console.log(`# classifier: ${classifierLive ? 'geometric reader LIVE (centroids-27 + MiniLM)' : 'NOT live — phasepostMargin + figureBandKL null'}`);
if (embedder && !classifierLive) console.log('#   WARNING: phasepost columns null (no committing classifier).');
console.log(`# bayesSurprise: engine channel readingAt().bayesBits (always on, embedder-independent), γ=${GAMMA}`);

const records = [];
const summaries = [];
let totalFallbacks = 0;
for (const [docId, conds] of Object.entries(stim.documents)) {
  for (const condition of CONDITIONS) {
    const lines = conds[condition];
    if (!Array.isArray(lines) || !lines.length) continue;
    const { bayes, prop, fallbacks } = bayesPerLine(docId, lines);
    totalFallbacks += fallbacks;
    const novelty   = await embeddingNoveltyPerLine(embedder, lines);
    const surprisal = await surprisalPerLine(lm, lines);
    const meaning   = await meaningSurprisePerLine(embedder, lines);
    const predict   = await predictSurprisePerLine(lm, embedder, lines);
    const { phasepostMargin, figureBandKL } = await phasepostPerLine(classifier, lines);
    const band = round3(calibrateReader(bayes).confirmBand);

    for (let k = 0; k < lines.length; k++) {
      records.push({
        docId, condition, lineIdx: k, text: lines[k],
        surprisal: surprisal[k], embeddingNovelty: novelty[k], meaningSurprise: meaning[k],
        predictSurprise: predict[k], bayesSurprise: bayes[k], figureBandKL: figureBandKL[k],
        phasepostMargin: phasepostMargin[k], calibratedBand: band, propCount: prop[k],
      });
    }
    summaries.push({
      summary: true, docId, condition,
      rankBySurprisal:        rankDesc(surprisal),
      rankByEmbeddingNovelty: rankDesc(novelty),
      rankByMeaningSurprise:  rankDesc(meaning),
      rankByPredictSurprise:  rankDesc(predict),
      rankByBayesSurprise:    rankDesc(bayes),
      rankByFigureBandKL:     rankDesc(figureBandKL),
      rankByPhasepostMargin:  rankDesc(phasepostMargin),
    });
    const commits = phasepostMargin.filter(v => v != null).length;
    console.log(`  ${docId}/${condition}: ${lines.length} lines · band=${band} · ` +
                `surprisal=${surprisal.every(v => v == null) ? 'null' : 'ok'} · ` +
                `predict=${predict.every(v => v == null) ? 'null' : 'ok'} · figureCommits=${commits}/${lines.length}`);
  }
}
if (surprisalNote) console.log(`#   NOTE: ${surprisalNote}`);
console.log(`# offset-mapping integrity: ${totalFallbacks} fallback(s) across ${records.length} lines ` +
            `(0 = every line mapped by character offset; propCount is the true proposition count).`);

writeFileSync(OUT, [...records, ...summaries].map(r => JSON.stringify(r)).join('\n') + '\n');
console.log(`# wrote ${records.length} line records + ${summaries.length} summaries → ${OUT.replace(ROOT + '/', '')}`);
