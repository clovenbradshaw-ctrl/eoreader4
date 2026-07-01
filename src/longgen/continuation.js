// runContinuation — long generation across messages, the closure run forward, with
// the planner's faces wired in (docs/long-generation.md, docs/spec-planner.md).
//
// The arc's spine with the source switched from a document to the generation's SELF
// and the supply from retrieval to a fold of the conversation plus a ground pool.
// One step is the act seen three ways (spec-planner.md §4):
//
//   reconstruct  feed back the tail (verbatim window) and the fold (surfed recap)
//   gate         (§3) before the first step: does the ground answer the TYPE asked?
//   navigate     (§4.1) p(next) over the self, leaned by the significance arc (§8)
//   resolve      (§4.2) that move-type → a concrete proposition, operator HONORED
//   realize      (§4.3) the talker renders it, with the fold + read-window as context
//   floor        bind+veto the rendering against its span (the arc's gate)
//   weld         (§7) append the JUDGED unit; its verdict becomes the next step's strain
//
// Termination is emergent (spec-planner.md §10): the loop stops when the ground
// saturates (uncovered mass below `epsilon`), when the ground is spent, when the
// predictor QUIESCES (§2 — the flat posterior, NOT a VOID-site move), when the arc
// lands a SYN, or on sustained drift — never at a token count. `maxSteps` is a
// runaway guard.

import { foldConversation } from '../converse/history.js';
import { generateSection, stripUnboundCorrective, REBIND_THRESHOLD, groundSaturation } from '../arc/index.js';
import { bindAndVeto } from '../ground/index.js';
import { predictDirection } from './direction.js';
import { resolveProposition, EDGE_OPS } from './resolve.js';
import { answerabilityGate, followUpOffer } from './answerable.js';
import { arcPhase, phaseBias } from './shape.js';
import { speculateNext, readWindow } from './prompt.js';

const MAX_STEPS = 24;            // runaway backstop; saturation should bind first
const MAX_DRIFT = 2;             // consecutive drops that read as "the frame is gone"
const LAND_DEVELOP = 2;          // self-op develops in the land phase before forcing the close

// The leading run of bound claims — the grounded opening of a drifting unit, kept
// when the tail confabulates (the arc's boundPrefixText, §5.5).
const boundPrefixText = (bound = []) => {
  const kept = [];
  for (const b of bound) { if (b.citation) kept.push(b.claim); else break; }
  return kept.join(' ');
};

export const runContinuation = async ({
  ground = [],            // the ranked supply — what the continuation may cite
  history = [],           // the conversation; folded to tail + recap each call
  model,
  doc = null,             // optional, only for the neutral orientation line
  graph = null,           // optional referent-and-relation graph; refines the resolver
  question = '',          // optional; when given, the §3 answerability gate runs first
  auditLog = null,        // optional; records the step trace when given
  state = null,           // resumable closure state from a prior message
  maxSteps = MAX_STEPS,
  temperature = 0,        // the surprise quantile the direction draw reaches up
  arc = false,            // §8 — lean the draw by the significance arc (planner-ON)
  epsilon = undefined,    // §10 — the saturation knob; default is the arc's EPSILON
  speculate = false,      // §9 — pre-resolve the next move on a clean-verdict assumption
  selfRegister = false,   // essay-backwards — edge ops resolve against the SELF, no fresh span
  signal = null,
} = {}) => {
  // RECONSTRUCT — the tail and the fold, reused wholesale. Computed once: the same
  // for every step of this message (the history does not change mid-run).
  const fold = foldConversation(history);
  const conversation = { notes: fold.notes, pastTurns: fold.pastTurns };

  // GATE (§3) — does the ground answer the TYPE the question wants? A licensed walk
  // proceeds; an unlicensed one returns the refusal atom and NOTHING more (no walk,
  // no follow-up offer). The walk is licensed, not assumed.
  const gate = answerabilityGate({ question, ground, graph });
  if (!gate.licensed) {
    const r = gate.refusal;
    const unit = { i: 0, move: 'VOID', subClaim: r.reason, text: r.text,
      sources: r.sources, boundFraction: 1, vetoes: [], action: 'refuse', refusal: true };
    return {
      answer: r.text, units: [unit], sources: [...r.sources].sort((a, b) => a - b),
      stop: 'unanswerable', wantedType: gate.wantedType, followUp: '',
      trace: [{ step: 0, kind: 'refuse', wantedType: gate.wantedType, reason: r.reason }],
      state: { units: [], covered: [] }, fold: fold.stats,
    };
  }

  // Resume from prior state, or start fresh. `units` are the accepted self-units
  // (the move-log substrate and the weld's carrier); `covered` is the spent ground.
  const units = state?.units ? [...state.units] : [];
  const covered = new Set(state?.covered || []);

  const trace = [];
  let stop = null;
  let drift = 0;
  let lastClean = true;
  let landDevelops = 0;   // self-op develops taken in the land phase (essay-backwards)
  let spec = null;        // the speculated next {move, proposition}, when speculate is on

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) { stop = 'aborted'; break; }

    // SATURATION (§10) — read the uncovered budget off the ground pool every step.
    const sat = groundSaturation(ground, covered, epsilon != null ? { epsilon } : {});

    // NAVIGATE (§4.1) — p(next) over the self, leaned by the significance arc (§8)
    // when the planner is on. A flat posterior is the predictor QUIESCING (§2): no
    // grounded expectation of what comes next, so the honest move is to stop.
    const phase = arc ? arcPhase({ stepIndex: step, units, remainingFrac: sat.remainingFrac }) : null;
    const dir = predictDirection(units, { temperature, phaseBias: arc ? phaseBias(phase) : undefined });
    if (dir.flat) { stop = 'quiesce'; trace.push({ step, kind: 'quiesce', sharpness: dir.sharpness }); break; }

    // RESOLVE (§4.2) — the drawn move-type → a proposition, operator honored. Reuse
    // the clean-verdict speculation when it is live and the last unit bound clean
    // (§9); otherwise resolve fresh.
    let prop;
    if (speculate && spec && lastClean && spec.move === dir.move) {
      prop = spec.proposition;
    } else {
      prop = resolveProposition({ move: dir.move, ground, covered, graph, units, selfRegister });
    }
    // A node op drew but the external pool is spent (nothing fresh to introduce). Under
    // the self register, fall to DEVELOPING what the pool bought rather than ending the
    // essay: draw the highest-posterior EDGE op and resolve it against the self. The arc
    // then lands on a SYN close (or the predictor quiesces); the walk stops on the SELF
    // running dry, not on the external pool. Without the register this is still a stop.
    if (!prop && selfRegister && units.length && dir.posterior) {
      const edgeMove = dir.posterior.find(([op]) => EDGE_OPS.has(op))?.[0];
      if (edgeMove && edgeMove !== dir.move) {
        prop = resolveProposition({ move: edgeMove, ground, covered, graph, units, selfRegister });
        if (prop) { trace.push({ step, kind: 'develop-self', drew: dir.move, fell: edgeMove }); }
      }
    }
    if (!prop) { stop = 'ground-exhausted'; trace.push({ step, kind: 'exhausted', move: dir.move }); break; }

    // LAND (essay-backwards) — the coarse-grain arc close. Once the body has developed
    // in the land phase, a recurrence-dominated EVA/REC stream will not let SYN win the
    // draw (it out-probabilities the boosted close), so the walk would develop forever.
    // After LAND_DEVELOP self-op develops in `land`, force the SYN close if one resolves.
    // The FINE-grain rhythm (which develop, when to turn) is the predict-self seam
    // (spec-generation.md "reading self back through the perceiver"); this lands the arc.
    if (selfRegister && phase === 'land' && prop.selfOp && !prop.closes) {
      if (landDevelops >= LAND_DEVELOP) {
        const close = resolveProposition({ move: 'SYN', ground, covered, graph, units, selfRegister });
        if (close?.closes) { prop = close; trace.push({ step, kind: 'land-close', after: landDevelops }); }
      } else {
        landDevelops += 1;
      }
    }

    // The budget is spent — the next deposit only re-cites the dregs. Stop, UNLESS
    // this is the closing SYN that lands the arc (it cites already-covered spans), or a
    // self-op (essay-backwards): a self-op consumes no fresh external span, so external
    // saturation must not end an essay that is still developing what the pool bought.
    if (sat.saturated && !prop.closes && !prop.selfOp) {
      stop = 'saturated';
      trace.push({ step, kind: 'saturated', remainingFrac: round3(sat.remainingFrac) });
      break;
    }

    // REALIZE (§4.3) — the talker renders the proposition, with the fold + the
    // read-window (the prose tail, witnessed not re-bound, §5) as context.
    const window = readWindow(units, 2);
    let gen = await generateSection(prop, { doc, model, signal, conversation, tail: window });
    let gated = bindAndVeto(gen.rawOutput, prop.spans, { doc, question: prop.subClaim, task: 'answer' });
    let action = 'append';

    // FLOOR — the arc's faithfulness gate, run forward. bound → append; partly
    // bound → truncate to the grounded opening; mostly unbound → regenerate once
    // with the unbound claims struck; still unbound → drop.
    if (gated.boundFraction >= 1) {
      action = 'append';
    } else if (gated.boundFraction >= REBIND_THRESHOLD) {
      const prefix = boundPrefixText(gated.bound);
      if (prefix) { gated = bindAndVeto(prefix, prop.spans, { doc, question: prop.subClaim, task: 'answer' }); action = 'truncate'; }
      else action = 'drop';
    } else {
      const corrective = stripUnboundCorrective(gated.bound);
      const gen2 = await generateSection(prop, { doc, model, corrective, signal, conversation, tail: window });
      const gated2 = bindAndVeto(gen2.rawOutput, prop.spans, { doc, question: prop.subClaim, task: 'answer' });
      if (gated2.boundFraction >= REBIND_THRESHOLD) {
        const prefix2 = boundPrefixText(gated2.bound);
        if (prefix2) { gen = gen2; gated = bindAndVeto(prefix2, prop.spans, { doc, question: prop.subClaim, task: 'answer' }); action = 'regenerate'; }
        else action = 'drop';
      } else {
        action = 'drop';
      }
    }

    // A span is spent whether the unit appended or dropped — a drop does not get
    // retried against the same ground (that would loop), so coverage stays monotone.
    // A SYN close cites already-covered spans, so it adds nothing here.
    for (const idx of prop.spanSet) covered.add(idx);

    if (action === 'drop' || !gated.sources.length) {
      drift += 1;
      lastClean = false;
      spec = null;
      trace.push({ step, kind: 'drop', move: dir.move, boundFraction: round3(gated.boundFraction) });
      if (drift >= MAX_DRIFT) { stop = 'drift'; break; }
      continue;
    }
    drift = 0;
    lastClean = gated.boundFraction >= 1;

    // WELD (§7) — append the JUDGED unit. The verdict (boundFraction, vetoes) travels
    // with it, so the next direction read sees self-output with its verdict, never the
    // bare assertion: an evaluation of self orients the next step, never grounds it.
    // The move the unit RECORDS is the one it REALIZED (prop.move), not the one drawn
    // (dir.move) — when the loop fell to a self-op develop, the drawn move is not what
    // was written. This distinction is the weld: selfMoveLog reads u.move, so recording
    // the drawn move instead of the realized one traps the predictor's recurrence on the
    // wrong op and the arc can never progress (essay-backwards).
    const unit = {
      i: units.length,
      move: prop.move,
      drew: dir.move,
      selfOp: !!prop.selfOp,
      stance: prop.stance,
      band: prop.band,
      subClaim: prop.subClaim,
      text: gated.answer,
      sources: gated.sources,
      boundFraction: gated.boundFraction,
      vetoes: gated.vetoes,
      action,
    };
    units.push(unit);
    trace.push({ step, kind: 'append', move: prop.move, drew: dir.move, stance: prop.stance, action,
      phase, cited: gated.sources.length, boundFraction: round3(gated.boundFraction), sharpness: dir.sharpness });

    if (auditLog?.event) {
      try { auditLog.event('longgen:unit', { i: unit.i, move: unit.move, action, boundFraction: round3(unit.boundFraction) }); }
      catch { /* the audit is a projection; a logging slip never fails the run */ }
    }

    // The arc lands: a successful SYN close ends the walk (§8).
    if (prop.closes) { stop = 'arc-closed'; break; }

    // SPECULATE (§9) — pre-resolve the next move assuming THIS verdict was clean, so
    // the symbolic resolve is overlapped with witnessing. Discarded on a drift.
    spec = (speculate && lastClean)
      ? speculateNext({ units, proposition: prop, ground, covered, graph, temperature })
      : null;
  }

  if (!stop) stop = 'max-steps';

  const answer = units.map(u => u.text).filter(Boolean).join('\n\n');
  const sources = [...new Set(units.flatMap(u => u.sources || []))].sort((a, b) => a - b);

  return {
    answer,
    units,
    sources,
    stop,
    wantedType: gate.wantedType,
    // The follow-up offer, gated by the same §3 test — only regions the field can
    // actually develop, or '' (no offer is better than an offer to confabulate).
    followUp: followUpOffer(ground, covered),
    trace,
    // The resumable closure state — feed this back with the next message.
    state: { units, covered: [...covered] },
    fold: fold.stats,
  };
};

const round3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
