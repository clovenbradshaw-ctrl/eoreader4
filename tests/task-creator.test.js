import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runTaskGraph, FIGURE, PATTERN,
  LEAF_MAX_TOKENS,
  classifyArtifact, subjectOf, readLength,
  createTaskSpec, planArtifact, withBudgets, runArtifact,
  deriveSpecFromDefinition, createSpecLibrary, needsResearch, researchQuery,
  ARTIFACT_TEMPLATES,
} from '../src/tasks/index.js';

// ── classification — the kind read off the request, no model ──────────────────
test('classifyArtifact reads the artifact kind, falling back to answer', () => {
  assert.equal(classifyArtifact('write an essay about the moon'), 'essay');
  assert.equal(classifyArtifact('draft a report on Q3 sales'), 'report');
  assert.equal(classifyArtifact('write a short story about a fox'), 'story');
  assert.equal(classifyArtifact('write a review of the new phone'), 'review');
  assert.equal(classifyArtifact('compose a letter to the council'), 'letter');
  assert.equal(classifyArtifact('list the planets'), 'list');
  assert.equal(classifyArtifact('summarize the meeting'), 'summary');
  assert.equal(classifyArtifact('what is the capital of France?'), 'answer');
  assert.equal(classifyArtifact(''), 'answer');
});

test('subjectOf strips the imperative and the artifact framing', () => {
  assert.equal(subjectOf('write a short essay about climate change'), 'climate change');
  assert.equal(subjectOf('please draft a detailed report on renewable energy'), 'renewable energy');
  assert.equal(subjectOf('compose a letter to the mayor'), 'the mayor');
  // nothing clean to strip → the request stands rather than vanishing
  assert.equal(subjectOf('photosynthesis'), 'photosynthesis');
});

test('readLength scales the budget off the request size words', () => {
  assert.equal(readLength('write an essay').scale, 1);
  assert.equal(readLength('write a short essay').scale, 0.5);
  assert.ok(readLength('write a long essay').scale > 1);
  assert.equal(readLength('write a long essay').label, 'long');
});

// ── the creator — a request becomes a concrete, budgeted, grained spec ────────
test('createTaskSpec builds an essay shape with budgets that sum to the total', () => {
  const spec = createTaskSpec({ request: 'write an essay about the sea' });
  assert.equal(spec.kind, 'essay');
  assert.equal(spec.subject, 'the sea');
  assert.equal(spec.format, 'prose');
  // intro + 3 body + conclusion
  assert.equal(spec.sections.length, 5);
  assert.deepEqual(spec.sections.map((s) => s.role),
    ['introduction', 'body 1', 'body 2', 'body 3', 'conclusion']);
  // every normal-length essay section fits one reach → all Figure leaves
  assert.ok(spec.sections.every((s) => s.grain === FIGURE));
  // the budgets are within the total and floored, and roughly add up
  const sum = spec.sections.reduce((a, s) => a + s.tokens, 0);
  assert.ok(Math.abs(sum - spec.tokens) <= spec.sections.length, 'section budgets ≈ total');
  assert.ok(spec.sections.every((s) => s.tokens <= LEAF_MAX_TOKENS));
});

test('a long essay overflows the leaf ceiling, so body paragraphs become Pattern goals', () => {
  const spec = createTaskSpec({ request: 'write a long detailed essay about the sea' });
  const body = spec.sections.find((s) => s.role === 'body 1');
  assert.ok(spec.tokens > 700, 'length scaled the total up');
  assert.equal(body.grain, PATTERN, 'a body paragraph now overflows one reach');
  assert.ok(body.tokens > LEAF_MAX_TOKENS);
});

test('an unrecognised artifact is the degenerate single-leaf plan', () => {
  const spec = createTaskSpec({ request: 'what is the capital of France?' });
  assert.equal(spec.kind, 'answer');
  assert.equal(spec.sections.length, 1);
  assert.equal(spec.sections[0].grain, FIGURE);
});

// ── planArtifact — the decompose face the runner consumes ─────────────────────
test('planArtifact.decompose unravels the root into the spec sections', () => {
  const plan = planArtifact({ request: 'write an essay about bees' });
  const subs = plan.decompose({ goal: plan.goal, depth: 0 });
  assert.equal(subs.length, 5);
  assert.ok(subs.every((s) => s.grain === FIGURE));
  // a Figure section is a leaf (no further split)
  assert.deepEqual(plan.decompose({ goal: subs[0].goal, depth: 1 }), []);
});

test('planArtifact.decompose splits a Pattern section into leaf-sized parts', () => {
  const plan = planArtifact({ request: 'write a comprehensive essay about bees' });
  plan.decompose({ goal: plan.goal, depth: 0 });            // register the sections
  const body = plan.spec.sections.find((s) => s.role === 'body 1');
  const parts = plan.decompose({ goal: body.goal, depth: 1 });  // goals are resolved strings
  assert.ok(parts.length >= 2, 'an overflowing section splits');
  // each part is registered and budgeted to fit one reach
  for (const p of parts) {
    const sec = plan.budgetFor(p.goal);
    assert.ok(sec, 'the part is registered for budget lookup');
    assert.ok(sec.tokens <= LEAF_MAX_TOKENS, 'each part fits a small-model reach');
    assert.equal(p.grain, FIGURE);
  }
});

// ── withBudgets — every leaf is handed its small-model contract ───────────────
test('withBudgets hands each leaf its maxTokens, role and format', () => {
  const plan = planArtifact({ request: 'write an essay about owls' });
  const subs = plan.decompose({ goal: plan.goal, depth: 0 });
  const captured = [];
  const gen = withBudgets(plan, (view) => { captured.push(view); return view.goal; });
  gen({ goal: subs[1].goal, depth: 1 });
  const v = captured[0];
  assert.equal(v.role, 'body 1');
  assert.equal(v.format, 'prose');
  assert.ok(v.maxTokens > 0 && v.maxTokens <= LEAF_MAX_TOKENS);
  assert.ok(v.contextSpans >= 3);
  assert.equal(v.spec.kind, 'essay');
});

// ── end-to-end through the real runner ────────────────────────────────────────
test('runArtifact builds an essay graph and generates each section once, within budget', async () => {
  const seen = [];
  const res = await runArtifact({
    request: 'write an essay about the sea',
    // a stub small model: echo the role and assert it was handed a real budget
    generate: (view) => {
      seen.push({ role: view.role, maxTokens: view.maxTokens });
      assert.ok(view.maxTokens > 0, 'each leaf carries an output ceiling');
      return `[${view.role}]`;
    },
  });
  assert.deepEqual(seen.map((s) => s.role),
    ['introduction', 'body 1', 'body 2', 'body 3', 'conclusion'], 'depth-first section order');
  assert.equal(res.spec.kind, 'essay');
  assert.equal(res.progress.total, 5);
  assert.equal(res.progress.done, 5);
  assert.equal(res.incoherent.length, 0, 'budgets match grains → no confab flags');
  assert.match(res.output, /\[introduction\][\s\S]*\[conclusion\]/);
});

test('a long-essay run nests a body paragraph and stays coherent', async () => {
  const res = await runArtifact({
    request: 'write a comprehensive essay about the sea',
    generate: (view) => `[${view.role}]`,
  });
  // the deepest leaf sits below its overflowing parent (nesting really happened)
  const depths = [];
  const walk = (n) => { if (n.children?.length) n.children.forEach(walk); else depths.push(n.depth); };
  walk(res.graph.root);
  assert.ok(Math.max(...depths) >= 2, 'a Pattern section split one level deeper');
  assert.equal(res.incoherent.length, 0, 'a section that overflowed was split, not jammed');
});

// ── the learned / web definition path ─────────────────────────────────────────
test('needsResearch is true only when no shape covers the kind', () => {
  assert.equal(needsResearch('essay'), false, 'a built-in covers it');
  assert.equal(needsResearch('haiku'), true, 'no built-in, no learned → propose research');
  assert.match(researchQuery('haiku'), /haiku/);
});

test('deriveSpecFromDefinition parses section roles from a fetched definition', () => {
  const definition = `A good essay has these parts:
1. Introduction — the hook and the thesis
2. Body paragraphs — each develops one point with evidence
3. Conclusion — restate the thesis and close`;
  const tmpl = deriveSpecFromDefinition('essay', definition);
  assert.ok(tmpl, 'a usable shape was derived');
  const roles = tmpl.sections.map((s) => s.role);
  assert.ok(roles.includes('introduction'));
  assert.ok(roles.includes('conclusion'));
  assert.equal(tmpl.source, 'learned');
});

test('deriveSpecFromDefinition returns null on unusable text (built-in stands)', () => {
  assert.equal(deriveSpecFromDefinition('essay', ''), null);
  assert.equal(deriveSpecFromDefinition('essay', 'just some prose with no structure named at all here'), null);
});

test('the library prefers a learned shape and guides the next request', () => {
  const lib = createSpecLibrary();
  assert.equal(lib.learned('essay'), null, 'nothing learned yet');
  assert.ok(lib.get('essay'), 'falls back to the built-in');

  const definition = `Sections:\n- Background\n- Analysis\n- Recommendation`;
  const learned = lib.defineFromDefinition('report', definition);
  assert.ok(learned, 'derived and stored');

  const spec = createTaskSpec({ request: 'write a report on water use', library: lib });
  assert.equal(spec.source, 'learned', 'the learned shape governs');
  assert.deepEqual(spec.sections.map((s) => s.role), ['background', 'analysis', 'recommendation']);
});

test('a hand-defined shape runs through the graph end-to-end', async () => {
  const lib = createSpecLibrary();
  lib.define('haiku', {
    format: 'prose', tokens: 120, note: 'three lines',
    sections: [
      { role: 'line 1', share: 1, goal: (s) => `Write the first line of a haiku about ${s}.` },
      { role: 'line 2', share: 1, goal: (s) => `Write the second line of a haiku about ${s}.` },
      { role: 'line 3', share: 1, goal: (s) => `Write the third line of a haiku about ${s}.` },
    ],
  });
  assert.equal(needsResearch('haiku', lib), false, 'now covered');
  const res = await runArtifact({
    request: 'write a haiku about rain', library: lib,
    generate: (view) => `[${view.role}]`,
  });
  assert.equal(res.progress.total, 3);
  assert.equal(res.spec.kind, 'haiku');
});

// ── grounding the claim: the degenerate plan is one generation ────────────────
test('runArtifact on a bare answer is byte-identical to one generate call', async () => {
  let calls = 0;
  const res = await runArtifact({
    request: 'what is the capital of France?',
    generate: () => { calls += 1; return 'Paris.'; },
    runner: runTaskGraph,
  });
  assert.equal(calls, 1, 'one leaf, one generation');
  assert.equal(res.output, 'Paris.');
  assert.equal(res.graph.root.children.length, 0, 'no nesting — the root is the leaf');
});

// a touch of sanity over the shipped templates
test('every built-in template has ordered sections with positive shares', () => {
  for (const [kind, t] of Object.entries(ARTIFACT_TEMPLATES)) {
    assert.ok(t.sections.length >= 1, `${kind} has sections`);
    assert.ok(t.sections.every((s) => (s.share ?? 1) > 0), `${kind} shares are positive`);
    assert.ok(typeof t.tokens === 'number' && t.tokens > 0, `${kind} has a token total`);
  }
});
