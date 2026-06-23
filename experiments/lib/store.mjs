// Append-only helpers for the campaign's persistent artifacts. The archive is the population of
// pressures tried (each replayable from its seed-of-record); the ledger is one line per
// experiment. Both are JSONL so a run only ever appends — the same append-only discipline the
// engine's own log holds.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (name) => join(root, name);

export const appendArchive = (rec) => appendFileSync(path('archive.jsonl'), JSON.stringify(rec) + '\n');
export const appendLedger  = (rec) => appendFileSync(path('ledger.jsonl'),  JSON.stringify(rec) + '\n');

export const readJsonl = (name) =>
  existsSync(path(name))
    ? readFileSync(path(name), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

export const archive = () => readJsonl('archive.jsonl');
export const ledger  = () => readJsonl('ledger.jsonl');
