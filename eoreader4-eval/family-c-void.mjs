// Family C — void detection / abstention — run end-to-end against the real pipeline.
// Deterministic: echo model + hash embedder. Measures the `answerable` stage's void
// verdict (precision / recall / over-abstention) on real runTurn output.
import { parseText } from '../src/perceiver/parse/pipeline.js';
import { runTurn } from '../src/turn/pipeline.js';
import { createAuditLog } from '../src/audit/index.js';
import { createHashEmbedder } from '../src/model/embed-hash.js';
import '../src/model/echo.js';
import { createModel } from '../src/model/interface.js';

const setup = (text, docId) => {
  const doc = parseText(text, { docId });
  let p = null;
  doc.sentenceEmbeddings = async (e) => {
    if (p) return p;
    p = Promise.all(doc.sentences.map(s => e.embed(s)));
    return p;
  };
  return doc;
};

// Two domain-style documents (surveillance / OHS-NDP beat, per spec §1.A.2).
const DOCS = {
  surveil: `The Halifax Regional Police deployed automated licence-plate readers at four intersections in March.
The devices scan every passing vehicle and store the plate, time, and location for ninety days.
Councillor Mara Singh requested the retention policy in writing but received no reply for six weeks.
A spokesperson said the readers had flagged eleven stolen vehicles since the program began.
The Nova Scotia Information and Privacy Commissioner opened a review of the retention period in May.
No municipal bylaw currently governs how long the plate data may be kept.`,
  ohs: `WorkSafe NB issued a stop-work order at the Saint John refinery on Tuesday after a scaffold collapse.
Two contractors were treated for fractures and released the same day.
The order halts all elevated work on the north unit until the scaffolding is re-certified.
The refinery operator, Irving Oil, said it was cooperating with inspectors.
The NDP labour critic called for a public inquiry into repeated incidents at the site.
The last stop-work order at the refinery was issued in 2019.`,
};

// expected: 'void' = answer is absent from the doc; 'answer' = present.
// near = a hard near-miss (answer is near but not in the source) — tracked separately.
const CASES = [
  // --- surveil: answerable ---
  { doc: 'surveil', q: 'How long is the plate data stored?', expected: 'answer' },
  { doc: 'surveil', q: 'Who requested the retention policy in writing?', expected: 'answer' },
  { doc: 'surveil', q: 'How many stolen vehicles were flagged?', expected: 'answer' },
  { doc: 'surveil', q: 'Who opened a review of the retention period?', expected: 'answer' },
  // --- surveil: void ---
  { doc: 'surveil', q: 'How much did the licence-plate readers cost?', expected: 'void' },
  { doc: 'surveil', q: 'What did Premier Houston say about the readers?', expected: 'void', near: true },
  { doc: 'surveil', q: 'Were any privacy lawsuits filed against the police?', expected: 'void' },
  { doc: 'surveil', q: 'What is the population of Halifax?', expected: 'void' },
  // --- ohs: answerable ---
  { doc: 'ohs', q: 'Why was the stop-work order issued?', expected: 'answer' },
  { doc: 'ohs', q: 'Who is the refinery operator?', expected: 'answer' },
  { doc: 'ohs', q: 'How many contractors were injured?', expected: 'answer' },
  { doc: 'ohs', q: 'What did the NDP labour critic call for?', expected: 'answer' },
  // --- ohs: void ---
  { doc: 'ohs', q: 'How long will the refinery be shut down entirely?', expected: 'void', near: true },
  { doc: 'ohs', q: 'What caused the scaffold to collapse?', expected: 'void', near: true },
  { doc: 'ohs', q: 'How much was Irving Oil fined?', expected: 'void' },
  { doc: 'ohs', q: 'What time did the collapse happen?', expected: 'void' },
];

const isVoid = (turn) => {
  const step = turn.steps.find(s => s.name === 'answerable');
  return !!(step && step.data && step.data.terrain === 'void');
};

const run = async () => {
  const model = createModel('echo');
  await model.load();
  const embedder = createHashEmbedder();
  const docs = Object.fromEntries(Object.entries(DOCS).map(([k, t]) => [k, setup(t, k)]));

  const rows = [];
  for (const c of CASES) {
    const audit = createAuditLog();
    const result = await runTurn({ question: c.q, doc: docs[c.doc], model, embedder, auditLog: audit });
    const predictedVoid = isVoid(result.turn);
    const kind = result.turn.steps.find(s => s.name === 'answerable')?.data?.kind || '';
    const ret = result.turn.steps.find(s => s.name === 'retrieve')?.data || {};
    const flags = (result.flags || []).map(f => f.id);
    rows.push({ ...c, predictedVoid, kind, route: result.route,
                spans: ret.n || 0, top: +(ret.top || 0).toFixed(2), flags });
  }

  // Confusion matrix on the void class.
  const goldVoid = rows.filter(r => r.expected === 'void');
  const goldAns  = rows.filter(r => r.expected === 'answer');
  const tp = goldVoid.filter(r => r.predictedVoid).length;   // void correctly caught
  const fn = goldVoid.filter(r => !r.predictedVoid).length;  // void missed (FM2 risk)
  const fp = goldAns.filter(r => r.predictedVoid).length;    // over-abstention (FM4)
  const tn = goldAns.filter(r => !r.predictedVoid).length;

  const voidRecall    = tp / (tp + fn || 1);
  const voidPrecision = tp / (tp + fp || 1);
  const overAbstention = fp / (fp + tn || 1);

  console.log('\n=== per-case (answerable verdict + downstream net) ===');
  for (const r of rows) {
    const ok = (r.expected === 'void') === r.predictedVoid ? '✓' : '✗';
    const downstream = r.flags.length ? `flags=[${r.flags.join(',')}]` : 'flags=[]';
    console.log(`${ok} exp=${r.expected.padEnd(6)} pred=${r.predictedVoid ? 'void  ' : 'answer'} ${r.near ? '[near]' : '      '} spans=${r.spans} top=${r.top} ${downstream}  | ${r.q}`);
  }

  // Did the DOWNSTREAM net (vetoes) flag the voids that `answerable` let through?
  const netCaught = (r) => r.predictedVoid || r.flags.length > 0;
  const voidsNetCaught = goldVoid.filter(netCaught).length;
  const ansFalseFlagged = goldAns.filter(r => r.flags.length > 0).length;

  console.log('\n=== family C scorecard (void detector) ===');
  console.log(`cases: ${rows.length}  (gold void ${goldVoid.length}, gold answerable ${goldAns.length})`);
  console.log(`confusion: tp=${tp} fn=${fn} fp=${fp} tn=${tn}`);
  console.log(`void recall      ${voidRecall.toFixed(3)}   (target >= 0.90)  ${voidRecall >= 0.90 ? 'PASS' : 'FAIL'}`);
  console.log(`void precision   ${voidPrecision.toFixed(3)}   (target >= 0.75)  ${voidPrecision >= 0.75 ? 'PASS' : 'FAIL'}`);
  console.log(`over-abstention  ${overAbstention.toFixed(3)}   (target <= 0.15)  ${overAbstention <= 0.15 ? 'PASS' : 'FAIL'}`);
  const nearMissed = goldVoid.filter(r => r.near && !r.predictedVoid);
  console.log(`near-miss voids caught: ${goldVoid.filter(r=>r.near).length - nearMissed.length}/${goldVoid.filter(r=>r.near).length}`);
  console.log('\n=== end-to-end abstention net (answerable OR any veto flag) ===');
  console.log(`voids caught by the full net: ${voidsNetCaught}/${goldVoid.length}  (recall ${(voidsNetCaught/goldVoid.length).toFixed(3)})`);
  console.log(`answerable turns falsely flagged: ${ansFalseFlagged}/${goldAns.length}`);
  console.log('\nNOTE: FM2 (confabulation at a void) is NOT measured here — the echo');
  console.log('model cannot confabulate. FM2 requires a live generative model at `llm`.');
};

run().catch(e => { console.error(e); process.exit(1); });
