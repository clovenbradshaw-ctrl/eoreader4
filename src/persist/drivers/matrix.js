// The Matrix driver — an OPTIONAL backend. eoreader4 does not need a homeserver;
// the local IndexedDB driver is the default. But when you *want* a reading to
// sync across devices or be shared with a colleague, a Matrix room is the
// transport: the same corpus, folded from an encrypted room the server cannot
// read — this is amino's whole substrate ("rooms are tables, the server stores
// only ciphertext it cannot read"), exposed here behind the same four-op driver
// contract as memory.js and idb.js.
//
// To stay honest about dependencies this driver talks to a MINIMAL client
// contract, not matrix-js-sdk directly:
//
//   client.getState(roomId, type, stateKey) → Promise<object | null>
//   client.setState(roomId, type, stateKey, content) → Promise<void>
//
// Pass a real matrix-js-sdk client through fromMatrixClient() (below), a fake
// through the raw shape (tests do), or amino's MatrixLive with a thin shim.
//
// Each driver key becomes one room state event of `type` (default
// 'com.eoreader.corpus') whose state_key is the sanitized key; the string value
// rides in content.value. Matrix has no true state deletion, so a `__index__`
// state event holds the live key set and is the source of truth for keys() —
// a deleted key is dropped from the index and its event blanked.
//
// Caveat: a Matrix state event caps at ~64 KB. Large event logs should be
// sharded or moved to the media path (as amino's blocks.js does); this driver
// is the simple, correct baseline for modest corpora and the interface seam the
// richer transport can slot behind later.

const INDEX_KEY = '__index__';

// Matrix state keys are permissive but let's keep them tame and reversible-ish.
const enc = (key) => encodeURIComponent(key);

export function matrixDriver(client, { roomId, type = 'com.eoreader.corpus' } = {}) {
  if (!client || typeof client.getState !== 'function' || typeof client.setState !== 'function') {
    throw new Error('matrixDriver: client must implement getState(roomId,type,stateKey) and setState(...)');
  }
  if (!roomId) throw new Error('matrixDriver: roomId is required');

  const readIndex = async () => {
    const c = await client.getState(roomId, type, INDEX_KEY);
    return Array.isArray(c?.keys) ? c.keys.slice() : [];
  };
  const writeIndex = (keys) => client.setState(roomId, type, INDEX_KEY, { keys });

  return {
    kind: 'matrix',
    async get(key) {
      const c = await client.getState(roomId, type, enc(key));
      return c && typeof c.value === 'string' ? c.value : undefined;
    },
    async set(key, value) {
      await client.setState(roomId, type, enc(key), { value: String(value) });
      const keys = await readIndex();
      if (!keys.includes(key)) { keys.push(key); await writeIndex(keys); }
    },
    async delete(key) {
      await client.setState(roomId, type, enc(key), {});   // blank the event (Matrix has no true delete)
      const keys = (await readIndex()).filter((k) => k !== key);
      await writeIndex(keys);
    },
    async keys() { return readIndex(); },
  };
}

// Adapt a real matrix-js-sdk client (amino's MatrixLive uses the same SDK) to
// the minimal contract above. getStateEvent throws on a missing event, which we
// normalise to null; sendStateEvent takes (roomId, type, content, stateKey).
export function fromMatrixClient(sdkClient, roomId, opts) {
  const shim = {
    async getState(rid, type, stateKey) {
      try { return await sdkClient.getStateEvent(rid, type, stateKey); }
      catch { return null; }
    },
    async setState(rid, type, stateKey, content) {
      await sdkClient.sendStateEvent(rid, type, content, stateKey);
    },
  };
  return matrixDriver(shim, { roomId, ...opts });
}
