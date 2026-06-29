import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyTurn, dialogueState, resolveQuery, isReferentialStall, OP }
  from '../src/converse/dialogue-state.js';

// These lock in the EO-operator reading of the audit conversation that drifted:
//   t1  who is the mayor of nashville?              EVA  → answered (common ground)
//   t2  what do you mean first round?               NUL  (confusion on the prior answer)
//   t3  how has he been criticized for surveillance EVA  with an open CON ("he") → answered
//                                                        with an ABSENCE, so it stays OPEN
//   t4  find what i'm talking about                 NUL  pure stall → resolves to t3, NOT songs

test('classifyTurn reads each turn as one operator', () => {
  assert.equal(classifyTurn('who is the mayor of nashville?').op, OP.EVA);
  assert.equal(classifyTurn('what do you mean first round?').op, OP.NUL); // confusion on prior
  // a standalone topic that leads with an unbound pronoun is an EVA with an open CON
  const t3 = classifyTurn('how has he been criticized for surveillance expansion?');
  assert.equal(t3.op, OP.EVA);
  assert.equal(t3.needsReferent, true, '"he" points back into the cast');
  assert.deepEqual(t3.topic, ['criticized', 'surveillance', 'expansion']);
  // the turn that killed the conversation: a pure deictic stall, no Figure of its own
  assert.equal(classifyTurn('find what i\'m talking about').op, OP.NUL);
});

test('isReferentialStall: a turn whose only content is reference verbs + deictics', () => {
  assert.equal(isReferentialStall('find what i\'m talking about'), true);
  assert.equal(isReferentialStall('show me that'), true);
  assert.equal(isReferentialStall('you know what i mean'), true);
  // a turn with a real topic noun is NOT a stall, even with a reference verb
  assert.equal(isReferentialStall('find the surveillance report'), false);
  assert.equal(isReferentialStall('what is gregor\'s job?'), false);
});

test('classifyTurn: corrections re-split (SEG), attribute-pronoun is SIG', () => {
  assert.equal(classifyTurn('no, the musician').op, OP.SEG);
  assert.equal(classifyTurn('what is his name?').op, OP.SIG);
  assert.equal(classifyTurn('prove it').op, OP.NUL);
});

test('open intent stays open when the system answer is an ABSENCE', () => {
  const history = [
    { role: 'user',      content: 'who is the mayor of nashville?' },
    { role: 'assistant', content: 'The current mayor of Nashville is Freddie O\'Connell.' },
    { role: 'user',      content: 'how has he been criticized for surveillance expansion?' },
    { role: 'assistant', content: 'I couldn\'t find any information from the reading that addresses this.' },
  ];
  const st = dialogueState(history, 'find what i\'m talking about');
  // the mayor question was answered → common ground; the surveillance question was an
  // absence → it is the live OPEN intent
  assert.ok(st.commonGround.some(i => i.topic.includes('mayor')), 'mayor identity is settled');
  assert.ok(st.openIntents.some(i => i.topic.includes('surveillance')), 'surveillance stays open');
  assert.equal(st.openIntents[st.openIntents.length - 1].topic.includes('surveillance'), true);
});

test('a NUL stall resolves to the open intent, not its own deictic words', () => {
  const history = [
    { role: 'user',      content: 'who is the mayor of nashville?' },
    { role: 'assistant', content: 'The current mayor of Nashville is Freddie O\'Connell.' },
    { role: 'user',      content: 'how has he been criticized for surveillance expansion?' },
    { role: 'assistant', content: 'I couldn\'t find any information from the reading.' },
  ];
  const q = resolveQuery('find what i\'m talking about', history);
  // the bug was: "find what i'm talking about" retrieved on find/talking → "Find a Song by
  // Lyrics". The fix carries the open surveillance intent into the query instead.
  assert.match(q, /surveillance/, 'the stall is resolved to the open intent');
  assert.doesNotMatch(q.replace(/find what i'm talking about/i, ''), /\bsong\b/i);
});

test('a self-standing question passes through; an unbound pronoun is anchored', () => {
  // no history, fully self-contained → untouched (never pollute a strong query)
  assert.equal(resolveQuery('who is the mayor of nashville?', []), 'who is the mayor of nashville?');
  // with a warm referent, the pronoun turn keeps its topic AND gains an anchor
  const history = [
    { role: 'user',      content: 'who is the mayor of nashville?' },
    { role: 'assistant', content: 'The current mayor of Nashville is Freddie O\'Connell.' },
  ];
  const q = resolveQuery('how has he been criticized for surveillance expansion?', history);
  assert.match(q, /surveillance/, 'keeps its own topic');
  assert.ok(q.length > 'how has he been criticized for surveillance expansion?'.length,
    'gains a conversational anchor for the dangling "he"');
});
