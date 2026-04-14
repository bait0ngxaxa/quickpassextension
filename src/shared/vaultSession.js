import { exportKeyToBase64, importKeyFromBase64 } from "./crypto.js";

const SESSION_KEY = "masterKeyBase64";
const SESSION_EXPIRES_AT_KEY = "vaultSessionExpiresAt";

export const AUTO_LOCK_MINUTES = 30;
export const AUTO_LOCK_MS = AUTO_LOCK_MINUTES * 60 * 1000;

export async function saveUnlockedKey(key) {
  const masterKeyBase64 = await exportKeyToBase64(key);
  await chrome.storage.session.set({
    [SESSION_KEY]: masterKeyBase64,
    [SESSION_EXPIRES_AT_KEY]: Date.now() + AUTO_LOCK_MS
  });
}

export async function readUnlockedKey() {
  const {
    masterKeyBase64 = "",
    vaultSessionExpiresAt = 0
  } = await chrome.storage.session.get([SESSION_KEY, SESSION_EXPIRES_AT_KEY]);

  if (!masterKeyBase64) {
    return { key: null, expired: false, expiresAt: 0 };
  }

  if (!vaultSessionExpiresAt || Number(vaultSessionExpiresAt) <= Date.now()) {
    await clearVaultSession();
    return { key: null, expired: true, expiresAt: 0 };
  }

  try {
    const key = await importKeyFromBase64(masterKeyBase64);
    return { key, expired: false, expiresAt: Number(vaultSessionExpiresAt) };
  } catch (_error) {
    await clearVaultSession();
    return { key: null, expired: false, expiresAt: 0 };
  }
}

export async function touchVaultSession() {
  const { key } = await readUnlockedKey();
  if (!key) {
    return false;
  }

  await chrome.storage.session.set({
    [SESSION_EXPIRES_AT_KEY]: Date.now() + AUTO_LOCK_MS
  });
  return true;
}

export async function getVaultSessionExpiry() {
  const { vaultSessionExpiresAt = 0 } = await chrome.storage.session.get([SESSION_EXPIRES_AT_KEY]);
  return Number(vaultSessionExpiresAt) || 0;
}

export async function clearVaultSession() {
  await chrome.storage.session.remove([SESSION_KEY, SESSION_EXPIRES_AT_KEY]);
}
