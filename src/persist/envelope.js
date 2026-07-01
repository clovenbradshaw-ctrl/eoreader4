// At-rest encryption envelope — optional, off by default.
//
// A tiny, dependency-free AES-GCM + PBKDF2 core, distilled from amino's
// src/crypto/envelope.js (the "database E2EE" primitive). It is deliberately
// free of any Matrix, DOM, or app dependency so it can be reasoned about and
// unit-tested in isolation — it runs on the standard WebCrypto API present in
// both browsers and Node ≥ 20 (globalThis.crypto.subtle).
//
// An envelope is the store's seam for confidentiality: { seal(str) → str,
// open(str) → str }. The corpus store calls seal() before handing a record to
// a driver and open() after reading one back, so the driver — local IndexedDB,
// a Matrix room, anything — only ever holds ciphertext it cannot read. The
// default is plainEnvelope(): identity, no crypto, so persistence works with
// zero configuration and you opt into encryption by passing a passwordEnvelope.
//
// Blob layout matches amino/vault: [salt(16)][iv(12)][ciphertext+tag], base64'd,
// with a short version tag so a plaintext record and a sealed one never collide.

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const SEAL_TAG = 'eoenc:1:';   // marks a sealed string; absence ⇒ plaintext

const subtle = globalThis.crypto?.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

// base64 helpers — binary-safe, no spread on large arrays.
function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, saltBytes, iterations = PBKDF2_ITERATIONS) {
  const material = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// The no-op envelope: persistence works out of the box, records stored as-is.
export function plainEnvelope() {
  return {
    encrypted: false,
    async seal(plaintext) { return String(plaintext); },
    async open(stored) { return String(stored); },
  };
}

// The password envelope: every record is AES-GCM sealed under a key derived
// from `password` (PBKDF2, per-seal random salt + iv). Nothing but the password
// recovers it — there is no key stored anywhere, matching amino's "no API keys
// to leak" model. `open()` transparently passes through any string that was not
// sealed by this module, so turning encryption on for a store that already holds
// plaintext records does not brick them (they seal on next write).
export function passwordEnvelope(password, { iterations = PBKDF2_ITERATIONS } = {}) {
  if (!subtle) throw new Error('passwordEnvelope: WebCrypto (crypto.subtle) unavailable');
  if (!password) throw new Error('passwordEnvelope: a non-empty password is required');
  return {
    encrypted: true,
    async seal(plaintext) {
      const salt = randomBytes(SALT_BYTES);
      const iv = randomBytes(IV_BYTES);
      const key = await deriveKey(password, salt, iterations);
      const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(String(plaintext))));
      const blob = new Uint8Array(salt.length + iv.length + ct.length);
      blob.set(salt, 0);
      blob.set(iv, salt.length);
      blob.set(ct, salt.length + iv.length);
      return SEAL_TAG + b64(blob);
    },
    async open(stored) {
      const s = String(stored);
      if (!s.startsWith(SEAL_TAG)) return s;   // legacy/plaintext record — pass through
      const blob = unb64(s.slice(SEAL_TAG.length));
      const salt = blob.subarray(0, SALT_BYTES);
      const iv = blob.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
      const ct = blob.subarray(SALT_BYTES + IV_BYTES);
      const key = await deriveKey(password, salt, iterations);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      return decoder.decode(pt);
    },
  };
}

export const isSealed = (s) => typeof s === 'string' && s.startsWith(SEAL_TAG);
