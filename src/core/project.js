// projectGraph — pure fold over the event log producing the active graph.
//
// Pure on (log, frame). Everything the projection reads — including the
// reading rules (γ, edge weight floor, etc.) — must arrive through
// `frame`. This is the discipline lifted from engine.js:7052, where the
// live projector reads READING_RULES.decay_gamma from module scope and
// silently invalidates any memo not keyed on the rules. Here we take the
// rules in explicitly:
//
//   const frame = {
//     cursor, edgeAffinity,
//     rules: { decay_gamma: 0.7, edge_weight_floor: 0 },
//   };
//   const g = projectGraph(log, frame);
//
// Memoized by (log.length, frameSig). Safe because the log is append-only
// AND the frame (including rules) is fully serialized into the key —
// same key, same result.

import { discriminatorIndex, evaluateSameAs, normLabel } from './asterisk.js';

export const DEFAULT_PROJECTION_RULES = Object.freeze({
  // Mass decays at γ per sentence distance from the cursor.
  // engine.js READING_RULES.decay_gamma.value.
  decay_gamma: 0.7,
  // Edges below this weight are pruned from the projection. 0 disables.
  edge_weight_floor: 0,
  // The ontological asterisk (asterisk.js). A cross-source SYN kind:'same_as?'
  // candidate is held OUT of the union-find and promoted to a real merge only when
  // this many shared discriminator CON edges CONVERGE between its two firm clusters
  // — the shared label itself excluded, because the name is the thing in question
  // and cannot also be the evidence. A functional discriminator filled by disjoint
  // targets forks the candidate to a confirmed SPLIT instead. 0 disables promotion
  // (every candidate stays an asterisk until a bridging source is read).
  same_as_min_convergence: 1,
});

const memo = new WeakMap(); // log → { length, frameSig, result }

export const projectGraph = (log, frame = {}) => {
  const rules     = { ...DEFAULT_PROJECTION_RULES, ...(frame.rules || {}) };
  const fullFrame = { ...frame, rules };
  const frameSig  = canonicalFrame(fullFrame);
  const cached    = memo.get(log);
  if (cached && cached.length === log.length && cached.frameSig === frameSig) {
    return cached.result;
  }
  const result = computeProjection(log, fullFrame);
  memo.set(log, { length: log.length, frameSig, result });
  return result;
};

export const projectionStats = (log) => {
  const c = memo.get(log);
  return c
    ? { cached: true, atLength: c.length, frameSig: c.frameSig }
    : { cached: false };
};

const canonicalFrame = (f) => {
  // Deterministic serialization: sorted keys, recursive on plain objects.
  // Rules are a plain object so the inner keys must also be sorted.
  const ser = (v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const keys = Object.keys(v).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + ser(v[k])).join(',') + '}';
    }
    return JSON.stringify(v);
  };
  return ser(f);
};

const computeProjection = (log, frame) => {
  const events    = log.snapshot();
  const entities  = new Map();
  const edges     = [];
  const voidsRaw  = [];
  const sameAsRaw = [];   // held cross-source identity candidates — a SIDE structure,
                          // never `parent` (asterisk.js; do not touch find()).
  const parent    = new Map();
  const retracted = new Set();

  const find = (x) => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    return p;
  };

  // A generic union-find over an explicit parent map — used for the SPECULATIVE
  // identity quotient, which folds open same_as? candidates for DISPLAY ONLY and
  // never touches the firm `parent` above (asterisk.js; storage stays binary).
  const ufind = (pm, x) => { let p = pm.get(x) ?? x; while (p !== (pm.get(p) ?? p)) p = pm.get(p) ?? p; return p; };
  const union = (pm, a, b) => { const ra = ufind(pm, a), rb = ufind(pm, b); if (ra !== rb) pm.set(ra, rb); };

  // First pass: collect retractions so a SEG can undo a later-replayed event.
  for (const e of events) {
    if (e.op === 'SEG' && e.kind === 'retract' && e.refSeq != null) {
      retracted.add(e.refSeq);
    }
  }

  for (const e of events) {
    if (retracted.has(e.seq)) continue;
    // A carved absence — the document witnessing that a relation slot is VOID
    // (the four VOID emitters; an explicit_void note `A --rel--> [void]`, or a
    // DEF to VOID). It is content, not silence: the edge-grounding veto compares
    // a talker claim against it for the CONTRADICTED verdict, the libel-grade
    // catch (edge-grounding §3/§10). Kept out of the edge/entity passes — a void
    // is the absence of a tie, not a tie. Endpoints canonicalised after merge.
    if (e.kind === 'void') {
      voidsRaw.push({
        node: e.node ?? (e.src && e.src !== '[void]' ? e.src : e.tgt),
        rel: e.rel ?? e.via ?? null,
        sentIdx: e.sentIdx ?? null,
        seq: e.seq,
      });
      continue;
    }
    switch (e.op) {
      case 'INS': {
        const ent = entities.get(e.id) || {
          id: e.id, label: e.label, props: {}, sightings: 0, firstSeen: e.seq,
        };
        ent.sightings++;
        entities.set(e.id, ent);
        break;
      }
      case 'DEF': {
        const ent = entities.get(e.id);
        if (ent) ent.props[e.key] = e.value;
        break;
      }
      case 'SIG':
      case 'CON':
        // SIG and CON are both relation edges, the same way engine.js
        // treats text-layer SYN and CON together as relation edges
        // (engine.js:6855). CON — the binding bond at Relate × Structure
        // — is the 9th operator the eoreader3 README mislabeled as 8.
        edges.push({
          from: e.src, to: e.tgt,
          kind: e.op.toLowerCase(),
          via:  e.via,
          // The polarity/modality channel rides through verbatim when present — a
          // negated or hedged bond ("could not understand", "seemed clear") must
          // keep its sign and mood all the way to the reading, never silently
          // flattened to the positive. Absent on a plain bond (positive · realis).
          ...(e.polarity ? { polarity: e.polarity } : {}),
          ...(e.modality ? { modality: e.modality } : {}),
          seq:  e.seq,
          sentIdx: e.sentIdx,
          // Coupling: a referent resolved by field rather than by name carries
          // a sub-unit weight. The projection measures the field scaled by it;
          // a certain bond has no `w` and couples at 1.
          coupling: e.w == null ? 1 : e.w,
          // Provenance: a derived edge (e.g. the descriptor trigger's inferred
          // kinship hop) is defeasible. The edge-grounding veto reads this flag —
          // a derived filler never satisfies the functional-axiom witness rule.
          derived: !!e.derived,
        });
        break;
      case 'SYN':
        // SYN-merge is the identity join (site-layer in engine.js). The
        // text-layer SYN-as-relation-edge ambiguity in engine.js is
        // disambiguated here: relation edges are CON; SYN is for merges.
        if (e.kind === 'merge') parent.set(find(e.from), find(e.to));
        // A REAFFERENCE same_as? is the reader PROPOSING two names are one. It must
        // never enter union-find as a hard union — it is HELD as a candidate and
        // resolved later by discriminator convergence (the asterisk block below).
        else if (e.kind === 'same_as?')
          sameAsRaw.push({ from: e.from, to: e.to, seq: e.seq, label: e.label, sentIdx: e.sentIdx ?? null });
        break;
      // NUL: non-transformation — the thing is held as-is, not turned into
      //   graph structure and not cleared. (Voiding would be a DEF to VOID.)
      // SEG: handled in the first pass.
      // EVA, REC: live in the rules ledger (conventions), not in this projection.
    }
  }

  // ── The ontological asterisk — EVA · REC on held identity (asterisk.js) ─────
  // same_as? candidates entered the SIDE list, never `parent`. Now run EVA on each
  // against the FIRM clusters: a candidate whose clusters CONVERGE on shared
  // discriminator CON edges is promoted to a real merge (unioned, auditable down to
  // the discriminators that licensed it); one whose FUNCTIONAL discriminators
  // conflict is a confirmed split; the rest stay OPEN and each carries an identity
  // void. Discriminators are read on the firm roots, BEFORE any promotion, so every
  // pair is judged on its own attested evidence. Empty unless cross-source same_as?
  // events exist — where they do not, this whole block is inert and the projection
  // is byte-identical (golden parity).
  const sameAs = [], splits = [], idMerges = [];
  const specParent = new Map();
  if (sameAsRaw.length) {
    const labelFor = (id) => entities.get(id)?.label ?? id;
    const discr    = discriminatorIndex(edges, find, labelFor);
    const minConv  = frame.rules.same_as_min_convergence ?? 1;
    const fvias    = frame.rules.same_as_functional_vias
                       ? new Set(frame.rules.same_as_functional_vias) : null;
    // EVA every candidate on the firm clusters, then REC: apply the earned merges.
    const decided = sameAsRaw.map(c => {
      const ra = find(c.from), rb = find(c.to);
      if (ra === rb) return { c, verdict: 'subsumed' };          // a firm merge already united them
      const ev = evaluateSameAs(ra, rb,
        { discriminatorsOf: (r) => discr.get(r), minConvergence: minConv, functionalVias: fvias });
      return { c, ...ev };
    });
    for (const d of decided) if (d.verdict === 'promote') parent.set(find(d.c.from), find(d.c.to));
    // Classify with FINALIZED (post-promotion) roots, so display and voids are stable.
    for (const d of decided) {
      if (d.verdict === 'subsumed') continue;
      const a = find(d.c.from), b = find(d.c.to);
      const rec = Object.freeze({
        a, b, seq: d.c.seq, sentIdx: d.c.sentIdx,
        norm: normLabel(d.c.label ?? a), label: d.c.label ?? null,
        shared: d.shared, conflicts: d.conflicts,
      });
      if (d.verdict === 'promote')    idMerges.push(rec);
      else if (d.verdict === 'split') splits.push(rec);
      else { sameAs.push(rec); union(specParent, a, b); }        // OPEN — fold for speculative display
    }
  }

  // Collapse via union-find.
  const merged = new Map();
  for (const [id, ent] of entities) {
    const root = find(id);
    const m = merged.get(root) || { ...ent, id: root, sightings: 0 };
    m.sightings += ent.sightings;
    merged.set(root, m);
  }

  // Edge weight is a field measurement, not a stored fact: bilinear in the
  // endpoint log-mass, scaled by the bond's coupling, falling off with an
  // exponential γ kernel in reading distance from the cursor (engine.js
  // Pass 2.5), gated by a weight floor. Everything is read from frame.rules —
  // the projection touches no module scope.
  const cursor = (frame.cursor == null || !isFinite(frame.cursor)) ? Infinity : frame.cursor;
  const γ      = frame.rules.decay_gamma;
  const floor  = frame.rules.edge_weight_floor;

  const edgesOut = [];
  for (const e of edges) {
    const f = find(e.from), t = find(e.to);
    const fS = merged.get(f)?.sightings || 1;
    const tS = merged.get(t)?.sightings || 1;
    let w = (Math.log(1 + fS) + Math.log(1 + tS)) * (e.coupling ?? 1);
    if (isFinite(cursor) && e.sentIdx != null) {
      const dist = Math.abs(cursor - e.sentIdx);
      w *= Math.pow(γ, dist);
    }
    if (w >= floor) edgesOut.push({ ...e, from: f, to: t, weight: w });
  }

  // Canonicalise void endpoints through the same union-find the edges use, so a
  // carved absence on a merged referent matches a claim about any of its aliases.
  // Then carry the IDENTITY voids: each open same_as? candidate stands a void on
  // the identity relation, node-anchored to BOTH roots (so a query from either side
  // finds it), reusing the same first-class absence primitive — no new machinery.
  const idVoids = [];
  for (const c of sameAs) {
    const base = { rel: 'identity', kind: 'same_as?', seq: c.seq, sentIdx: c.sentIdx, label: c.label, norm: c.norm };
    idVoids.push(Object.freeze({ ...base, node: c.a, counter: c.b }));
    idVoids.push(Object.freeze({ ...base, node: c.b, counter: c.a }));
  }
  const voids = [...voidsRaw.map(v => Object.freeze({ ...v, node: find(v.node) })), ...idVoids];

  return Object.freeze({
    entities: merged,
    edges: edgesOut,
    voids: Object.freeze(voids),
    // Canonicalise any id to its merged referent — the binding of record the
    // edge-grounding veto resolves a talker claim's endpoints against, so a claim
    // about an alias lands on the same node its edges do (edge-grounding §5).
    // The default mode stays BINARY (firm clusters only). `{ speculative:true }`
    // additionally folds open same_as? candidates — for display, never for storage.
    representative: (id, opts) => (opts && opts.speculative) ? ufind(specParent, find(id)) : find(id),
    // The asterisk surfaces (asterisk.js): OPEN candidates (identity unestablished —
    // each also a void above), confirmed SPLITs (conflicting discriminators → two
    // Figures), and earned MERGEs (convergent discriminators, auditable). All empty
    // unless the master log carries cross-source same_as? events.
    sameAs:   Object.freeze(sameAs),
    splits:   Object.freeze(splits),
    idMerges: Object.freeze(idMerges),
    frame: Object.freeze({ ...frame }),
    rev: events.length,
  });
};
