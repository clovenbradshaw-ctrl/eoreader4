// ui/dream-view.js — tell the model to dream, and see what the dreaming looks like.
//
// A night is not one move (docs/how-to-rest.md). It PRUNES — reverse-learns the spurious,
// re-projects the loud day toward baseline and drops what faded — AND it STRENGTHENS: the
// dreamer (`recombine`) walks the uncollapsed field and raises the meaningful-but-
// untraversed, the latent rhymes the awake reading, clamped to the next arrival, never
// got to. Both are one operation seen from two sides: raise what stands, drop what does
// not. The selection is the BORN RULE throughout — a rhyme's amplitude is its
// meaningfulness, and the measure the walk surfaces it by is |amplitude|² over the field,
// so a strong latent link dominates a spray of coincidences and most of the field
// (correctly) evaporates.
//
// This surface is honest: it dreams over the document's REAL projected graph
// (core/project.js). Traversed pairs are the edges the reading actually walked; the
// dream's territory is the pairs it did NOT — two referents that never co-occur in an
// edge yet share many neighbours (a latent rhyme). Everything the dream proposes is a
// HYPOTHESIS — ungrounded, dashed, "waking would re-couple it to EVA" — never a finding
// (the desert cell: no SYN out of pure Ground). buildDream is DOM-free and exported so CI
// exercises the whole derivation without a browser; renderDream is pure presentation.

import { createFold } from '../write/fold.js';
import { reprojectIntegral, recombine, NIGHT_VOLUME } from '../rest/index.js';
import { bodyBounds } from './idle-view.js';
import { restIconSvg } from './rest-icon.js';

// ── buildDream — dream over the document's real graph (pure; no DOM) ──────────────
//   maxField   cap the recombine field to the N most-connected referents (O(N²) walk;
//              and the point is the strong rhymes, not every faint one)
//   topRhymes  keep only the top-N Born-weighted proposals (most evaporate)
//   pruneFloor a referent seen fewer times than this, with ≤1 relation, is spurious —
//              it fit one arrival and nothing after (the reverse-learning analogue)
export const buildDream = (doc, { maxField = 14, topRhymes = 8, pruneFloor = 3, volume = NIGHT_VOLUME, keep = 0.25 } = {}) => {
  const g = doc?.projectGraph
    ? doc.projectGraph()
    : { entities: new Map(), edges: [], voids: [], representative: (x) => x };
  const rep = g.representative || ((x) => x);
  const sentences = doc?.sentences || [];
  const [lo, hi] = bodyBounds(sentences);
  const inBody = (i) => i == null || (i >= lo && i < hi);   // tolerate edges with no index
  const labelOf = (id) => g.entities.get(rep(id))?.label || g.entities.get(id)?.label || id;

  // Canonical referents and the edges that touch them, clipped to the work's body.
  const edges = (g.edges || []).filter(e => inBody(e.sentIdx));
  const neighbours = new Map();     // id → Set(id)
  const relById = new Map();        // id → [{ via, other, sentIdx }]
  const touch = (id) => { if (!neighbours.has(id)) { neighbours.set(id, new Set()); relById.set(id, []); } };
  for (const e of edges) {
    const a = rep(e.from), b = rep(e.to);
    if (a === b) continue;
    touch(a); touch(b);
    neighbours.get(a).add(b); neighbours.get(b).add(a);
    relById.get(a).push({ via: e.via || e.kind || 'relates to', other: b, sentIdx: e.sentIdx ?? null });
    relById.get(b).push({ via: e.via || e.kind || 'relates to', other: a, sentIdx: e.sentIdx ?? null });
  }

  const ents = [];
  for (const [id, ent] of g.entities) {
    if (rep(id) !== id) continue;                  // canonical only (merged aliases fold in)
    touch(id);
    ents.push({ id, label: ent.label || id, sightings: ent.sightings || 0, degree: neighbours.get(id).size });
  }

  // ── prune — the spurious: seen little, barely connected (fit one arrival, nothing after) ──
  const pruned = ents
    .filter(e => e.degree <= 1 && e.sightings < pruneFloor)
    .map(e => ({ id: e.id, label: e.label, why: e.degree === 0 ? 'never connected in the body' : 'one relation, seen only ' + e.sightings + '×' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const prunedIds = new Set(pruned.map(p => p.id));
  const survivors = ents.filter(e => !prunedIds.has(e.id));

  // ── re-project — bring each surviving dossier toward baseline; drop what faded ──────
  // Fold each referent's relations as γ-decayed descriptors (recorded at the sentence
  // they were read from) and re-project toward baseline. The kept descriptors are the
  // standing shape; the dropped ones are the faded relations the night lets fall away —
  // pruning by relative standing, headroom returned to the top.
  const fold = createFold();
  let now = 0;
  for (const e of survivors) {
    fold.appear(e.id, { head: e.label });
    for (const r of relById.get(e.id)) {
      const t = r.sentIdx ?? 0;
      if (t > now) now = t;
      fold.record(e.id, { t, op: 'DEF', attr: `${r.via} ${labelOf(r.other)}`, res: 'firm' });
    }
  }
  const reprojected = survivors.map(e => {
    const full = fold.dossierOf(e.id, now, { keep: -1 });          // unfiltered, to see the drop
    const re = reprojectIntegral(fold, e.id, { t: now, volume, keep });
    const keptAttrs = new Set(re.descriptors.map(d => d.attr));
    const dropped = full.descriptors.filter(d => !keptAttrs.has(d.attr))
      .map(d => ({ attr: d.attr }));
    return {
      id: e.id, label: e.label, headroom: re.headroom,
      kept: re.descriptors.map(d => ({ attr: d.attr, rel: d.rel })),
      dropped,
    };
  }).filter(r => r.kept.length || r.dropped.length)
    .sort((a, b) => b.dropped.length - a.dropped.length || b.kept.length - a.kept.length);

  // ── strengthen — the dreamer: Born-weighted latent rhymes over the field ────────────
  // Walk the most-connected survivors. A pair the reading TRAVERSED (a direct edge) is
  // skipped — the dream rhymes what was not walked. A pair's amplitude is the Jaccard
  // overlap of their neighbourhoods: many shared connections, never a direct one, is a
  // meaningful latent link. The Born rule (amplitude²) sharpens the field so the real
  // rhyme dominates. `prior` > 0 (they already share connective tissue) marks it a
  // strengthen; none, a bare propose.
  const field = [...survivors].sort((a, b) => b.degree - a.degree).slice(0, maxField).map(e => e.id);
  const N = (id) => neighbours.get(id) || new Set();
  const jaccard = (a, b) => {
    const A = N(a), B = N(b);
    if (!A.size && !B.size) return 0;
    let inter = 0; for (const x of A) if (B.has(x) && x !== a && x !== b) inter++;
    const uni = new Set([...A, ...B]); uni.delete(a); uni.delete(b);
    return uni.size ? inter / uni.size : 0;
  };
  const sharedLabels = (a, b) => {
    const B = N(b), out = [];
    for (const x of N(a)) if (B.has(x) && x !== a && x !== b) out.push(labelOf(x));
    return out;
  };
  const walk = recombine(field, {
    affinity: (a, b) => jaccard(a, b),
    traversed: (a, b) => N(a).has(b),                 // a direct edge ⇒ the reading walked it
    prior: (a, b) => Math.min(1, sharedLabels(a, b).length / 3),  // shared tissue ⇒ strengthen
    top: topRhymes,
    minAffinity: 0,
  });
  const strengthened = walk.proposals.map(p => ({
    a: p.a, b: p.b, aLabel: labelOf(p.a), bLabel: labelOf(p.b),
    amplitude: p.amplitude, weight: p.weight, kind: p.kind,
    shared: sharedLabels(p.a, p.b),
  }));

  // ── ground — the un-figurable residue, held as one uncollapsed field ────────────────
  const voidIds = new Set((g.voids || []).filter(v => inBody(v.sentIdx)).map(v => rep(v.node)));
  const ground = [...voidIds].map(labelOf).filter(Boolean).sort();

  return {
    reprojected, pruned, strengthened, ground,
    stats: {
      referents: ents.length, edges: edges.length,
      pruned: pruned.length, strengthened: strengthened.length,
      fieldSize: field.length, considered: walk.considered, mass: walk.mass,
      dropped: reprojected.reduce((s, r) => s + r.dropped.length, 0),
    },
  };
};

// ── renderDream — pure presentation over a dream (returns an HTML string) ─────────
export const renderDream = (dream) => {
  if (!dream) return '';
  const s = dream.stats;
  const bar = (w) => {
    const pct = Math.round(Math.min(1, w) * 100);
    return `<span class="dv-bar" title="Born weight ${w}"><span class="dv-bar-fill" style="width:${pct}%"></span></span>`;
  };

  const strengthened = dream.strengthened.length
    ? dream.strengthened.map(r => {
        const shared = r.shared.length
          ? `shares ${r.shared.slice(0, 3).map(escapeHtml).join(', ')}${r.shared.length > 3 ? ` +${r.shared.length - 3}` : ''}`
          : 'a bare rhyme';
        return `<div class="dv-rhyme">` +
          `<div class="dv-rhyme-top">` +
            `<span class="dv-kind dv-kind--${r.kind}">${r.kind}</span>` +
            `<span class="dv-pair">${escapeHtml(r.aLabel)} <span class="dv-tie">⤳</span> ${escapeHtml(r.bLabel)}</span>` +
          `</div>` +
          `<div class="dv-rhyme-why">${shared} · never traversed</div>` +
          `<div class="dv-weight">${bar(r.weight)}<span class="dv-amp">|ψ|² ${r.weight} · amp ${r.amplitude}</span></div>` +
        `</div>`;
      }).join('')
    : `<div class="feed-empty">No untraversed rhymes stood far enough above the field to surface.</div>`;

  const pruned = dream.pruned.length
    ? dream.pruned.map(p => `<div class="dv-prune"><span class="dv-strike">${escapeHtml(p.label)}</span><span class="dv-why">${escapeHtml(p.why)}</span></div>`).join('')
    : `<div class="feed-empty">Nothing spurious to forget — every referent earned its place.</div>`;

  const reprojected = dream.reprojected.filter(r => r.dropped.length).slice(0, 10);
  const reproj = reprojected.length
    ? reprojected.map(r =>
        `<div class="dv-reproj"><div class="dv-reproj-head">${escapeHtml(r.label)} <span class="dv-headroom">+${Math.round(r.headroom * 100)}% headroom</span></div>` +
        `<div class="dv-drops">` +
          // the standing shape — raised, kept forward
          r.kept.slice(0, 3).map(k => `<span class="dv-keep">${escapeHtml(k.attr)}</span>`).join('') +
          // the faded relations let fall
          r.dropped.slice(0, 4).map(d => `<span class="dv-drop">${escapeHtml(d.attr)}</span>`).join('') +
          (r.dropped.length > 4 ? `<span class="dv-drop dv-more">+${r.dropped.length - 4} more</span>` : '') +
        `</div></div>`
      ).join('')
    : `<div class="feed-empty">The day was not loud enough to shed — the integral already stands with headroom.</div>`;

  const ground = dream.ground.length
    ? `<div class="dv-ground"><span class="dv-ground-tag">held as Ground (uncollapsed)</span> ${dream.ground.slice(0, 8).map(escapeHtml).join(' · ')}${dream.ground.length > 8 ? ` +${dream.ground.length - 8}` : ''}</div>`
    : '';

  return `<div class="dv-wrap">` +
    `<div class="dv-head">${restIconSvg('night', { size: 18, title: 'dreaming' })}` +
      `<span class="dv-title">Dreaming</span>` +
      `<span class="dv-stats">${s.referents} referents · pruned ${s.pruned} · dropped ${s.dropped} faded · ${s.strengthened}/${s.considered} rhymes surfaced</span>` +
    `</div>` +
    `<div class="dv-note">The frontier is held still. The night raises what stands and lets the rest fall — pruning and strengthening are one operation. Every proposal is a hypothesis: ungrounded, waking would re-couple it to EVA.</div>` +

    `<div class="dv-sec-h">Strengthened — latent rhymes (Born-weighted |ψ|²)<span class="iv-rule"></span></div>` +
    `<div class="dv-sub">meaningful connections the awake reading never traversed — raised in proportion to amplitude²</div>` +
    `<div class="dv-list">${strengthened}</div>` +

    `<div class="dv-sec-h">Pruned — forgotten by failing to regenerate<span class="iv-rule"></span></div>` +
    `<div class="dv-sub">referents that fit one arrival and nothing after — the integral stops supporting them</div>` +
    `<div class="dv-list">${pruned}</div>` +

    `<div class="dv-sec-h">Re-projected — the loud day brought toward baseline<span class="iv-rule"></span></div>` +
    `<div class="dv-sub">faded relations dropped by relative standing; headroom returned to the top</div>` +
    `<div class="dv-list">${reproj}</div>` +
    ground +
  `</div>`;
};

const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
