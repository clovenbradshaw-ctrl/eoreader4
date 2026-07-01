// The persist holon: durable, optionally-encrypted memory for eoreader4's
// document corpus, over a pluggable backend. Local by default, Matrix optional.
//
//   import { openCorpusStore, attachPersistence, rehydrateLog } from './persist/index.js';
//
//   const store = await openCorpusStore();            // local IndexedDB (or memory)
//   attachPersistence(doc.log, store, { docId: doc.docId, modality: doc.modality,
//                                       name: doc.name, source: rawText });
//   // ...on next boot:
//   for (const entry of await store.list())
//     rehydrateLog(createLog, await store.get(entry.docId));  // chips reappear
//
// Nothing here needs a homeserver. To sync/share instead, pass a Matrix driver:
//
//   const store = createCorpusStore({
//     driver: fromMatrixClient(matrixClient, roomId),
//     envelope: passwordEnvelope(pw),          // optional at-rest encryption
//   });

export { createCorpusStore } from './store.js';
export { attachPersistence, rehydrateLog } from './attach.js';
export { plainEnvelope, passwordEnvelope, isSealed } from './envelope.js';
export { memoryDriver } from './drivers/memory.js';
export { idbDriver, idbAvailable } from './drivers/idb.js';
export { matrixDriver, fromMatrixClient } from './drivers/matrix.js';

import { createCorpusStore } from './store.js';
import { memoryDriver } from './drivers/memory.js';
import { idbDriver, idbAvailable } from './drivers/idb.js';
import { plainEnvelope } from './envelope.js';

// Convenience: pick the best LOCAL backend for the environment — IndexedDB in a
// browser, an in-memory Map in Node/tests/anywhere it is absent — and build a
// store. Pass an `envelope` (e.g. passwordEnvelope(pw)) to encrypt at rest; the
// default is plaintext so persistence works with zero configuration.
export async function openCorpusStore({ envelope, dbName, storeName, driver } = {}) {
  const back = driver ?? (idbAvailable()
    ? idbDriver({ dbName, storeName })
    : memoryDriver());
  return createCorpusStore({ driver: back, envelope: envelope ?? plainEnvelope() });
}
