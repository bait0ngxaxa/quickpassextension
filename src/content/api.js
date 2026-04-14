import { GET_ENTRIES_MESSAGE, TOUCH_ENTRY_MESSAGE, UNLOCK_VAULT_MESSAGE } from "./messages.js";

export async function loadEntriesByHost(host) {
  try {
    const result = await chrome.runtime.sendMessage({ type: GET_ENTRIES_MESSAGE, host });
    return result || { locked: true, reason: "unknown", entries: [] };
  } catch (_error) {
    return { locked: true, reason: "unknown", entries: [] };
  }
}

export async function touchEntry(id) {
  if (!id) return;
  try {
    await chrome.runtime.sendMessage({ type: TOUCH_ENTRY_MESSAGE, id });
  } catch (_error) {
    // ignore
  }
}

export async function unlockVault(password) {
  try {
    const result = await chrome.runtime.sendMessage({ type: UNLOCK_VAULT_MESSAGE, password });
    return result || { ok: false, error: "ไม่สามารถปลดล็อก Vault ได้" };
  } catch (_error) {
    return { ok: false, error: "ไม่สามารถปลดล็อก Vault ได้" };
  }
}
