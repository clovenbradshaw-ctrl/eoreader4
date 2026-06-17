// The append-only event log. Single source of truth.
// Append is the only mutation. Retractions are written as SEG events —
// nothing is unwritten. The graph and every projection are folds of this.

import { isOperator } from './operators.js';

let nextLogId = 1;

export const createLog = ({ docId } = {}) => {
  const id = nextLogId++;
  const events = [];
  const subscribers = new Set();

  const append = (event) => {
    if (!event || !isOperator(event.op)) {
      throw new TypeError(`log.append: invalid event ${JSON.stringify(event)}`);
    }
    const sealed = Object.freeze({
      ...event,
      seq: events.length,
      t: event.t ?? Date.now(),
    });
    events.push(sealed);
    for (const fn of subscribers) {
      try { fn(sealed); } catch { /* subscribers are best-effort */ }
    }
    return sealed;
  };

  const retract = (refSeq, reason) =>
    append({ op: 'SEG', kind: 'retract', refSeq, reason });

  const subscribe = (fn) => {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  };

  return {
    id,
    docId,
    append,
    retract,
    subscribe,
    get events() { return events; },
    get length() { return events.length; },
    snapshot() { return events.slice(); },
    filter(pred) { return events.filter(pred); },
    last(n = 1) { return events.slice(-n); },
  };
};

export const isLog = (x) =>
  !!x && typeof x.append === 'function' && Array.isArray(x.events);
