import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  composeEssay, planOutline, parseOutline, sectionMessages, countWords, ESSAY_MIN_WORDS,
} from '../src/organs/out/essay.js';
import { essay } from '../src/organs/out/index.js';

// A stub talker: it never sees a real model. The planner request (it carries the strict
// "TITLE:" system line) gets a small outline back; every other request is a section, answered
// with `wordsPerSection` words of filler. This makes the walk fully deterministic so we can
// assert the length floor is cleared and the walk terminates. `onToken` is exercised so the
// streaming contract is covered too.
const stubTalker = (wordsPerSection = 200) => {
  let calls = 0;
  const talker = async (messages, opts = {}) => {
    calls += 1;
    const sys = messages.find((m) => m.role === 'system')?.content || '';
    let text;
    if (/planning a long-form essay/i.test(sys)) {
      text = 'TITLE: On the Sea\n1. Introduction\n2. The tides\n3. The deep\n4. Conclusion';
    } else {
      text = Array.from({ length: wordsPerSection }, (_, i) => `word${i}`).join(' ') + '.';
    }
    if (typeof opts.onToken === 'function') for (const t of text.split(' ')) opts.onToken(t + ' ');
    return text;
  };
  talker.calls = () => calls;
  return talker;
};

test('parseOutline reads a strict planner reply', () => {
  const { title, headings } = parseOutline('TITLE: On the Sea\n1. The tides\n2. The deep\n3. Conclusion', 'the sea');
  assert.equal(title, 'On the Sea');
  assert.deepEqual(headings, ['The tides', 'The deep', 'Conclusion']);
});

test('planOutline pulls the conclusion out and backfills a thin plan', () => {
  const plan = planOutline('TITLE: X\n1. Intro\n2. Conclusion', 'topic x');
  assert.equal(plan.title, 'X');
  assert.equal(plan.conclusion, 'Conclusion');
  assert.ok(!plan.body.some((h) => /conclu/i.test(h)), 'conclusion is not left in the body');
  assert.ok(plan.body.length >= 4, 'a thin plan is padded from the neutral arc');
});

test('planOutline falls back to a full arc when the planner returns nothing', () => {
  const plan = planOutline('', 'dolphins');
  assert.equal(plan.title, 'Dolphins');
  assert.ok(plan.body.length >= 5, 'the default arc supplies a body');
  assert.equal(plan.conclusion, 'Conclusion');
});

test('sectionMessages marks the arc move (open / develop / land)', () => {
  const open = sectionMessages({ topic: 't', title: 'T', heading: 'Intro', role: 'open' });
  assert.match(open[1].content, /OPENING/);
  const land = sectionMessages({ topic: 't', title: 'T', heading: 'Conclusion', role: 'land' });
  assert.match(land[1].content, /CONCLUSION/);
});

test('composeEssay clears the ≥2500-word floor and lands on a conclusion', async () => {
  const talker = stubTalker(120);
  const res = await composeEssay({ topic: 'the sea', talker });
  assert.ok(res.words >= ESSAY_MIN_WORDS, `expected ≥${ESSAY_MIN_WORDS} words, got ${res.words}`);
  assert.equal(res.metWords, true);
  assert.equal(res.aborted, false);
  const last = res.sections[res.sections.length - 1];
  assert.equal(last.heading, 'Conclusion', 'the walk always lands on a conclusion');
  assert.equal(last.role, 'land');
  assert.match(res.text, /^# On the Sea/, 'the piece opens with the title as an h1');
});

test('composeEssay terminates on a stalled talker instead of looping to the cap', async () => {
  // A talker that returns nothing for sections: the stall guard must stop the walk.
  const deadTalker = async (messages) => {
    const sys = messages.find((m) => m.role === 'system')?.content || '';
    return /planning a long-form essay/i.test(sys) ? 'TITLE: Void\n1. Intro\n2. Conclusion' : '';
  };
  const res = await composeEssay({ topic: 'nothing', talker: deadTalker });
  assert.ok(res.sections.length <= 4, 'a dead talker does not drive the walk to the section cap');
  assert.equal(res.metWords, false);
});

test('composeEssay respects an abort signal', async () => {
  const ctl = new AbortController();
  let n = 0;
  const talker = async (messages, opts) => {
    const sys = messages.find((m) => m.role === 'system')?.content || '';
    if (/planning a long-form essay/i.test(sys)) return 'TITLE: A\n1. Intro\n2. Body\n3. Conclusion';
    if (++n === 1) ctl.abort();                 // abort after the first section
    return Array.from({ length: 100 }, (_, i) => `w${i}`).join(' ');
  };
  const res = await composeEssay({ topic: 'x', talker, signal: ctl.signal });
  assert.equal(res.aborted, true);
  assert.ok(res.words < ESSAY_MIN_WORDS, 'an aborted walk stops short of the floor');
});

test('the essay is emitted across many messages — one section beat at a time', async () => {
  const talker = stubTalker(200);
  const plans = [];
  const sectionEnds = [];
  const opens = [];
  const res = await composeEssay({
    topic: 'the sea',
    talker,
    hooks: {
      onPlan: (p) => plans.push(p),
      onSection: (s) => opens.push(s),
      onSectionEnd: (s) => sectionEnds.push(s),
    },
  });
  // The plan is announced exactly once, before any section.
  assert.equal(plans.length, 1);
  assert.ok(plans[0].title && Array.isArray(plans[0].outline));
  // Every section opens and closes; more than one message, and they pair up 1:1.
  assert.ok(sectionEnds.length > 1, 'the essay spans multiple section messages');
  assert.equal(opens.length, sectionEnds.length, 'each opened section is closed');
  assert.equal(sectionEnds.length, res.sections.length);
  // onSectionEnd carries a running total that climbs monotonically toward the floor.
  for (let i = 1; i < sectionEnds.length; i++) {
    assert.ok(sectionEnds[i].total >= sectionEnds[i - 1].total, 'the running total only grows');
  }
  // The per-message texts concatenate to the sections in the assembled essay.
  assert.deepEqual(sectionEnds.map((s) => s.text), res.sections.map((s) => s.text));
});

test('a lens config is threaded into each section talker pass (not the plan)', async () => {
  const seen = [];
  const lens = { relevance: 'sea', enabled: true };
  const talker = async (messages, opts = {}) => {
    const sys = messages.find((m) => m.role === 'system')?.content || '';
    const isPlan = /planning a long-form essay/i.test(sys);
    seen.push({ isPlan, lens: opts.lens || null });
    return isPlan ? 'TITLE: Sea\n1. Intro\n2. Conclusion' : Array.from({ length: 200 }, (_, i) => `w${i}`).join(' ');
  };
  await composeEssay({ topic: 'the sea', talker, lens });
  const planCall = seen.find((c) => c.isPlan);
  const sectionCalls = seen.filter((c) => !c.isPlan);
  assert.equal(planCall.lens, null, 'the planning pass is left unsteered');
  assert.ok(sectionCalls.length > 0 && sectionCalls.every((c) => c.lens === lens), 'every section pass carries the lens');
});

test('the organ is re-exported as a namespace off organs/out', () => {
  assert.equal(typeof essay.composeEssay, 'function');
  assert.equal(essay.ESSAY_MIN_WORDS, ESSAY_MIN_WORDS);
});
