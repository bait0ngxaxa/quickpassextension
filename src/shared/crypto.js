export const CRYPTO_ITERATIONS = 250000;
const KEY_LENGTH = 256;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const VERIFIER_TEXT = "quick-pass:verified";

export function generateSaltBase64() {
  return arrayBufferToBase64(crypto.getRandomValues(new Uint8Array(SALT_BYTES)).buffer);
}

export async function deriveKeyFromPassword(password, saltBase64, iterations = CRYPTO_ITERATIONS) {
  const passwordKeyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: base64ToUint8Array(saltBase64),
      iterations,
      hash: "SHA-256"
    },
    passwordKeyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plainText, key) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plainText)
  );

  return {
    cipherBase64: arrayBufferToBase64(cipherBuffer),
    ivBase64: arrayBufferToBase64(iv.buffer)
  };
}

export async function decryptText(cipherBase64, ivBase64, key) {
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToUint8Array(ivBase64) },
    key,
    base64ToUint8Array(cipherBase64)
  );
  return new TextDecoder().decode(decryptedBuffer);
}

export async function createVerifier(key) {
  return encryptText(VERIFIER_TEXT, key);
}

export async function verifyMasterKey(key, verifier) {
  if (!verifier || !verifier.cipherBase64 || !verifier.ivBase64) {
    return false;
  }
  try {
    const plainText = await decryptText(verifier.cipherBase64, verifier.ivBase64, key);
    return plainText === VERIFIER_TEXT;
  } catch (_error) {
    return false;
  }
}

export async function exportKeyToBase64(key) {
  const rawKey = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(rawKey);
}

export async function importKeyFromBase64(rawKeyBase64) {
  return crypto.subtle.importKey(
    "raw",
    base64ToUint8Array(rawKeyBase64),
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
