// The model's own CURRENCY check (docs/web-search.md).
//
// A general-knowledge answer reaches for a witness from the web (turn/propose.js, the
// `verify` trigger). But not every such answer needs the SAME reach: a question about a
// famous novel is answered from training memory and only wants corroboration; the weather
// "today", a price, a league table, a result from after the model's cutoff cannot be
// answered from a fixed training horizon at all and must be FILLED from live pages.
//
// The cheapest judge of that difference is the model itself. So before the followup runs we
// ask it, dated: can what you just said be trusted as of today, from memory alone — or does
// it need live data? We read a small structured verdict back and let the orchestration pick
// the reach: a confident, timeless answer is witnessed (corroborated); a stale or
// time-sensitive one is upgraded to a gap-fill (fetch pages, re-answer on them).
//
// Returns { current, timeSensitive, needsWeb, reason }. Defensive by construction: any
// missing model, model error, or unparsable reply falls to needsWeb=true — when in doubt,
// reach for the witness rather than silently trust a possible void.

const SYSTEM =
  'You judge whether an answer you gave from memory can be trusted as current. You have no ' +
  'live data — only training knowledge with a fixed cutoff. Be honest about your staleness ' +
  'and about anything time-sensitive. Reply with JSON only.';

// Build the dated currency question. Kept pure and exported so the prompt is testable.
export const voidCheckPrompt = ({ question, answer, today } = {}) => {
  const q = String(question || '').trim();
  const a = String(answer || '').trim();
  const user =
    `Today's date is ${today || 'unknown'}.\n\n` +
    `A user asked: "${q}"\n` +
    (a ? `You answered from memory: "${a.slice(0, 600)}"\n` : '') +
    `\nCan this be trusted as accurate and CURRENT as of today, from training memory alone — ` +
    `or does it need live data from the web (because it is time-sensitive, changes over time, ` +
    `concerns events after your cutoff, or you are unsure)?\n\n` +
    `Reply with ONE line of JSON and nothing else:\n` +
    `{"current": true|false, "timeSensitive": true|false, "reason": "<short reason>"}`;
  return [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }];
};

// Pull the verdict object out of the model's reply. Tolerant of surrounding prose — finds
// the first {...} block and reads the three fields, coercing anything non-boolean to false.
// Returns null when there is no JSON object to read (the caller treats null as "unsure").
export const parseVerdict = (raw) => {
  const m = String(raw || '').match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return {
      current: o.current === true,
      timeSensitive: o.timeSensitive === true,
      reason: typeof o.reason === 'string' ? o.reason.slice(0, 200) : '',
    };
  } catch {
    return null;
  }
};

// Ask the model whether its own answer is current. `model.phrase(messages, opts)` is the
// sample-then-return contract every backend carries (model/interface.js).
export const assessKnowledgeVoid = async (model, { question, answer, today } = {}) => {
  const q = String(question || '').trim();
  if (!model || typeof model.phrase !== 'function' || !q) {
    return { current: false, timeSensitive: false, needsWeb: true, reason: 'no model to ask — defaulting to a witness' };
  }
  let raw = '';
  try {
    raw = await model.phrase(voidCheckPrompt({ question: q, answer, today }), { maxTokens: 80 });
  } catch {
    return { current: false, timeSensitive: false, needsWeb: true, reason: 'model error — defaulting to a witness' };
  }
  const verdict = parseVerdict(raw);
  if (!verdict) {
    return { current: false, timeSensitive: false, needsWeb: true, reason: 'unparsable verdict — defaulting to a witness' };
  }
  // It needs the web when the model cannot vouch for currency: either it is stale/unsure
  // (current=false) or it is inherently time-sensitive (the answer drifts with the date).
  const needsWeb = verdict.timeSensitive || !verdict.current;
  return { ...verdict, needsWeb };
};
