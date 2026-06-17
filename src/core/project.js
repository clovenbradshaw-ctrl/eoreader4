// projectGraph — pure fold over the event log producing the active graph.
//
// Memoized by (log.length, frameSig). Safe because the log is append-only:
// the fold of an unchanged prefix is unchanged. This is the largest single
// perf win called out in eoreader3's text-chat-mechanics map.

const memo = new WeakMap(); // log → { length, frameSig, result }

export const projectGraph = (log, frame = {}) => {
  const frameSig = canonicalFrame(frame);
  const cached = memo.get(log);
  if (cached && cached.length === log.length && cached.frameSig === frameSig) {
    return cached.result;
  }
  const result = computeProjection(log, frame);
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
  const keys = Object.keys(f).sort();
  return JSON.stringify(keys.map(k => [k, f[k]]));
};

const computeProjection = (log, frame) => {
  const events = log.snapshot();
  const entities = new Map();   // id → entity
  const edges    = [];          // {from, to, kind, via, seq}
  const parent   = new Map();   // union-find for SYN(merge)
  const retracted = new Set();  // seq of events undone by SEG(retract)

  const find = (x) => {
    let p = parent.get(x) ?? x;
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p;
    return p;
  };

  // First pass: collect retractions so a SEG can undo a later-replayed event.
  for (const e of events) {
    if (e.op === 'SEG' && e.kind === 'retract' && e.refSeq != null) {
      retracted.add(e.refSeq);
    }
  }

  for (const e of events) {
    if (retracted.has(e.seq)) continue;
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
        edges.push({
          from: e.src, to: e.tgt,
          kind: e.op.toLowerCase(),
          via: e.via, seq: e.seq,
        });
        break;
      case 'SYN':
        if (e.kind === 'merge') parent.set(find(e.from), find(e.to));
        break;
      // NUL: hold — does not project to the graph.
      // SEG: handled in the first pass.
      // EVA, REC: live in the rules ledger, not in this projection.
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

  // Re-key edges by root; weight by log-sightings on both ends.
  const edgesOut = edges.map(e => {
    const f = find(e.from), t = find(e.to);
    const w =
      Math.log(1 + (merged.get(f)?.sightings || 1)) +
      Math.log(1 + (merged.get(t)?.sightings || 1));
    return { ...e, from: f, to: t, weight: w };
  });

  return Object.freeze({
    entities: merged,
    edges: edgesOut,
    frame: Object.freeze({ ...frame }),
    rev: events.length,
  });
};
