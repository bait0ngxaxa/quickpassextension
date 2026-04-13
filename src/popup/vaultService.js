import {
  CRYPTO_ITERATIONS,
  createVerifier,
  deriveKeyFromPassword,
  exportKeyToBase64,
  generateSaltBase64,
  importKeyFromBase64,
  verifyMasterKey
} from "../shared/crypto.js";
import { decryptCredentials, encryptCredentials, migrateExistingCredentials } from "./vault.js";

const SECURITY_KEY = "security";
const CREDENTIALS_KEY = "credentials";
const SESSION_KEY = "masterKeyBase64";

export async function initializeVault() {
  const { security = null } = await chrome.storage.local.get([SECURITY_KEY]);
  if (!security) {
    return { mode: "setup", key: null, credentials: [] };
  }
  const { masterKeyBase64 = "" } = await chrome.storage.session.get([SESSION_KEY]);
  if (!masterKeyBase64) {
    return { mode: "locked", key: null, credentials: [] };
  }

  try {
    const key = await importKeyFromBase64(masterKeyBase64);
    if (!(await verifyMasterKey(key, security.verifier))) {
      await chrome.storage.session.remove(SESSION_KEY);
      return { mode: "locked", key: null, credentials: [] };
    }
    return { mode: "ready", key, credentials: await readDecryptedCredentials(key) };
  } catch (_error) {
    await chrome.storage.session.remove(SESSION_KEY);
    return { mode: "locked", key: null, credentials: [] };
  }
}

export async function setupMasterPassword(password) {
  const saltBase64 = generateSaltBase64();
  const key = await deriveKeyFromPassword(password, saltBase64, CRYPTO_ITERATIONS);
  const verifier = await createVerifier(key);
  const { credentials: stored = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  const migrated = await migrateExistingCredentials(stored, key);
  await chrome.storage.local.set({
    [SECURITY_KEY]: { saltBase64, iterations: CRYPTO_ITERATIONS, verifier },
    [CREDENTIALS_KEY]: migrated
  });
  await chrome.storage.session.set({ [SESSION_KEY]: await exportKeyToBase64(key) });
  return { key, credentials: await readDecryptedCredentials(key) };
}

export async function unlockVault(password) {
  const { security = null } = await chrome.storage.local.get([SECURITY_KEY]);
  if (!security) {
    return { ok: false, reason: "not_initialized", key: null, credentials: [] };
  }

  try {
    const key = await deriveKeyFromPassword(
      password,
      security.saltBase64,
      security.iterations || CRYPTO_ITERATIONS
    );
    if (!(await verifyMasterKey(key, security.verifier))) {
      return { ok: false, reason: "invalid_password", key: null, credentials: [] };
    }
    await chrome.storage.session.set({ [SESSION_KEY]: await exportKeyToBase64(key) });
    return { ok: true, reason: "", key, credentials: await readDecryptedCredentials(key) };
  } catch (_error) {
    return { ok: false, reason: "unknown", key: null, credentials: [] };
  }
}

export async function lockVault() {
  await chrome.storage.session.remove(SESSION_KEY);
}

export async function persistCredentials(credentials, key) {
  await chrome.storage.local.set({ [CREDENTIALS_KEY]: await encryptCredentials(credentials, key) });
}

async function readDecryptedCredentials(key) {
  const { credentials: stored = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  return decryptCredentials(stored, key);
}
