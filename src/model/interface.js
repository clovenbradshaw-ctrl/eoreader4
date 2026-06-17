// The model interface.
//
// A backend is a factory: createBackend(opts) → {
//   id, kind, isLoaded(),
//   load(onProgress) → Promise<void>,
//   phrase(messages, opts) → Promise<string>,
// }
//
// An embedder is a separate thing entirely:
//   { id, isWarm(), warm() → Promise, embed(text) → Promise<Float32Array> }
//
// The turn pipeline takes a model and an embedder by dependency injection.
// No turn code ever knows which backend it has.

const backends = new Map();

export const registerBackend = (name, factory) => {
  if (typeof factory !== 'function') {
    throw new TypeError(`registerBackend: factory must be a function`);
  }
  backends.set(name, factory);
};

export const availableBackends = () => [...backends.keys()];

export const createModel = (name, opts = {}) => {
  const factory = backends.get(name);
  if (!factory) throw new Error(`unknown backend: ${name}`);
  return factory(opts);
};
