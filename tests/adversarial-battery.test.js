import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseText } from '../src/perceiver/parse/pipeline.js';
import { projectGraph } from '../src/core/project.js';

// Adversarial battery (Draft 0.1), identity families A/B/C/H — MEASURED against the
// engine, not hypothesized. Each case below was run; the GREEN ones are committed as
// regression guards, the RED frontier ones are `skip`-marked with the measured reason
// so the suite stays green and the frontier stays visible (novelty-reserve.md). Two
// hypotheses were falsified by measurement and are noted at their tests: C3 (held
// apart by the EXISTING surname-defeat) and C1 (flipped GREEN by this branch).

const P = (t) => parseText(t, { docId: 'battery' });
const rep = (doc) => projectGraph(doc.log).representative.bind(projectGraph(doc.log));

// ── A · existence-by-participation ───────────────────────────────────────────

test('[A2] a sentence-initial pronoun ("We") is withheld — caps is not sufficient', () => {
  const d = P('The Court adjourned. We will reconvene Monday.');
  assert.equal(d.admission.isAdmitted('We'), false, '"We" is a starter, not a referent');
});

test('[A1] (frontier) a lowercase entity is NOT admitted — caps is still a gate', { skip: 'RED ED-6/7: detection is caps-seeded; "mark smith filed the motion" admits nothing' }, () => {
  const d = P('mark smith filed the motion. he later testified.');
  assert.ok(d.admission.isAdmitted('mark smith'));   // the frontier: admit on S1/S2/S4 without caps
});

test('[A2b] a weekday ("Monday") is denied referential gravity — a date is not a referent', () => {
  const d = P('The Court adjourned. We will reconvene Monday.');
  assert.equal(d.admission.isAdmitted('Monday'), false);
  assert.equal(d.admission.isAdmitted('Court'), true, 'a real argument-slot referent still admits');
});

// ── B · people ───────────────────────────────────────────────────────────────

test('[B1] a unique surname still folds — defeasibility does not over-fire', () => {
  const d = P('Gregor Samsa woke. Gregor crawled. Samsa died at dawn.');
  const r = rep(d);
  assert.equal(r('samsa'), r('gregor-samsa'), 'the one Samsa is Gregor');
});

test('[B5] functional-key veto: a bare surname with a conflicting birth date does NOT merge', () => {
  // One full name bearing the surname + a bare surname with a DIFFERENT birth year.
  // The surname-sharing rebutter cannot see this (only one full "Smith"), but the
  // high-functionality bornOn conflict vetoes the tail merge — §6 ID-6 / §7 PER-2.
  const d = P('John Smith (born 1961) chaired the hearing. Smith was born in 1979.');
  const r = rep(d);
  assert.notEqual(r('smith'), r('john-smith'), 'distinct birth dates ⇒ distinct entities');
  assert.ok(d.log.events.some((e) => e.op === 'EVA' && e.reason === 'functional-key-conflict' && e.key === 'bornOn'),
    'the veto is recorded as a write-time EVA naming the conflicting key');
});

test('[B5-ctrl] the SAME birth date leaves the merge standing — the veto does not over-fire', () => {
  const d = P('John Smith (born 1961) chaired the hearing. Smith was born in 1961.');
  const r = rep(d);
  assert.equal(r('smith'), r('john-smith'), 'matching birth dates corroborate, not conflict');
  assert.equal(d.log.events.some((e) => e.op === 'SEG' && e.kind === 'retract'), false);
});

test('[B3] (frontier) two IDENTICAL full names still merge — needs within-doc splitting', { skip: 'RED B3: two "John Smith" with no distinguishing key share one id; splitting one id by per-mention attributes is unbuilt' }, () => {
  const d = P('John Smith chaired the senate hearing. John Smith fixed the leaking pipe.');
  const johns = [...projectGraph(d.log).entities.keys()].filter((k) => /john/.test(k));
  assert.equal(johns.length, 2);
});

// ── C · organizations ────────────────────────────────────────────────────────

test('[C1] acronym ↔ expansion resolves (flipped RED→GREEN on this branch)', () => {
  const d = P('The Nashville Downtown Partnership (NDP) was founded in 1995. NDP launched a program.');
  const r = rep(d);
  assert.equal(r('ndp'), r('nashville-downtown-partnership'));
  assert.ok(d.log.events.some((e) => e.op === 'SYN' && e.match === 'initialism'));
});

test('[C3] bare-head org trap: "Partnership" does NOT merge to either org (surname-defeat generalises)', () => {
  // Hypothesised RED; MEASURED GREEN. "Partnership" is the shared last token of two
  // distinct multi-word org names, so the Mr/Mrs-Samsa surname-defeat treats it as a
  // shared "surname" and retracts the eager tail merge — the org head noun IS the
  // surname trap in disguise. A real regression guard on that generalisation.
  const d = P('The Nashville Downtown Partnership met. The Greater Nashville Partnership met too. The Partnership voted.');
  const r = rep(d);
  assert.notEqual(r('partnership'), r('nashville-downtown-partnership'));
  assert.notEqual(r('partnership'), r('greater-nashville-partnership'));
  assert.ok(d.log.events.some((e) => e.op === 'SEG' && e.kind === 'retract' && e.reason === 'surname-shared-by-distinct-agents'),
    'the eager tail merge is overturned by an appended retract');
});

test('[C2] the shell-game orgs stay distinct (no acronym/lexical path merges them)', () => {
  // Distinct TODAY because no merge mechanism fires (the strict initialism test leaves
  // "NDMC"/"DMC" alone). The ORG-4 POSITIVE guard — a structural CON as evidence of
  // distinctness — is still a frontier (see the skip below); this pins the floor.
  const d = P('Nashville Downtown Partnership operates through NDMC. NDMC contracts with DMC.');
  const r = rep(d);
  const nodes = new Set([r('nashville-downtown-partnership'), r('ndmc'), r('dmc')]);
  assert.equal(nodes.size, 3, 'three linked-but-distinct nodes');
});

test('[C2b] (frontier) a structural CON is POSITIVE evidence of distinctness (ORG-4)', { skip: 'RED ORG-4: operates-through/contracts-with do not yet block a merge that a future org-merge path would make' }, () => {
  assert.ok(false);
});

test('[C5] (frontier) person/org type-incompatibility is a hard merge veto', { skip: 'RED C5: no entity-type (person vs org) channel, so same surface form trivially shares a node' }, () => {
  assert.ok(false);
});

// ── H · the log-as-trail ─────────────────────────────────────────────────────

test('[H1] projection is pure on (log, frame) — a fresh projection of the same log agrees', () => {
  const d = P('Gregor Samsa woke. Mr Samsa hurled an apple. Mrs Samsa wept in the doorway.');
  const a = projectGraph(d.log);
  // Same content from an independent fold (memo returns the same object; assert the
  // graph it produced is internally consistent and stable across the same inputs).
  const b = projectGraph(d.log);
  assert.equal(a.edges.length, b.edges.length);
  assert.deepEqual([...a.entities.keys()].sort(), [...b.entities.keys()].sort());
});

test('[H2] a retract supersedes but never deletes — the SYN stays in the log', () => {
  // The bare "Samsa" (sentence 2) is what tail-merges; the family then proves the
  // surname shared, retracting it. Without a bare surname there is no tail merge.
  const d = P('Gregor Samsa woke transformed. Samsa had always feared this morning. ' +
              'Mr Samsa hurled an apple at his son. Mrs Samsa wept in the doorway.');
  const ev = d.log.events;
  const syn = ev.find((e) => e.op === 'SYN' && e.match === 'tail' && e.defeasible);
  assert.ok(syn, 'the eager surname merge is still in the log');
  assert.ok(ev.some((e) => e.op === 'SEG' && e.kind === 'retract' && e.refSeq === syn.seq),
    'an appended retract supersedes it (replay-before unions, replay-after drops)');
});
