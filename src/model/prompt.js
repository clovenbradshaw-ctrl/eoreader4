// The grounded prompt. Trimmed and stable so backend prefix caches hit.
//
// The structure follows what worked in the eoreader3 reader: the user turn
// is ordered spans (verbatim, trusted) → reading (the integral fold, "usually
// right, sometimes wrong") → the question repeated last for recency on small
// models. The system message is identical across turns so only the user
// content varies — the prefix cache holds.
//
//   - Spans are verbatim source. The model is told to trust them as fact.
//   - The reading is the mechanical fold of those spans — a synthesis, not a
//     copy. The model is told it is usually right, and that a span wins any
//     conflict. This is the note "ride-along" the bare prompt was missing.
//   - The question is last, where a 0.5–3B model attends hardest.
//   - No few-shot exemplars (they bloat without help at these sizes).

export const SYSTEM_GROUND = `You answer a question about a document using only the material provided.
- The SPANS are verbatim from the document — treat them as fact.
- The READING is a mechanical summary of those spans — usually right, but if it conflicts with a span, the span wins.
- Answer directly and specifically from this material. If the answer is not in it, say the document does not say.
- Do not use outside knowledge. Do not invent names or facts. Do not write citation tags like [s0]; they are added for you.`;

export const SYSTEM_CHAT = `You are a brief, accurate assistant. Two sentences max unless asked otherwise.`;

export const buildGroundedMessages = ({ question, spans, note }) => {
  const spanBlock = spans.map(s => `[s${s.idx}] ${s.text}`).join('\n');
  const readingBlock = note && note.text
    ? `\n\nReading of the spans (usually right; a span wins any conflict):\n${note.text}`
    : '';
  const userContent =
    `Spans (verbatim, trusted):\n${spanBlock}${readingBlock}\n\nQuestion: ${question}`;
  return [
    { role: 'system', content: SYSTEM_GROUND },
    { role: 'user',   content: userContent },
  ];
};

export const buildChatMessages = ({ question, history = [] }) => {
  return [
    { role: 'system', content: SYSTEM_CHAT },
    ...history,
    { role: 'user',   content: question },
  ];
};
