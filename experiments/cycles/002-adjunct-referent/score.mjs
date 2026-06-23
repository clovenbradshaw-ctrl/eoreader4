#!/usr/bin/env node
// BLIND scorer for cycle 002. Reads the key and the measurement; control first (every adjunct
// in the loud object slot must abstain), then the patient recall (no real bond lost).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(readFileSync(join(HERE, 'key.json'), 'utf8'));
const out = JSON.parse(readFileSync(join(HERE, 'out.json'), 'utf8'));
const PASS = (b) => (b ? 'PASS' : 'FAIL');

console.log('=== cycle 002 — a bond binds referents, not adjuncts (scored blind) ===\n');

let adjunctOK = true, patientOK = true, fieldOK = true;
for (const [id, expectBond] of Object.entries(key.expect_bond)) {
  const m = out[id], kind = key.kinds[id];
  const bondRight = m.bonded === expectBond;
  if (expectBond) patientOK = patientOK && bondRight;
  else { adjunctOK = adjunctOK && bondRight; fieldOK = fieldOK && !m.inField; }
  console.log(`  ${id} [${kind.padEnd(18)}] probe='${m.probe}'  bonded=${m.bonded} (want ${expectBond}) ${bondRight ? 'ok' : 'BUG'}${expectBond ? '' : `  inField=${m.inField}`}`);
}

console.log(`\nCONTROL (every adjunct in the loud object slot abstains): ${PASS(adjunctOK)}`);
console.log(`  ...and seeds no field atom: ${PASS(fieldOK)}`);
console.log(`RECALL (every patient still bonds — no loss): ${PASS(patientOK)}`);

const verdict = adjunctOK && patientOK && fieldOK;
console.log(`\nVERDICT: ${verdict ? 'CONFIRMED — adjuncts abstain, patients bond, the field is clean.' : 'NOT CONFIRMED'}`);
process.exit(verdict ? 0 : 1);
