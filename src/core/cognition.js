// The cognition triad — the system helix one turn inward (add-on 2 §A).
//
// The system helix is organs / core / outputs = Existence / Structure /
// Significance as LOCATIONS. The cognition triad is the same triad as FACULTIES,
// the three things the mind actually does, with the surfer in the middle:
//
//   READER   ──▶   SURFER   ──▶   TALKER
//   Existence      Structure      Significance
//   constitute     navigate/find  judge/speak
//   (brings the    (the middle —  (gates candidates
//    reading into   relating the   against the finding,
//    being)         question to    DEF·EVA·REC)
//                   what answers)
//
//   units ─▶ [reading] ─▶ [finding] ─▶ surface
//
// The surfer is Structure, and Structure is the relating function — which is why
// it sits in the MIDDLE and not at an end. It does not constitute (the reader
// did) and does not speak (the talker will); it moves through what exists and
// finds the relations that bear. Each faculty's home operators are the operator
// column for its domain (core/operators.js, grouped by Domain): the reader the
// Existence column, the surfer the Structure column, the talker the Interpretation
// (Significance) column. And each faculty is itself a full helix on its own object
// (add-on 1's recursion), so this mapping is the top turn, not the whole story.

import { OPERATORS, operatorsByDomain } from './operators.js';

// faculty → its domain, function, act, position in the pass, and home operators.
// `position: 'middle'` is load-bearing: the surfer is the relating function, so it
// is the middle of the triad by construction, not by arrangement.
export const COGNITION = Object.freeze({
  reader: Object.freeze({
    faculty: 'reader', domain: 'Existence', function: 'Existence',
    act: 'constitute', position: 'first',
    operators: Object.freeze(operatorsByDomain('Existence').map(o => o.id)),   // NUL SIG INS
  }),
  surfer: Object.freeze({
    faculty: 'surfer', domain: 'Structure', function: 'Structure',
    act: 'navigate', position: 'middle',
    operators: Object.freeze(operatorsByDomain('Structure').map(o => o.id)),   // SEG CON SYN
  }),
  talker: Object.freeze({
    faculty: 'talker', domain: 'Interpretation', function: 'Significance',
    act: 'judge', position: 'last',
    operators: Object.freeze(operatorsByDomain('Interpretation').map(o => o.id)), // DEF EVA REC
    // The talker's gate is the Significance column itself — DEF·EVA·REC.
    gate: Object.freeze(['DEF', 'EVA', 'REC']),
  }),
});

// The order of the pass — reader constitutes, surfer finds, talker speaks. The
// surfer is the middle element, the relating step between bringing-into-being and
// committing-to-surface.
export const COGNITION_ORDER = Object.freeze(['reader', 'surfer', 'talker']);

// Which faculty owns an operator, by Domain. The reader owns the Existence
// operators, the surfer the Structure operators, the talker the Interpretation
// operators — so an event's operator already names which faculty fired it.
const FACULTY_BY_DOMAIN = { Existence: 'reader', Structure: 'surfer', Interpretation: 'talker' };
export const facultyOfOperator = (op) => {
  const o = OPERATORS[op?.id ?? op];
  return o ? FACULTY_BY_DOMAIN[o.domain] : null;
};

// The faculty record for a name, or null.
export const facultyOf = (name) => COGNITION[name] ?? null;
