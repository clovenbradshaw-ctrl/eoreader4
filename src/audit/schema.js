// The audit record schema. One JSON object per turn.
//
// {
//   schema:    'eo-audit/1',
//   id:        't42',
//   question:  string,
//   startedAt: ms, finishedAt: ms, durationMs: ms,
//   route:     'math' | 'who' | 'confirm' | 'grounded' | 'chat' | 'error',
//   steps:     [{ name, t, data }, ...],
//   prompt:    string | null,   // verbatim, grounded only
//   rawOutput: string | null,   // verbatim, grounded only
//   bound:     [{ claim, citation, score }, ...] | null,
//   vetoes:    [{ id, message, refuses }, ...] | null,
//   answer:    string,
//   sources:   number[],
// }

export const SCHEMA_VERSION = 'eo-audit/1';
