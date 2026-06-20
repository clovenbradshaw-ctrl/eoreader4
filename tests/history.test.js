import { test } from 'node:test';
import assert from 'node:assert/strict';

import { foldConversation } from '../src/converse/index.js';
import { buildChatMessages } from '../src/model/prompt.js';

// docs/session-fold.md — the session fold reads the conversation and hands the talker
// the same two registers the document fold gives: the recent turns verbatim, and a
// surfed fold of everything older.

const pairs = (...topics) => topics.flatMap((t, i) => [
  { role: 'user',      content: `Tell me about ${t} and what it means for the family overall.` },
  { role: 'assistant', content: `Here is a detailed account of ${t}, drawing the relevant passages together.` },
]);

test('an empty history folds to an empty result', () => {
  const f = foldConversation([]);
  assert.deepEqual(f.pastTurns, []);
  assert.equal(f.notes, '');
  assert.deepEqual(f.stats, { recent: 0, folded: 0, notesLen: 0 });
});

test('a short session rides entirely verbatim — the fold engages only beyond the budget', () => {
  const hist = [
    { role: 'user', content: 'who is Gregor?' },
    { role: 'assistant', content: 'Gregor Samsa is a travelling salesman.' },
  ];
  const f = foldConversation(hist);
  assert.equal(f.stats.recent, 2, 'both turns ride verbatim');
  assert.equal(f.stats.folded, 0, 'nothing is folded');
  assert.equal(f.notes, '', 'no recap for a short session');
  assert.deepEqual(f.pastTurns, ['You: who is Gregor?', 'Me: Gregor Samsa is a travelling salesman.']);
  assert.equal(f.lastReply, 'Gregor Samsa is a travelling salesman.');
});

test('a long session folds older turns into a surfed recap, tagged with absolute index', () => {
  const long = [...pairs('the fire', 'the violin', 'the clerk', 'the apple', 'the boarders'),
                { role: 'user', content: 'who cleans the flat?' },
                { role: 'assistant', content: 'The charwoman cleans the flat.' }];
  const f = foldConversation(long, { budgetTokens: 80, minRecent: 2 });
  assert.ok(f.stats.folded > 0, 'older turns are folded');
  assert.ok(f.stats.recent >= 2, 'the recent window is kept verbatim');
  assert.match(f.notes, /#\d+ (You|Me):/, 'kept turns carry their absolute index for mechanical recall');
});

test('the recap keeps movers and folds away inert acks (mean separator, not fraction)', () => {
  // Substantive question turns interleaved with one-word acknowledgements.
  const long = [];
  for (const t of ['the fire', 'the violin', 'the clerk', 'the apple']) {
    long.push({ role: 'user', content: `What does ${t} reveal about the household and its slow collapse?` });
    long.push({ role: 'assistant', content: `A careful answer about ${t} that draws the passages together.` });
    long.push({ role: 'user', content: 'ok' });
    long.push({ role: 'assistant', content: 'Sure.' });
  }
  const f = foldConversation(long, { budgetTokens: 60, minRecent: 2 });
  assert.doesNotMatch(f.notes, /(You: ok|Me: Sure)/, 'a one-word ack adds no content and is folded away');
  assert.match(f.notes, /reveal about the household/, 'a substantive question is a mover and is kept');
});

test('the minRecent floor guarantees continuity even when one huge turn overflows the budget', () => {
  const huge = 'word '.repeat(2000);
  const f = foldConversation([
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'reply' },
    { role: 'user', content: huge },
  ], { budgetTokens: 10, minRecent: 2 });
  assert.ok(f.stats.recent >= 2, 'the floor keeps the window non-empty despite the overflow');
});

test('a maxNoteTurns cap keeps a long backlog from blowing the notes budget', () => {
  const many = pairs(...Array.from({ length: 40 }, (_, i) => `topic number ${i} with distinct vocabulary ${i}x`));
  const f = foldConversation(many, { budgetTokens: 40, minRecent: 2, maxNoteTurns: 5 });
  assert.ok(f.stats.folded <= 5, 'the strongest movers win the limited slots');
});

// THE SELF-FOLD ATOM — the prior turn welded to its EVA. (docs/grounding-floor.md)
//
// The self-model-defended failure was the talker reading its prior outputs back as
// authoritative `Me:` lines and anchoring on them. The fix is not to withhold the history
// (protect-by-absence) but to re-enter it as a JUDGED assertion: every read path that
// surfaces "I said X" must carry the floor's verdict on X in the same unit.

test('a judged Me: turn carries its verdict inline — no read path surfaces "I said X" bare', () => {
  const hist = [
    { role: 'user', content: 'who set the fire?' },
    { role: 'assistant', content: 'The landlord set the fire.', flags: [{ id: 'unbound', refuses: true }] },
  ];
  const f = foldConversation(hist);
  const me = f.pastTurns.find(t => t.startsWith('Me:'));
  assert.match(me, /^Me: \[read as unbound\] /, 'the Me: line is welded to the floor\'s verdict');
  assert.match(me, /landlord set the fire/, 'the content still rides — suppress the status, not the word');
});

test('an unjudged turn is unchanged — a verdict-free session reads exactly as before', () => {
  const hist = [
    { role: 'user', content: 'who is Gregor?' },
    { role: 'assistant', content: 'Gregor Samsa is a travelling salesman.' },   // no flags
  ];
  const f = foldConversation(hist);
  assert.deepEqual(f.pastTurns, ['You: who is Gregor?', 'Me: Gregor Samsa is a travelling salesman.']);
});

test('a verdict only ever tags the talker\'s OWN turn, never a You: line', () => {
  // A user message is not the engine\'s to judge; even were a flag attached, it is not read.
  const hist = [
    { role: 'user', content: 'tell me about the clerk', flags: [{ id: 'unbound' }] },
    { role: 'assistant', content: 'The clerk left early.', flags: [{ id: 'low-coverage' }] },
  ];
  const f = foldConversation(hist);
  const you = f.pastTurns.find(t => t.startsWith('You:'));
  const me  = f.pastTurns.find(t => t.startsWith('Me:'));
  assert.equal(you, 'You: tell me about the clerk', 'a You: line never carries a verdict');
  assert.match(me, /^Me: \[read as low-coverage\] /);
});

test('the folded recap also carries the verdict — the atom survives the fold, never bare', () => {
  // A long session pushes the judged turn into the surfed recap; its verdict must travel
  // with it. The judged turn is a mover (its verdict is content added), so it is kept.
  const long = [
    { role: 'user', content: 'What does the fire reveal about the household and its slow collapse?' },
    { role: 'assistant', content: 'The landlord set the fire to collect insurance money.',
      flags: [{ id: 'edge-contradicted', refuses: true }] },
    ...pairs('the violin', 'the clerk', 'the apple', 'the boarders'),
    { role: 'user', content: 'who cleans the flat?' },
    { role: 'assistant', content: 'The charwoman cleans the flat.' },
  ];
  const f = foldConversation(long, { budgetTokens: 80, minRecent: 2 });
  assert.match(f.notes, /\[read as edge-contradicted\]/,
    'the recap renders the prior reply with its verdict, not as a bare assertion');
});

// The two prompt paths: the chat (no-doc) path rides recentMessages as real
// {role,content} history and folds the recap into the system message.
test('the chat path rides the recent window as message history and the recap in the system message', () => {
  const long = [...pairs('the fire', 'the violin', 'the clerk', 'the apple', 'the boarders')];
  const f = foldConversation(long, { budgetTokens: 80, minRecent: 2 });
  const msgs = buildChatMessages({ question: 'and the ending?', history: f.recentMessages, notes: f.notes });
  assert.equal(msgs[0].role, 'system');
  if (f.notes) assert.match(msgs[0].content, /Notes about our conversation before this:/);
  // the recent verbatim window rides as turns, the live question last
  assert.ok(msgs.some(m => m.role === 'assistant'), 'prior turns ride as real message history');
  assert.equal(msgs[msgs.length - 1].content, 'and the ending?');
});
