// The audit record schema. One JSON object per turn.
//
// {
//   schema:    'eo-audit/1',
//   id:        't42',
//   question:  string,
//   startedAt: ms, finishedAt: ms, durationMs: ms,
//   route:     'math' | 'who' | 'confirm' | 'grounded' | 'chat' | 'error',
//   grounding: 'auto' | 'grounded' | 'free',   // the register the user selected (the chip)
//   steps:     [{ name, t, data }, ...],
//   prompt:    string | null,   // verbatim, grounded only
//   rawOutput: string | null,   // verbatim, grounded only
//   bound:     [{ claim, citation, score }, ...] | null,
//   vetoes:    [{ id, message, refuses }, ...] | null,
//   answer:    string,
//   sources:   number[],
//   revisions: [{ draft, offDiagonal:[...], replacedBy }, ...] | null,
//              // superseded confabulation drafts, preserved BESIDE the answer that
//              // replaced them — the conversational record's SEG/retract. A rewrite
//              // appends a truer word; the false one is never unwritten.
// }

export const SCHEMA_VERSION = 'eo-audit/1';
