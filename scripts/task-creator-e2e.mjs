// End-to-end exercise of the task creator: open-vocabulary kinds, the internet as the
// brain (research → learn → persist to templates/), and the omnimodal output organs.
//
//   node scripts/task-creator-e2e.mjs
//
// Text leaves render through the real model interface (the echo backend, offline and
// deterministic). The "web" is a canned function here — the engine never touches the
// network itself; webSearch is injected (the repo's proposer-only discipline).

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runArtifact, createTaskSpec, createSpecLibrary, loadTemplatesDir, templatePersister } from '../src/tasks/index.js';
import { createModel, buildGroundedMessages } from '../src/model/index.js';

const rule = (t) => console.log('\n' + '═'.repeat(74) + `\n${t}\n` + '═'.repeat(74));

const CORPUS = [
  { idx: 0, text: 'The sea covers more than seventy percent of the planet’s surface.' },
  { idx: 1, text: 'Ocean currents redistribute heat and drive the world’s climate.' },
  { idx: 2, text: 'Tides rise and fall with the gravitational pull of the moon.' },
  { idx: 3, text: 'The deep sea remains the least explored region on Earth.' },
];
const retrieveFor = (goal, k) => CORPUS.slice(0, Math.max(2, k));

// A canned "web" — stands in for a real search. Returns a definition of the asked kind.
const FAKE_WEB = {
  sonnet: '1. First quatrain — introduce the theme\n2. Second quatrain — develop it\n3. Third quatrain — turn or complication\n4. Final couplet — resolve',
  'cover letter': 'Structure:\n- Greeting\n- Opening hook\n- Body: relevant experience\n- Closing call to action\n- Sign-off',
};
const makeWebSearch = (log) => async (query) => {
  const kind = Object.keys(FAKE_WEB).find((k) => query.toLowerCase().includes(k));
  log.push({ query, found: !!kind });
  return kind ? [{ text: FAKE_WEB[kind] }] : [];
};

const textModel = createModel('echo');
const textGen = async (view) => {
  const spans = retrieveFor(view.goal, view.contextSpans);
  const messages = buildGroundedMessages({ question: view.goal, spans, task: 'answer' });
  return { output: await textModel.phrase(messages, { maxTokens: view.maxTokens }), sources: spans.map((s) => s.idx) };
};
const showSections = (res) => res.graph.root.children.forEach((c) => console.log(`  ▸ ${c.goal}`));

const main = async () => {
  await textModel.load?.(() => {});
  const dir = await mkdtemp(join(tmpdir(), 'eo-templates-'));
  const webLog = [];
  // the library IS the machine's memory: seeded from the folder, persisting what it learns
  const library = createSpecLibrary({ seed: await loadTemplatesDir(dir), onLearn: templatePersister(dir) });
  const webSearch = makeWebSearch(webLog);

  // 1) an UNLEARNED kind, OFFLINE → the universal arc floor (no stored essay guide)
  rule('1) "write an essay about the sea"  — no webSearch → universal arc floor');
  const off = createTaskSpec({ request: 'write an essay about the sea' });
  console.log(`source=${off.source} · sections: ${off.sections.map((s) => s.role).join(' · ')}\n`);
  const r1 = await runArtifact({ request: 'write an essay about the sea', generate: textGen });
  showSections(r1);

  // 2) a kind it has NEVER seen → go learn how to make it well, then build it
  rule('2) "write a sonnet about the sea"  — unknown kind → research, learn, persist');
  const r2 = await runArtifact({ request: 'write a sonnet about the sea', library, webSearch, generate: textGen });
  console.log(`web queries: ${webLog.length} · learned source=${r2.spec.source}`);
  console.log(`learned structure: ${r2.spec.sections.map((s) => s.role).join(' · ')}`);
  await library.flush();
  console.log(`\nwrote ${dir}/sonnet.json:`);
  console.log(await readFile(join(dir, 'sonnet.json'), 'utf8'));

  // 3) ask AGAIN — now it's in the folder, no second search
  rule('3) "write a sonnet about spring"  — same kind → reused from templates/, no research');
  const before = webLog.length;
  const r3 = await runArtifact({ request: 'write a sonnet about spring', library, webSearch, generate: textGen });
  console.log(`web queries this time: ${webLog.length - before} (0 = reused) · source=${r3.spec.source}`);
  showSections(r3);

  // 4) a fresh process: a new library seeded from the folder already knows the kind
  rule('4) fresh library seeded from the folder — the learning survived');
  const reseeded = createSpecLibrary({ seed: await loadTemplatesDir(dir) });
  console.log(`installed kinds on disk: [${reseeded.kinds().join(', ')}]`);
  const r4 = createTaskSpec({ request: 'write a sonnet about loss', library: reseeded });
  console.log(`source=${r4.source} · sections: ${r4.sections.map((s) => s.role).join(' · ')}`);

  // 5) a NON-TEXT kind → the same flow, music organ (beats), arc floor offline
  rule('5) "write a melody about the sea"  — music organ, beats, arc floor');
  const r5 = await runArtifact({ request: 'write a melody about the sea', organs: { music: (v) => `♪[${v.role}|${v.maxBeats}b]♪` } });
  console.log(`organ=${r5.spec.organ} · unit=${r5.spec.unit}`);
  r5.graph.root.children.forEach((c) => console.log(`  ▸ ${c.goal.padEnd(54)} ${c.output || '[branch]'}`));

  console.log('\nthe internet is the brain: unknown kinds are learned once, written to templates/, and reused.\n');
};

await main();
