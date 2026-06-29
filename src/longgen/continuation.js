// runContinuation — long generation across messages, the closure run forward.
//
// docs/long-generation.md. The arc's spine with the source switched from a
// document to the generation's SELF and the supply from retrieval to a fold of
// the conversation plus a ground pool. One step is the four-part sketch made
// literal:
//
//   reconstruct  feed back the tail (verbatim window) and the fold (surfed recap)
//   direction    p(next) over the self → the move-type to make next
//   resolve      that move-type → a concrete proposition from uncovered ground
//   realize      the talker renders it, with the fold as context
//   floor        bind+veto the rendering against its span (the arc's gate)
//   weld         append the JUDGED unit; its verdict becomes the next step's strain
//
// Termination is emergent (the arc's law, §5.7): the loop stops when the ground
// is spent, when the predictor goes flat (its VOID), or on sustained drift —
// never at a token count. A `maxSteps` backstop is a runaway guard, not policy.
//
// Across messages: the returned `state` (accepted units + covered ground) is a
// sufficient statistic. Persist it, pass it back with the next message, and the
// loop resumes — the fold widens, the self move-log lengthens, generation
// continues where it stopped.

import { foldConversation } from '../converse/history.js';
import { generateSection, stripUnboundCorrective, REBIND_THRESHOLD } from '../arc/index.js';
import { bindAndVeto } from '../ground/index.js';
import { predictDirection } from './direction.js';
import { resolveProposition } from './resolve.js';

const MAX_STEPS = 24;            // runaway backstop; saturation should bind first
const MAX_DRIFT = 2;             // consecutive drops that read as "the frame is gone"

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
  auditLog = null,        // optional; records the step trace when given
  state = null,           // resumable closure state from a prior message
  maxSteps = MAX_STEPS,
  temperature = 0,        // the surprise quantile the direction draw reaches up
  signal = null,
} = {}) => {
  // RECONSTRUCT — the tail and the fold, reused wholesale. Computed once: it is
  // the same for every step of this message (the history does not change mid-run).
  const fold = foldConversation(history);
  const conversation = { notes: fold.notes, pastTurns: fold.pastTurns };

  // Resume from prior state, or start fresh. `units` are the accepted self-units
  // (the move-log substrate and the weld's carrier); `covered` is the spent ground.
  const units = state?.units ? [...state.units] : [];
  const covered = new Set(state?.covered || []);

  const trace = [];
  let stop = null;
  let drift = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (signal?.aborted) { stop = 'aborted'; break; }

    // DIRECTION — p(next) over the self. A flat posterior is the predictor's VOID:
    // no grounded expectation of what comes next, so the honest move is to stop.
    const dir = predictDirection(units, { temperature });
    if (dir.flat) { stop = 'void:no-expectation'; trace.push({ step, kind: 'void', sharpness: dir.sharpness }); break; }

    // RESOLVE — the drawn move-type → a proposition from uncovered ground.
    const prop = resolveProposition({ move: dir.move, ground, covered });
    if (!prop) { stop = 'ground-exhausted'; trace.push({ step, kind: 'exhausted', move: dir.move }); break; }

    // REALIZE — the talker renders the proposition, with the fold as context.
    let gen = await generateSection(prop, { doc, model, signal, conversation });
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
      const gen2 = await generateSection(prop, { doc, model, corrective, signal, conversation });
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
    for (const idx of prop.spanSet) covered.add(idx);

    if (action === 'drop' || !gated.sources.length) {
      drift += 1;
      trace.push({ step, kind: 'drop', move: dir.move, boundFraction: round3(gated.boundFraction) });
      if (drift >= MAX_DRIFT) { stop = 'drift'; break; }
      continue;
    }
    drift = 0;

    // WELD — append the JUDGED unit. The verdict (boundFraction, vetoes) travels
    // with it, so the next direction read sees self-output with its verdict, never
    // the bare assertion: an evaluation of self orients the next step, never grounds
    // it. boundFraction is the strain selfMoveLog reads back (direction.js).
    const unit = {
      i: units.length,
      move: dir.move,
      subClaim: prop.subClaim,
      text: gated.answer,
      sources: gated.sources,
      boundFraction: gated.boundFraction,
      vetoes: gated.vetoes,
      action,
    };
    units.push(unit);
    trace.push({ step, kind: 'append', move: dir.move, action, cited: gated.sources.length,
      boundFraction: round3(gated.boundFraction), sharpness: dir.sharpness });

    if (auditLog?.event) {
      try { auditLog.event('longgen:unit', { i: unit.i, move: unit.move, action, boundFraction: round3(unit.boundFraction) }); }
      catch { /* the audit is a projection; a logging slip never fails the run */ }
    }
  }

  if (!stop) stop = 'max-steps';

  const answer = units.map(u => u.text).filter(Boolean).join('\n\n');
  const sources = [...new Set(units.flatMap(u => u.sources || []))].sort((a, b) => a - b);

  return {
    answer,
    units,
    sources,
    stop,
    trace,
    // The resumable closure state — feed this back with the next message.
    state: { units, covered: [...covered] },
    fold: fold.stats,
  };
};

const round3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
