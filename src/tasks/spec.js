// tasks/spec.js — the TASK CREATOR: a request → an artifact spec → a decomposition.
//
// The tasks holon (runner.js) drives a goal down to leaves and generates each one,
// but it imports no model and chooses no shape — `decompose` and `generate` arrive
// injected. The runner's own doc names the gap: `decompose` "may be a small LLM, or
// a heuristic, or a FIXED PLAN." This module is the fixed-plan face for generative
// artifacts. When the request is "write an essay", an essay is not a shapeless reach
// — it has a LENGTH, a FORMAT, and a STRUCTURE (open with a thesis, develop it in
// ordered paragraphs, close without a new claim). The creator reads the kind off the
// request, looks up that shape, and hands the runner a decomposition that already
// embodies it.
//
// WHY THIS IS NOT THE ANTI-CANON longgen/shape.js FORBIDS. There the system answers a
// question FROM A DOCUMENT, and a fixed response schema is a lie — it supplies a
// balance the evidence cannot earn (McKeown's schemata, "a void gate run backwards").
// That argument is about a GROUNDED READING: the shape must fall out of what the field
// offers. This is the opposite case — a GENERATIVE artifact the user asked for by name.
// "Write an essay" IS a request for the essay shape; supplying it is honoring the ask,
// not imposing a frame on evidence. The grounding discipline still rides underneath:
// each leaf the runner generates is grounded on its own spans (runner.js), so the spec
// chooses the SKELETON while the evidence still fills each bone.
//
// THE SMALL-MODEL CONSTRAINT IS THE WHOLE POINT (the runner's thesis, made dimensional).
// A small model can only be handed so much context and can only emit so much output in
// one reach. So every section carries a TOKEN BUDGET, and the budget drives the grain:
//
//   tokens ≤ LEAF_MAX_TOKENS   → a Figure leaf — one small-model reach writes it whole.
//   tokens >  LEAF_MAX_TOKENS   → a Pattern goal — too big for one bite, split further.
//
// That is exactly the cube's stopping rule (grain.js): keep decomposing while a goal is
// Pattern-grained, make a leaf only once it is Figure-grained — here read off a real
// budget, not guessed. A spec whose sections all fit the ceiling is a flat plan; ask for
// a LONG essay and the body paragraphs overflow the ceiling and nest one level deeper,
// each part still a one-reach generation. Length scales the budget; the budget scales the
// tree; the tree keeps every generation inside what a small model can actually produce.
//
// THREE SOURCES OF A SHAPE, in priority order (`createTaskSpec`):
//   1. a LEARNED definition — one the caller defined previously (the library cache).
//   2. a BUILT-IN template — the shapes shipped here (essay, report, story, …).
//   3. NOTHING — `needsResearch` is true; the caller may propose a web search for the
//      "good elements of a <kind>", parse the result with `deriveSpecFromDefinition`,
//      and `define` it into the library so the next request reuses it. The fetch is the
//      caller's (proposer-only, the web.js discipline) — this module never touches the
//      network, exactly as the runner never imports a model.

import { GRAINS } from '../core/index.js';
import { PATTERN, FIGURE } from './grain.js';
import { MAX_FANOUT } from './constants.js';
import { runTaskGraph } from './runner.js';
import { organFor, createOutputRegistry } from '../organs/out/index.js';

// ── The small-model budgets ──────────────────────────────────────────────────
// LEAF_MAX_TOKENS — the most one small-model reach should emit (a paragraph). A
// section budgeted above it is Pattern-grained and splits; at or below it is a
// Figure leaf. LEAF_MIN_TOKENS floors a section so a thin share never budgets a leaf
// to nothing. CONTEXT_SPANS is the advisory retrieval width per leaf — how many
// evidence spans the caller should feed one generation, so a leaf's context stays
// inside the small model's window the same way its output stays inside the ceiling.
export const LEAF_MAX_TOKENS = 256;
export const LEAF_MIN_TOKENS = 64;
export const CONTEXT_SPANS = 6;

// ── Length: the request's own size words scale the budget ─────────────────────
// "a SHORT essay" / "a LONG, DETAILED report" — the only length prescription the
// system carries (intent.js keeps length out of the prompt; here it sizes the PLAN,
// not a sentence count). Default 1 when the request names no size.
const LENGTH_SCALE = Object.freeze({
  brief: 0.45, short: 0.5, quick: 0.5,
  normal: 1,
  long: 1.8, detailed: 1.8, 'in-depth': 1.8, thorough: 2.0, comprehensive: 2.4, full: 1.8,
});
const LENGTH_RE = /\b(brief|short|quick|long|detailed|in[- ]depth|thorough|comprehensive|full)\b/i;

// readLength(request) → { label, scale }. `label` rides into the artifact goal so the
// goal reads as the user phrased it ("Write a long essay …"); `scale` sizes the budget.
export const readLength = (request = '') => {
  const m = String(request || '').match(LENGTH_RE);
  if (!m) return { label: '', scale: 1 };
  const word = m[1].toLowerCase().replace(' ', '-');
  return { label: word === 'in-depth' ? 'in-depth' : m[1].toLowerCase(), scale: LENGTH_SCALE[word] ?? 1 };
};

// ── Classifying the artifact kind ─────────────────────────────────────────────
// The same cheap regex read as readTask/classifyWantedType, lifted to GENERATIVE
// artifacts. Order matters: the more specific kinds are tried before the looser ones,
// and `answer` is the default — a request that names no artifact decomposes to a
// single leaf (the degenerate task graph the runner's doc promises ≡ one generation).
export const ARTIFACT_KINDS = Object.freeze([
  'essay', 'report', 'story', 'review', 'letter', 'list', 'summary', 'melody', 'answer',
]);

export const classifyArtifact = (request = '') => {
  const q = String(request || '').toLowerCase().trim();
  if (!q) return 'answer';
  if (/\bessay\b/.test(q)) return 'essay';
  if (/\b(report|white\s?paper|brief(?:ing)?|memo)\b/.test(q)) return 'report';
  if (/\b(short\s+story|story|tale|fable|narrative|fiction)\b/.test(q)) return 'story';
  if (/\b(review|critique|appraisal|assessment)\b/.test(q)) return 'review';
  if (/\b(letter|email|e-?mail|note\s+to|message\s+to)\b/.test(q)) return 'letter';
  if (/\b(list|bullet(?:ed|s)?|enumerate|rundown)\b/.test(q)) return 'list';
  if (/\b(summary|summari[sz]e|overview|recap|tl;?dr)\b/.test(q)) return 'summary';
  // a non-text artifact, planned by the same machinery — its leaves render through the
  // music output organ instead of text (docs/omnimodal-task-language.md).
  if (/\b(melody|tune|jingle|riff|theme\s+music)\b/.test(q)) return 'melody';
  return 'answer';
};

// ── The subject the artifact is ABOUT ─────────────────────────────────────────
// Strip the leading imperative and the artifact framing — "write a short essay about
// X" / "draft a report on Y" → "X" / "Y" — so the section goals can name the subject.
// Heuristic and forgiving: when nothing cleanly remains, the whole request stands.
const LEAD_VERB = /^\s*(?:please\s+)?(?:can you\s+|could you\s+)?(?:write|compose|draft|create|generate|produce|give\s+me|make|prepare|put\s+together)\b/i;
const ARTICLE = /^\s*(?:a|an|the|me|us)\b/i;
const LENGTH_WORD = /^\s*(?:brief|short|quick|long|detailed|in[- ]depth|thorough|comprehensive|full)\b/i;
const KIND_NOUN = new RegExp(`^\\s*(?:${ARTIFACT_KINDS.join('|')})s?\\b`, 'i');
const PIVOT = /^\s*(?:about|on|regarding|concerning|covering|for|of|to)\b/i;

// A single structured peel — leading verb, the OBJECT article (once), any length words,
// the artifact noun, then the "about/on/to" pivot. The subject keeps its OWN article
// ("the sea" stays "the sea"), so the article strip runs once at the front, never inside
// the subject. When nothing clean remains, the request stands rather than vanishing.
export const subjectOf = (request = '') => {
  let s = String(request || '').trim().replace(/[?.!]+\s*$/, '');
  s = s.replace(LEAD_VERB, '').trim();
  s = s.replace(ARTICLE, '').trim();
  let prev = null;
  while (s && s !== prev) { prev = s; s = s.replace(LENGTH_WORD, '').trim(); }   // "long detailed"
  s = s.replace(KIND_NOUN, '').trim();
  s = s.replace(PIVOT, '').trim();
  return s || String(request || '').trim();
};

// ── The built-in shapes (what's been "defined previously", shipped) ───────────
// Each template is an ordered list of SECTIONS. A section has a `role` (its name in
// the artifact), a `share` (its slice of the total budget, relative — normalised at
// build), a `goal(subject[, i, n])` that becomes the small model's instruction, and
// an optional `repeat` (the body of an essay is N paragraphs, one section each).
// `size` is the kind's default total at length 1, in the OUTPUT ORGAN's native unit
// (tokens for text, beats for music); `organ` names that output organ (default text);
// `format` rides to each leaf as a within-organ styling hint (prose / markdown / bullets).
const T = (kind, format, size, note, sections, organ = 'text') =>
  Object.freeze({ kind, format, size, organ, note, sections, source: 'builtin' });

export const ARTIFACT_TEMPLATES = Object.freeze({
  essay: T('essay', 'prose', 700, 'a thesis opened, defended in ordered paragraphs, and closed', [
    { role: 'introduction', share: 1.0, goal: (s) => `Open the essay on ${s}: set the context in a sentence or two and state the thesis.` },
    { role: 'body', share: 1.2, repeat: 3, goal: (s, i) => `Develop supporting point ${i} of the thesis on ${s}, in one focused paragraph.` },
    { role: 'conclusion', share: 1.0, goal: (s) => `Close the essay on ${s}: draw the points together and restate the thesis; introduce no new claim.` },
  ]),
  report: T('report', 'markdown', 1100, 'an oriented document — summary, findings under headings, a recommendation', [
    { role: 'summary', share: 1.0, goal: (s) => `Write the executive summary of a report on ${s}: the situation and the headline finding.` },
    { role: 'background', share: 1.4, goal: (s) => `Write the background section on ${s}: what is known and why it matters.` },
    { role: 'findings', share: 2.4, goal: (s) => `Write the findings section on ${s}: the substantive analysis, the evidence and what it shows.` },
    { role: 'recommendation', share: 1.2, goal: (s) => `Write the recommendation section on ${s}: what should be done, grounded in the findings.` },
  ]),
  story: T('story', 'prose', 800, 'a narrative arc — setup, complication, climax, resolution', [
    { role: 'setup', share: 1.0, goal: (s) => `Open a short story about ${s}: establish the scene and the character.` },
    { role: 'rising action', share: 1.2, goal: (s) => `Continue the story about ${s}: introduce the complication and build tension.` },
    { role: 'climax', share: 1.0, goal: (s) => `Write the climax of the story about ${s}: the turning point.` },
    { role: 'resolution', share: 0.9, goal: (s) => `Close the story about ${s}: resolve the arc.` },
  ]),
  review: T('review', 'prose', 600, 'a judgment — overview, strengths, weaknesses, a verdict', [
    { role: 'overview', share: 1.0, goal: (s) => `Open a review of ${s}: what it is and the overall impression.` },
    { role: 'strengths', share: 1.0, goal: (s) => `Write the strengths of ${s}, with specifics.` },
    { role: 'weaknesses', share: 1.0, goal: (s) => `Write the weaknesses of ${s}, with specifics.` },
    { role: 'verdict', share: 0.8, goal: (s) => `Write the verdict on ${s}: weigh the two sides and land a recommendation.` },
  ]),
  letter: T('letter', 'prose', 350, 'a greeting, a body that states the purpose, a closing', [
    { role: 'greeting', share: 0.4, goal: (s) => `Write the greeting of a letter about ${s}.` },
    { role: 'body', share: 1.6, goal: (s) => `Write the body of the letter about ${s}: state the purpose and the substance.` },
    { role: 'closing', share: 0.5, goal: (s) => `Write the closing of the letter about ${s}.` },
  ]),
  list: T('list', 'bullets', 400, 'an enumeration — one section, items as bullets', [
    { role: 'list', share: 1.0, goal: (s) => `Write a list about ${s}: the items, each as one bullet.` },
  ]),
  summary: T('summary', 'prose', 320, 'one section — the whole drawn together briefly', [
    { role: 'summary', share: 1.0, goal: (s) => `Write a brief summary of ${s}: the main points, drawn together.` },
  ]),
  // A NON-TEXT artifact, planned by the same machinery — its leaves render through the
  // music output organ (native unit: BEATS, not tokens). Proof that the task language is
  // not text-shaped: same createTaskSpec, same runTaskGraph, a different output organ.
  melody: T('melody', 'notes', 32, 'a short melodic arc — opening motif, development, cadence', [
    { role: 'opening motif', share: 1.0, goal: (s) => `State the opening motif of a melody evoking ${s}.` },
    { role: 'development', share: 1.6, goal: (s) => `Develop the motif of the melody evoking ${s}: vary and extend it.` },
    { role: 'cadence', share: 1.0, goal: (s) => `Close the melody evoking ${s}: resolve to a cadence.` },
  ], 'music'),
  // The default: no artifact named, so no shape to impose — a single goal, one leaf,
  // byte-identical to one small-model call (the runner's degenerate graph).
  answer: T('answer', 'prose', 256, 'no artifact shape — a single grounded reach', [
    { role: 'answer', share: 1.0, goal: (s) => s },
  ]),
});

// ── Expanding a template into concrete sections ───────────────────────────────
// `repeat` body paragraphs become separate sections (body 1, body 2, body 3); the
// goal builder is handed the index so each reads distinctly. The result is a flat,
// ordered, inspectable section list — the structure, before budgets are assigned.
const expandSections = (template, subject) => {
  const out = [];
  for (const s of template.sections) {
    const n = s.repeat && s.repeat > 1 ? s.repeat : 1;
    for (let i = 1; i <= n; i++) {
      const goal = typeof s.goal === 'function'
        ? (n > 1 ? s.goal(subject, i, n) : s.goal(subject))
        : String(s.goal);
      out.push({ role: n > 1 ? `${s.role} ${i}` : s.role, share: Number(s.share) > 0 ? Number(s.share) : 1, goal });
    }
  }
  return out;
};

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

// The artifact-level goal — the root of the task graph, phrased as the user asked
// (with the length word when they gave one). Not a leaf normally; it decomposes.
const artifactGoal = (kind, subject, lengthLabel) => {
  const len = lengthLabel ? `${lengthLabel} ` : '';
  const about = subject ? ` about ${subject}` : '';
  return `Write ${article(len || kind)} ${len}${kind}${about}`.replace(/\s+/g, ' ').trim();
};

// ── The creator: a request → a concrete spec ──────────────────────────────────
// Reads the kind, the subject and the length off the request, picks the shape (learned
// → built-in), and assigns every section an ABSOLUTE token budget from its share of the
// length-scaled total. The budget fixes each section's grain (Figure leaf vs Pattern
// goal) and its advisory context width, so the spec already encodes the small-model
// limits the runner will honor. `library` is optional (createSpecLibrary); without it
// the built-ins govern.
export const createTaskSpec = ({ request = '', library = null, length = null } = {}) => {
  // The classifier knows the built-in kinds; a LEARNED kind (one the library defined,
  // e.g. a fetched "haiku") is detected by name when the built-in read came back blank.
  let kind = classifyArtifact(request);
  if (library && kind === 'answer' && typeof library.kinds === 'function') {
    const hit = library.kinds().find((k) => new RegExp(`\\b${k}\\b`, 'i').test(request));
    if (hit) kind = hit;
  }
  const subjectRaw = subjectOf(request);
  const subject = subjectRaw && subjectRaw.toLowerCase() !== kind ? subjectRaw : 'the requested topic';

  const template = (library && library.get(kind)) || ARTIFACT_TEMPLATES[kind] || ARTIFACT_TEMPLATES.answer;

  // The OUTPUT ORGAN governs the budget math: its native unit, its single-reach ceiling
  // (a paragraph for text, a phrase for music), its floor, and its context width. The
  // share→budget conversion that used to be text-coded globals now reads off the organ,
  // so the same creator sizes a melody in beats and an essay in tokens
  // (docs/omnimodal-task-language.md).
  const organ = organFor(template.organ || 'text');
  const baseSize = template.size ?? template.tokens ?? ARTIFACT_TEMPLATES.answer.size;
  const len = length ? { label: length === 'normal' ? '' : length, scale: LENGTH_SCALE[length] ?? 1 } : readLength(request);
  const total = Math.max(organ.minBudget, Math.round(baseSize * len.scale));

  const expanded = expandSections(template, subject);
  const shareSum = expanded.reduce((s, x) => s + x.share, 0) || 1;

  const sections = expanded.map((x, i) => {
    const extent = clamp(Math.round((total * x.share) / shareSum), organ.minBudget, total);
    return Object.freeze({
      id: `${i}`,
      role: x.role,
      goal: x.goal,
      organ: organ.id,
      extent,            // the leaf's budget in the organ's native unit
      unit: organ.unit,
      // budget IS the grain: a section over the organ's single-reach ceiling is a Pattern
      // goal the decomposer must split; one that fits is a Figure leaf.
      grain: extent > organ.ceiling ? PATTERN : FIGURE,
      contextSpans: organ.contextOf(extent),
      // back-compat alias: the text path has always exposed `tokens`. Present only when
      // the native unit IS tokens, so a music leaf never carries a misleading token count.
      ...(organ.unit === 'tokens' ? { tokens: extent } : {}),
    });
  });

  // A single-section artifact has no structure to unravel: its root IS the leaf, and the
  // root goal is that section's own instruction (so the one generation gets the real
  // prompt, not a bookkeeping "Write an answer about …"). A multi-section artifact roots
  // at the artifact goal and decomposes into its sections.
  const single = sections.length === 1;
  const goal = single
    ? sections[0].goal
    : artifactGoal(kind, subjectRaw && subjectRaw.toLowerCase() !== kind ? subjectRaw : '', len.label);

  return Object.freeze({
    kind,
    subject: subjectRaw,
    organ: organ.id,
    format: template.format,
    note: template.note,
    source: template.source || 'builtin',
    extent: total,            // the artifact's total budget in the organ's native unit
    unit: organ.unit,
    length: len.label || 'normal',
    goal,
    sections,
    // back-compat alias for the text path (the spec has always exposed `tokens`).
    ...(organ.unit === 'tokens' ? { tokens: total } : {}),
  });
};

// ── A plan: the spec, plus the two runTaskGraph faces it derives ──────────────
// `planArtifact` accepts a built spec or the creator's args. It owns a registry keyed
// by goal string so the generate wrapper can recover each leaf's budget, and so a
// Pattern section that gets split registers its parts as they are produced — the
// decomposer runs a node before its children, so a part is always registered before
// the runner reaches it.
export const planArtifact = (specOrArgs = {}) => {
  const spec = specOrArgs && Array.isArray(specOrArgs.sections) ? specOrArgs : createTaskSpec(specOrArgs);
  const single = spec.sections.length === 1;
  const registry = new Map(spec.sections.map((s) => {
    const g = resolveGoal(s, spec.subject);
    return [g, { ...s, goalText: g }];
  }));
  // A single-section artifact roots at that section's goal — register it so the leaf's
  // budget is recoverable when the root IS the leaf.
  if (single) registry.set(spec.goal, { ...spec.sections[0], goalText: spec.goal });

  // decompose(view) → sub-goals while a goal overflows one reach, [] once it fits.
  const decompose = ({ goal, depth }) => {
    if (depth === 0) {
      if (single) return [];   // no structure to unravel: the root is the leaf
      // The root unravels into the spec's sections, each carrying its declared grain.
      return spec.sections.map((s) => ({ goal: resolveGoal(s, spec.subject), grain: s.grain }));
    }
    const sec = registry.get(goal);
    if (!sec || sec.grain !== PATTERN) return [];   // unknown or Figure → a leaf

    // Split a too-big section into leaf-sized parts — the budget-driven SEG cut, off the
    // section's OWN output-organ ceiling (a paragraph for text, a phrase for music). Parts
    // share the section's budget; a part still over the ceiling stays Pattern and the
    // recursion splits it again (bounded by the runner's MAX_DEPTH guard).
    const organ = organFor(sec.organ);
    const parts = clamp(Math.ceil(sec.extent / organ.ceiling), 2, MAX_FANOUT);
    const each = Math.max(organ.minBudget, Math.round(sec.extent / parts));
    const subs = [];
    for (let k = 1; k <= parts; k++) {
      const g = `${sec.goalText || goal} — part ${k} of ${parts}`;
      const sub = {
        ...sec, goalText: g, role: `${sec.role} · part ${k}`,
        extent: each, grain: each > organ.ceiling ? PATTERN : FIGURE,
        contextSpans: organ.contextOf(each),
        ...(organ.unit === 'tokens' ? { tokens: each } : {}),
      };
      registry.set(g, sub);
      subs.push({ goal: g, grain: sub.grain });
    }
    return subs;
  };

  const budgetFor = (goal) => registry.get(goal) || null;

  return { spec, goal: spec.goal, decompose, budgetFor, registry };
};

// Resolve a section's goal to its instruction string (the builder may be a function).
const resolveGoal = (section, subject) =>
  (typeof section.goal === 'function' ? section.goal(subject || 'the requested topic') : String(section.goal));

// ── The generate face (text): every leaf handed its budget, role, and format ──
// The runner hands a leaf its cube identity (Figure-maker); this layer adds the
// small-model contract — `maxTokens` (the output ceiling for this leaf), `role` (where
// it sits in the artifact), `format` (how to render), and `contextSpans` (how wide to
// retrieve). The caller's real `generate` reads these and makes the model call; this
// module never imports a model, exactly as the runner does not. This is the TEXT path,
// kept as the single-modality shorthand; `withOrgans` is the general dispatch.
export const withBudgets = (plan, generate) => (view) => {
  const sec = plan.budgetFor(view.goal);
  const extent = sec ? sec.extent : Math.min(LEAF_MAX_TOKENS, plan.spec.extent ?? plan.spec.tokens);
  return generate({
    ...view,
    spec: plan.spec,
    role: sec ? sec.role : null,
    format: plan.spec.format,
    maxTokens: extent,
    contextSpans: sec ? sec.contextSpans : CONTEXT_SPANS,
  });
};

// ── The omnimodal generate face: dispatch each leaf to its OUTPUT ORGAN ────────
// The conversion the design note specifies (docs/omnimodal-task-language.md). Each leaf
// carries an `organ` and an `extent` in that organ's native unit; this looks up the
// section's budget, builds the modality-neutral leaf view, and dispatches to the organ's
// renderer in `registry`. The renderer (organs/out) adapts the view to its modality and
// makes the atom. Falls back to the text renderer for an untagged leaf, so it is a strict
// superset of `withBudgets`. `runTaskGraph`, the projection, and the grain backstop are
// unchanged — they fold a leaf whose `output` is prose today and a phrase tomorrow.
export const withOrgans = (plan, registry) => (view) => {
  const sec = plan.budgetFor(view.goal);
  const organId = (sec && sec.organ) || plan.spec.organ || 'text';
  const render = registry[organId] || registry.text;
  if (!render) throw new Error(`no output organ for "${organId}"`);
  const organ = organFor(organId);
  return render({
    ...view,
    spec: plan.spec,
    role: sec ? sec.role : null,
    organ: organId,
    format: plan.spec.format,
    extent: sec ? sec.extent : organ.minBudget,
    unit: organ.unit,
    contextSpans: sec ? sec.contextSpans : organ.contextOf(organ.minBudget),
  });
};

// ── The convenience: create the task and run it ───────────────────────────────
// A few lines, the way the runner's doc promises: build the spec, derive the faces,
// wrap generation, run the graph. Pass `generate` for the single-modality (text)
// shorthand, OR `organs` — a map of per-modality generators ({ text, music, … }) or a
// bare text generator — to dispatch each leaf to its output organ. `library` lets a
// learned shape win; `runner` is swappable for tests. Returns the runner's result with
// the spec attached.
export const runArtifact = async ({
  request = '', generate, organs = null, library = null, length = null,
  onUpdate = null, signal = null, runner = runTaskGraph,
} = {}) => {
  const plan = planArtifact({ request, library, length });
  // `organs` chooses the omnimodal dispatch; a bare `generate` is the text shorthand.
  const face = organs
    ? withOrgans(plan, createOutputRegistry(organs))
    : withBudgets(plan, generate);
  const res = await runner({
    goal: plan.goal,
    decompose: plan.decompose,
    generate: face,
    onUpdate,
    signal,
  });
  return { ...res, spec: plan.spec };
};

// ── The learned / web definition path ─────────────────────────────────────────
// "you could have it do a websearch to determine what the good elements of an essay
// are, or if that's been defined previously." The library is the "defined previously"
// half; deriveSpecFromDefinition + a caller's web fetch is the "websearch" half.

// The structural element words a definition of a written form tends to name, in the
// rough order they appear — used as a fallback when a fetched definition is prose, not
// a clean list.
const ELEMENT_WORDS = Object.freeze([
  'abstract', 'introduction', 'hook', 'thesis', 'background', 'context', 'setup',
  'body', 'argument', 'point', 'evidence', 'example', 'analysis', 'method', 'results',
  'discussion', 'counterargument', 'rebuttal', 'rising action', 'climax', 'resolution',
  'strengths', 'weaknesses', 'recommendation', 'verdict', 'conclusion', 'summary', 'closing',
]);
const STOP_ROLE = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'your', 'about', 'a', 'an', 'of',
  // generic headers that name the LIST of elements, not an element itself
  'sections', 'section', 'parts', 'part', 'elements', 'element', 'structure',
  'contents', 'components', 'component', 'format', 'outline',
]);

const normRole = (raw) => String(raw || '').toLowerCase().replace(/[^a-z \-]/g, '').replace(/\s+/g, ' ').trim();
const plausibleRole = (r) => {
  if (!r || r.length < 3 || r.length > 40) return false;
  const words = r.split(' ');
  return words.length <= 3 && !STOP_ROLE.has(r);
};

// deriveSpecFromDefinition(kind, text, base?) → a template, or null when the text yields
// nothing usable (the caller then keeps the built-in — behaviour only improves, never
// regresses, the formulateSearchQuery discipline). It pulls section roles from the
// definition: numbered/bulleted/colon-led headings first, then known element words by
// order of appearance. Budgets and format are inherited from `base` (the built-in for
// the kind) so a derived shape is sized like a shipped one.
export const deriveSpecFromDefinition = (kind, text, base = ARTIFACT_TEMPLATES[kind]) => {
  const t = String(text || '');
  if (!t.trim()) return null;

  const found = [];
  const seen = new Set();
  const add = (raw) => {
    const r = normRole(raw);
    if (r && !seen.has(r) && plausibleRole(r)) { seen.add(r); found.push(r); }
  };

  for (const line of t.split(/\n+/)) {
    let m = line.match(/^\s*(?:\d+[.)]|[-*•])\s*([A-Za-z][A-Za-z \-]{2,40})/);  // "1. Introduction", "- Body"
    if (m) add(m[1]);
    m = line.match(/^\s*([A-Z][A-Za-z \-]{2,30}):/);                            // "Introduction:"
    if (m) add(m[1]);
  }

  if (found.length < 2) {
    const low = t.toLowerCase();
    const hits = ELEMENT_WORDS
      .map((w) => ({ w, at: low.indexOf(w) }))
      .filter((h) => h.at >= 0)
      .sort((a, b) => a.at - b.at);
    for (const h of hits) add(h.w);
  }

  if (found.length < 2) return null;

  const roles = found.slice(0, MAX_FANOUT);
  return Object.freeze({
    kind,
    format: base?.format || 'prose',
    tokens: base?.tokens || 600,
    note: `derived from a definition (${roles.length} elements)`,
    source: 'learned',
    sections: roles.map((role) => ({ role, share: 1, goal: (s) => `Write the ${role} of the ${kind} on ${s}.` })),
  });
};

// ── The library cache: a shape defined once is reused ─────────────────────────
// In-memory, keyed by kind. `get` prefers a learned shape over the built-in; `learned`
// returns only the learned one (null when none); `has` is true when ANY shape covers
// the kind. `define`/`defineFromDefinition` write a learned shape, so a definition
// fetched once ("defined previously") guides every later request without re-fetching.
export const createSpecLibrary = (seed = {}) => {
  const learned = new Map();
  for (const [kind, tmpl] of Object.entries(seed)) learned.set(kind, Object.freeze({ ...tmpl, source: 'learned' }));
  return {
    get: (kind) => learned.get(kind) || ARTIFACT_TEMPLATES[kind] || null,
    learned: (kind) => learned.get(kind) || null,
    has: (kind) => learned.has(kind) || !!ARTIFACT_TEMPLATES[kind],
    kinds: () => [...learned.keys()],   // the LEARNED kinds, so the creator can detect them by name
    define: (kind, tmpl) => { const t = Object.freeze({ ...tmpl, kind, source: 'learned' }); learned.set(kind, t); return t; },
    defineFromDefinition: (kind, text) => {
      const t = deriveSpecFromDefinition(kind, text);
      if (t) learned.set(kind, t);
      return t;
    },
  };
};

// needsResearch — is there NO shape for this kind (neither learned nor shipped)? When
// true the caller may propose a web search; proposer-only, like web.js — nothing is
// fetched here. `researchQuery` is the query to hand a `webSearch`, whose result feeds
// `defineFromDefinition`.
export const needsResearch = (kind, library = null) =>
  !(library ? library.has(kind) : !!ARTIFACT_TEMPLATES[kind]);

export const researchQuery = (kind) => `good elements and structure of a ${kind}: what sections it has`;
