// End-to-end exercise of the task creator + the omnimodal output organs.
//
// Drives the REAL pipeline: createTaskSpec → planArtifact → runTaskGraph → organs/out.
// Text leaves render through the actual model interface (the echo backend, offline and
// deterministic, grounded on per-leaf spans). Music leaves render through a small
// directive-reading generator. Nothing here is stubbed at the task layer — this is the
// same code path a real small model would run.
//
//   node scripts/task-creator-e2e.mjs

import { runArtifact, createTaskSpec } from '../src/tasks/index.js';
import { createModel, buildGroundedMessages } from '../src/model/index.js';

const rule = (t) => console.log('\n' + '═'.repeat(72) + `\n${t}\n` + '═'.repeat(72));

// ── a tiny corpus to ground the essay on (stands in for retrieval) ────────────
const CORPUS = [
  { idx: 0, text: 'The sea covers more than seventy percent of the planet’s surface.' },
  { idx: 1, text: 'Ocean currents redistribute heat and drive the world’s climate.' },
  { idx: 2, text: 'Tides rise and fall with the gravitational pull of the moon.' },
  { idx: 3, text: 'The deep sea remains the least explored region on Earth.' },
  { idx: 4, text: 'Marine life ranges from microscopic plankton to the blue whale.' },
  { idx: 5, text: 'Coastal communities have depended on the sea for trade and food for millennia.' },
];
// crude per-leaf "retrieval": pick spans whose words overlap the leaf goal, else spread.
const retrieveFor = (goal, k) => {
  const words = new Set(String(goal).toLowerCase().match(/[a-z]{4,}/g) || []);
  const scored = CORPUS.map((s) => ({ s, hits: (s.text.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => words.has(w)).length }));
  const ranked = scored.sort((a, b) => b.hits - a.hits).map((x) => x.s);
  return ranked.slice(0, k);
};

// ── 1) ESSAY — text organ, driven by the real echo backend ────────────────────
const runEssay = async () => {
  rule('1) "write an essay about the sea"  — text organ, real model interface (echo)');
  const model = createModel('echo');
  await model.load?.(() => {});

  const spec = createTaskSpec({ request: 'write an essay about the sea' });
  console.log(`spec: ${spec.kind} · organ=${spec.organ} · ${spec.extent} ${spec.unit} · ${spec.sections.length} sections\n`);

  const res = await runArtifact({
    request: 'write an essay about the sea',
    // the TEXT generator: a genuine grounded model call per leaf, honoring the leaf budget
    generate: async (view) => {
      const spans = retrieveFor(view.goal, view.contextSpans);
      const messages = buildGroundedMessages({ question: view.goal, spans, task: 'answer' });
      const output = await model.phrase(messages, { maxTokens: view.maxTokens });
      return { output, sources: spans.map((s) => s.idx) };
    },
    onUpdate: (graph, ev) => { if (ev?.type === 'complete') process.stdout.write('● '); },
  });

  console.log('\n\n--- assembled essay ---\n');
  res.graph.root.children.forEach((sec) => {
    console.log(`## ${sec.goal}\n${sec.output}\n`);
  });
  console.log(`progress: ${res.progress.done}/${res.progress.total} leaves · sources cited: [${res.sources.join(', ')}] · incoherent: ${res.incoherent.length}`);
};

// ── 2) MELODY — music organ, a directive-reading generator ────────────────────
// A toy "composer": reads the NEUTRAL directive (open/develop/close) and the beat
// budget, emits a note sequence. No model — the point is that the SAME runTaskGraph
// runs it, sized in beats, with the directive (not English) driving the notes.
const SCALE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const compose = (view) => {
  const beats = view.maxBeats || 8;
  const act = view.directive?.act || 'state';
  const start = { open: 0, develop: 2, close: 4 }[act] ?? 0;
  const dir = act === 'close' ? -1 : 1;                       // cadences fall, motifs rise
  const notes = [];
  for (let i = 0; i < beats; i++) notes.push(SCALE[((start + dir * i) % 7 + 7) % 7]);
  const tail = act === 'close' ? ' |]' : '';                  // a cadence bar-line
  return notes.join(' ') + tail;
};

const runMelody = async () => {
  rule('2) "write a melody about the sea"  — music organ, directive-driven composer');
  const spec = createTaskSpec({ request: 'write a melody about the sea' });
  console.log(`spec: ${spec.kind} · organ=${spec.organ} · ${spec.extent} ${spec.unit} · ${spec.sections.length} sections`);
  console.log('directives (neutral moves, no English in the template):');
  spec.sections.forEach((s) => console.log(`  • ${s.role}: { act: "${s.directive.act}" }  →  lowered: "${s.goal}"`));
  console.log();

  const res = await runArtifact({
    request: 'write a melody about the sea',
    organs: { music: (view) => compose(view) },
    onUpdate: (graph, ev) => { if (ev?.type === 'complete') process.stdout.write('♪ '); },
  });

  console.log('\n\n--- assembled melody (beats per phrase) ---\n');
  res.graph.root.children.forEach((sec) => {
    console.log(`${sec.goal.padEnd(48)}  ${sec.output}`);
  });
  console.log(`\nprogress: ${res.progress.done}/${res.progress.total} phrases · unit=${res.spec.unit} · incoherent: ${res.incoherent.length}`);
};

// ── 3) LONG MELODY — the budget-driven split, in beats ────────────────────────
const runLongMelody = async () => {
  rule('3) "write a long melody about the sea"  — a phrase overflows 16 beats → nests');
  const res = await runArtifact({
    request: 'write a long melody about the sea',
    organs: { music: (view) => compose(view) },
  });
  const show = (n, d = 0) => {
    const pad = '  '.repeat(d);
    if (n.children?.length) { console.log(`${pad}${n.goal || 'ROOT'}  [${n.object}]`); n.children.forEach((c) => show(c, d + 1)); }
    else console.log(`${pad}${n.goal}  →  ${n.output}`);
  };
  show(res.graph.root);
  console.log(`\nleaves: ${res.progress.total} · incoherent: ${res.incoherent.length} (0 = every overflow split, not jammed)`);
};

await runEssay();
await runMelody();
await runLongMelody();
console.log('\nend-to-end: text via the real model interface, music via the same runTaskGraph — one task language, two organs.\n');
