// The memory driver — a Map behind the driver contract.
//
// The driver contract is the store's backend seam. Every backend — this Map,
// browser IndexedDB, a Matrix room — is just four async string ops:
//
//   get(key)    → string | undefined
//   set(key, v) → void
//   delete(key) → void
//   keys()      → string[]
//
// Values are always strings (JSON text, or an envelope's ciphertext), so a
// backend never needs to know the record shape or whether it is encrypted.
//
// This driver is the default fallback (used in Node, in tests, and in any
// browser without IndexedDB) and the reference implementation of the contract.

export function memoryDriver(seed) {
  const map = new Map(seed instanceof Map ? seed : undefined);
  return {
    kind: 'memory',
    async get(key) { return map.has(key) ? map.get(key) : undefined; },
    async set(key, value) { map.set(key, String(value)); },
    async delete(key) { map.delete(key); },
    async keys() { return [...map.keys()]; },
    // test/inspection affordance — not part of the contract
    _dump() { return new Map(map); },
  };
}
