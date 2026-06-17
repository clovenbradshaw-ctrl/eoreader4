// The grounded prompt. Trimmed and stable so backend prefix caches hit.
//
// The eoreader3 map flagged the system prompt as the dominant fixed cost
// on a 0.5–3B local model. The shape here:
//
//   - Short, declarative rules.
//   - System message identical across turns (only the user content varies).
//   - User content: spans first, question last (recency bias on small models).
//   - No few-shot exemplars (they bloat without help on these sizes).

export const SYSTEM_GROUND = `You answer questions about a document. Rules:
- Use only the spans provided. Do not invent facts.
- If the spans don't answer the question, say so plainly.
- Be terse: one or two short sentences.
- Do not write citation tags like [s0]. We add them.`;

export const SYSTEM_CHAT = `You are a brief, accurate assistant. Two sentences max unless asked otherwise.`;

export const buildGroundedMessages = ({ question, spans }) => {
  const spanBlock = spans.map(s => `[s${s.idx}] ${s.text}`).join('\n');
  const userContent =
    `Spans from the document:\n${spanBlock}\n\nQuestion: ${question}`;
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
