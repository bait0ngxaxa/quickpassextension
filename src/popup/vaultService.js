import {
  CRYPTO_ITERATIONS,
  createVerifier,
  deriveKeyFromPassword,
  derivePortableKeyFromPassword,
  PORTABLE_KEY_STRATEGY,
  verifyMasterKey
} from "../shared/crypto.js";
import { clearVaultSession, readUnlockedKey, saveUnlockedKey } from "../shared/vaultSession.js";
import { decryptCredentialsWithReport, encryptCredentials, migrateExistingCredentials } from "./vault.js";

const SECURITY_KEY = "security";
const CREDENTIALS_KEY = "credentials";

export async function initializeVault() {
  const { security = null } = await chrome.storage.local.get([SECURITY_KEY]);
  if (!security) {
    return { mode: "setup", key: null, credentials: [] };
  }
  const session = await readUnlockedKey();
  if (!session.key) {
    return { mode: "locked", key: null, credentials: [] };
  }

  try {
    const key = session.key;
    if (!(await verifyMasterKey(key, security.verifier))) {
      await clearVaultSession();
      return { mode: "locked", key: null, credentials: [] };
    }
    return { mode: "ready", key, credentials: [] };
  } catch (_error) {
    await clearVaultSession();
    return { mode: "locked", key: null, credentials: [] };
  }
}

export async function setupMasterPassword(password) {
  const key = await derivePortableKeyFromPassword(password, CRYPTO_ITERATIONS);
  const verifier = await createVerifier(key);
  const { credentials: stored = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  const migrated = await migrateExistingCredentials(stored, key);
  await chrome.storage.local.set({
    [SECURITY_KEY]: { strategy: PORTABLE_KEY_STRATEGY, iterations: CRYPTO_ITERATIONS, verifier },
    [CREDENTIALS_KEY]: migrated
  });
  await saveUnlockedKey(key);
  return { key, credentials: [] };
}

export async function unlockVault(password) {
  const { security = null } = await chrome.storage.local.get([SECURITY_KEY]);
  if (!security) {
    return { ok: false, reason: "not_initialized", key: null, credentials: [] };
  }

  try {
    if (security.strategy === PORTABLE_KEY_STRATEGY) {
      const key = await derivePortableKeyFromPassword(password, security.iterations || CRYPTO_ITERATIONS);
      if (!(await verifyMasterKey(key, security.verifier))) {
        return { ok: false, reason: "invalid_password", key: null, credentials: [] };
      }
      await saveUnlockedKey(key);
      return { ok: true, reason: "", key, credentials: [] };
    }

    const legacyKey = await deriveKeyFromPassword(
      password,
      security.saltBase64,
      security.iterations || CRYPTO_ITERATIONS
    );
    if (!(await verifyMasterKey(legacyKey, security.verifier))) {
      return { ok: false, reason: "invalid_password", key: null, credentials: [] };
    }

    const credentials = await readDecryptedCredentials(legacyKey);
    const portableKey = await derivePortableKeyFromPassword(password, CRYPTO_ITERATIONS);
    const verifier = await createVerifier(portableKey);

    await chrome.storage.local.set({
      [SECURITY_KEY]: {
        strategy: PORTABLE_KEY_STRATEGY,
        iterations: CRYPTO_ITERATIONS,
        verifier
      },
      [CREDENTIALS_KEY]: await encryptCredentials(credentials, portableKey)
    });
    await saveUnlockedKey(portableKey);
    return { ok: true, reason: "migrated", key: portableKey, credentials };
  } catch (_error) {
    return { ok: false, reason: "unknown", key: null, credentials: [] };
  }
}

export async function lockVault() {
  await clearVaultSession();
}

export async function decryptEncryptedVaultItems(encryptedItems, key) {
  return decryptCredentialsWithReport(encryptedItems, key);
}

export async function getLocalSecurityProfile() {
  const { security = null } = await chrome.storage.local.get([SECURITY_KEY]);
  return security;
}

export async function saveLocalSecurityProfile(profile) {
  if (!profile) {
    await chrome.storage.local.remove([SECURITY_KEY]);
    return;
  }

  await chrome.storage.local.set({
    [SECURITY_KEY]: {
      strategy: profile.strategy || PORTABLE_KEY_STRATEGY,
      iterations: Number(profile.iterations) || CRYPTO_ITERATIONS,
      verifier: profile.verifier || null
    }
  });
}

export async function getLegacyEncryptedVaultItems() {
  const { credentials: stored = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  return stored;
}

export async function clearLegacyEncryptedVaultItems() {
  await chrome.storage.local.remove([CREDENTIALS_KEY]);
}
