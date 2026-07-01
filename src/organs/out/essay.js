// organs/out/essay — the ESSAY organ: prose lowered not as one beat but as a whole,
// arc-walked piece with a hard length floor.
//
// The text organ (organs/out/text) renders a SINGLE task leaf into a sentence-scale beat:
// one directive, one generate call, capped at its `ceiling` of tokens. That is the right
// grain for an answer, and exactly the wrong one for an essay — it is why "write an essay
// on dolphins" comes back as a three-sentence dolphin blurb. An essay is not a bigger beat;
// it is a WALK: open, develop, turn, and land across many sections, each a full pass of the
// talker, accumulated until the piece clears a real length floor (docs/generation-by-field-
// reading.md, the arc — open/develop/close).
//
// This organ owns that walk. It is model-INJECTED like every other output organ (organs/out
// never imports a talker): the caller hands a `talker(messages, opts) → Promise<string>`
// (the same contract streamPhrase satisfies), and this plans an outline, composes each
// section over the running draft, extends when the piece is short, and always lands on a
// conclusion. Pure orchestration — the only non-determinism is the injected talker — so it
// runs headless in a test with a stub talker as readily as it runs the chat surface's model.

// THE LENGTH FLOOR. An essay is at least this many words; the walk does not stop developing
// until the body clears it, then lands. "At least" — the conclusion pushes the final count a
// little past. A floor, never a ceiling: a rich outline may run well over.
export const ESSAY_MIN_WORDS = 2500;

// Words, counted the honest way: whitespace-delimited runs. Headings count too — they are
// part of the piece — but the floor is really carried by the bodies.
export const countWords = (s) => (String(s ?? '').trim().match(/\S+/g) || []).length;

// The neutral arc a bodiless commission still gets. If the planner returns nothing usable we
// walk THIS — a real open/develop/turn/land skeleton — so the organ always has a shape to
// fill and the floor is always reachable. The conclusion is handled separately (it always
// lands last), so it is not in this list.
const DEFAULT_ARC = Object.freeze([
  'Introduction',
  'Background and context',
  'The central argument',
  'Evidence and illustration',
  'Complications and counterpoints',
  'Wider implications',
]);

// When the outline runs dry but the piece is still short, we develop further along these
// angles rather than repeating a heading. Cycled in order, bounded by `maxSections`, so the
// walk always terminates.
const DEVELOP_ANGLES = Object.freeze([
  'A closer look',
  'Another dimension',
  'Objections considered',
  'A concrete illustration',
  'The longer view',
  'What remains unsettled',
  'Second thoughts',
  'One more thread',
]);

const CONCLUSION = 'Conclusion';

// Strip the assistant preamble a small model tends to prepend ("Sure! Here is…", "Certainly:")
// so a section body starts on the prose, not the throat-clearing. Mirrors the writer path in
// the chat app. Conservative: only a leading, single-line "here's/sure/certainly" opener goes.
const stripPreamble = (s) => String(s ?? '')
  .replace(/^\s*(?:sure[,!.]?\s+|certainly[,!.]?\s+|of course[,!.]?\s+|absolutely[,!.]?\s+|here(?:'s| is| you go|’s)\b[^\n:]*:?\s*)/i, '')
  .trim();

// ── Planning ────────────────────────────────────────────────────────────────
// The commission → an outline. The talker is asked for a title and a list of section
// headings in a strict, easy-to-parse shape; `parseOutline` tolerates the ways a small
// model bends that shape, and `planOutline` guarantees a usable arc no matter what comes
// back (padding from DEFAULT_ARC, capping the count).

export const planMessages = (topic) => ([
  { role: 'system', content:
    'You are an essayist planning a long-form essay. Given a commission, produce a working outline: ' +
    'a title, then the section headings the essay will move through — an opening, several developing ' +
    'sections that each take a distinct angle, and a close. Reply in EXACTLY this format and nothing else:\n' +
    'TITLE: <the essay title>\n1. <first section heading>\n2. <second section heading>\n… (6 to 9 sections, ending on a conclusion).' },
  { role: 'user', content: `Commission: ${String(topic || '').trim()}` },
]);

// Parse the planner's reply into { title, headings }. Tolerant: the title may be prefixed or
// bare; headings may be numbered, bulleted, or plain lines. Anything unparseable yields empty
// fields, which planOutline then backfills.
export const parseOutline = (text, topic = '') => {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  let title = '';
  const headings = [];
  for (const line of lines) {
    const t = line.match(/^title\s*[:\-–]\s*(.+)$/i);
    if (t) { title = t[1].trim().replace(/^["'“”]|["'“”]$/g, ''); continue; }
    // A heading line: "1. X", "1) X", "- X", "• X", "## X", or a plain short line.
    const m = line.match(/^(?:\d+[.)]|[-*•]|#{1,4})\s*(.+)$/);
    const raw = m ? m[1] : line;
    const h = raw.replace(/^["'“”]|["'“”:]+$/g, '').replace(/\*\*/g, '').trim();
    if (!h) continue;
    // Skip a restated "title:" or an obvious meta line that slipped the format.
    if (/^title\b/i.test(h)) continue;
    if (h.length > 90) continue;                 // a paragraph, not a heading
    if (!/[a-z]/i.test(h)) continue;
    headings.push(h);
  }
  if (!title) {
    const topicWords = String(topic || '').trim();
    title = topicWords ? topicWords.replace(/\s+/g, ' ').replace(/^[a-z]/, (c) => c.toUpperCase()) : 'An Essay';
  }
  return { title, headings };
};

// planOutline(rawPlan, topic) → { title, body:[headings], conclusion }. Guarantees a usable
// arc: at least a handful of body sections (padded from DEFAULT_ARC), a title, and a single
// conclusion pulled out to land last. Never trusts the planner to have produced enough.
export const planOutline = (rawPlan, topic = '') => {
  const { title, headings } = parseOutline(rawPlan, topic);
  // Pull any heading that reads as the close out to the end; the walk lands on it explicitly.
  const body = headings.filter((h) => !/\bconclu(?:sion|de|ding)\b|\bin closing\b|\bfinal thoughts\b/i.test(h));
  // Backfill from the neutral arc until we have a real body to develop.
  for (const h of DEFAULT_ARC) {
    if (body.length >= DEFAULT_ARC.length) break;
    if (!body.some((b) => b.toLowerCase() === h.toLowerCase())) body.push(h);
  }
  // Keep the up-front plan bounded; the length floor extends it dynamically if needed.
  const trimmed = body.slice(0, 9);
  return { title, body: trimmed, conclusion: CONCLUSION };
};

// ── Composing one section ────────────────────────────────────────────────────
// Each section is a full talker pass, prompted with the whole plan and a tail of the draft
// so the prose stays continuous and non-repeating. `targetWords` steers length; `role`
// names the arc move so the opening opens and the close lands.

export const sectionMessages = ({ topic, title, outline = [], heading, index = 0, total = 0, tail = '', targetWords = 380, role = 'develop' } = {}) => {
  const plan = outline.length ? `\nThe essay's outline: ${outline.join(' · ')}.` : '';
  const soFar = tail ? `\n\nThe essay so far ends:\n"""\n${tail}\n"""\nContinue from there — do not repeat what is already written.` : '';
  const move = role === 'open'
    ? 'This is the OPENING section — set the essay in motion: frame the subject, stake the question, and draw the reader in. Do not summarise the whole essay.'
    : role === 'land'
      ? 'This is the CONCLUSION — land the essay: draw the threads together, say what it all amounts to, and close. Do not introduce a wholly new topic.'
      : 'Develop this section fully with its own angle — reasoning, specifics, and texture. Do not restate the introduction or pre-empt the conclusion.';
  return [
    { role: 'system', content:
      'You are an accomplished essayist writing one section of a longer essay. Write flowing, substantive prose in ' +
      'full paragraphs — no lists, no headings, no meta-commentary about the essay or these instructions. Aim for about ' +
      `${targetWords} words. Write ONLY the prose of this section.` },
    { role: 'user', content:
      `Essay commission: ${String(topic || '').trim()}\nWorking title: ${title}.${plan}\n\n` +
      `Section ${total ? `${index + 1} of ${total}+ ` : ''}— heading: "${heading}".\n${move}${soFar}` },
  ];
};

// The tail of the draft handed to the next section for continuity — the last ~`words` words.
const tailOf = (text, words = 90) => {
  const toks = String(text ?? '').trim().match(/\S+/g) || [];
  return toks.slice(-words).join(' ');
};

// maxTokens for a section: enough headroom over the word target (words ≈ 0.75·tokens), capped
// so a runaway decode can't stall the walk. Floors at 256 so even a terse target has room.
const tokensFor = (targetWords) => Math.max(256, Math.min(1024, Math.round(targetWords * 1.7)));

// ── The walk ─────────────────────────────────────────────────────────────────
// composeEssay — plan, then walk the arc over the ground until the body clears ESSAY_MIN_WORDS,
// then land on a conclusion. Model-injected; every talker pass streams through the hooks so a UI
// can render live. Returns the assembled markdown, the sections, and the final word count.
//
//   talker(messages, { maxTokens, temperature, signal, onToken }) → Promise<string>
//
// hooks (all optional): { onPhase(name), onSection({heading, index, role}), onToken(piece) }.
export const composeEssay = async ({
  topic,
  talker,
  minWords = ESSAY_MIN_WORDS,
  maxSections = 24,          // a BACKSTOP against a misbehaving talker, not the governor —
                            //   the word floor stops the walk first at the ~380-word target.
  targetPerSection = 380,
  temperature = 0.85,
  signal = null,
  hooks = {},
} = {}) => {
  if (typeof talker !== 'function') throw new TypeError('composeEssay: a talker function is required');
  const commission = String(topic || '').trim();
  if (!commission) throw new Error('composeEssay: an essay commission (topic) is required');
  const aborted = () => !!(signal && signal.aborted);

  // 1) PLAN — outline the arc. A planner failure is non-fatal: planOutline backfills a neutral arc.
  hooks.onPhase?.('planning');
  let rawPlan = '';
  try { rawPlan = await talker(planMessages(commission), { maxTokens: 400, temperature: 0.7, signal }); }
  catch (err) { if (aborted()) throw err; /* else walk the default arc */ }
  const { title, body: bodyHeadings, conclusion } = planOutline(rawPlan, commission);
  const outline = [...bodyHeadings, conclusion];   // the whole planned arc, handed to each section

  // 2) WALK — compose the body, extending with fresh angles until the floor is cleared.
  const sections = [];
  let out = `# ${title}\n\n`;
  let words = countWords(title);
  const queue = [...bodyHeadings];
  let developIdx = 0;
  let stalls = 0;
  let index = 0;

  const writeSection = async (heading, role) => {
    hooks.onPhase?.('writing');
    hooks.onSection?.({ heading, index, role, words });
    // A closing section aims a little fuller so the landing does not feel clipped.
    const target = role === 'land' ? Math.round(targetPerSection * 1.1) : targetPerSection;
    let raw = '';
    try {
      raw = await talker(
        sectionMessages({ topic: commission, title, outline, heading, index, total: queue.length + sections.length, tail: tailOf(out), targetWords: target, role }),
        { maxTokens: tokensFor(target), temperature, signal, onToken: (piece) => hooks.onToken?.(piece, heading) },
      );
    } catch (err) {
      if (aborted()) throw err;
      raw = '';
    }
    const text = stripPreamble(raw);
    const bw = countWords(text);
    sections.push({ heading, text, role, words: bw });
    out += `## ${heading}\n\n${text}\n\n`;
    words += bw + countWords(heading);
    index += 1;
    // Stall guard: a talker that returns (almost) nothing twice running ends the walk rather
    // than looping to the section cap on empty passes.
    if (bw < 15) { stalls += 1; } else { stalls = 0; }
    return bw;
  };

  // Open, then develop. The opening is the first queued heading (usually "Introduction").
  while (sections.length < maxSections - 1 && !aborted()) {
    let heading, role;
    if (queue.length) { heading = queue.shift(); role = sections.length === 0 ? 'open' : 'develop'; }
    else {
      if (words >= minWords) break;                 // body floor cleared — go land it
      heading = DEVELOP_ANGLES[developIdx % DEVELOP_ANGLES.length];
      developIdx += 1;
      role = 'develop';
    }
    await writeSection(heading, role);
    if (stalls >= 2) break;                          // the talker is stuck; stop developing
    if (!queue.length && words >= minWords) break;   // enough body — land it
  }

  // 3) LAND — always close on a conclusion, unless the walk was aborted or the talker is dead.
  if (!aborted() && stalls < 2) await writeSection(conclusion, 'land');

  const text = out.trimEnd() + '\n';
  hooks.onPhase?.('done');
  return {
    title,
    sections,
    text,
    words: countWords(text),
    metWords: countWords(text) >= minWords,
    aborted: aborted(),
  };
};
