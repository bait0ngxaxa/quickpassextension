import { GET_ENTRIES_MESSAGE, OPEN_VAULT_PAGE_MESSAGE, RESOLVE_ENTRY_FIELD_MESSAGE, TOUCH_ENTRY_MESSAGE } from "./messages.js";

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

export async function resolveEntryField(host, id, field) {
  if (!host || !id || !field) {
    return { ok: false, reason: "invalid_request", value: "", error: "คำขอไม่ถูกต้อง" };
  }

  try {
    const result = await chrome.runtime.sendMessage({ type: RESOLVE_ENTRY_FIELD_MESSAGE, host, id, field });
    return result || { ok: false, reason: "unknown", value: "", error: "ไม่สามารถอ่านข้อมูลได้" };
  } catch (_error) {
    return { ok: false, reason: "unknown", value: "", error: "ไม่สามารถอ่านข้อมูลได้" };
  }
}

export async function openVaultPage() {
  try {
    await chrome.runtime.sendMessage({ type: OPEN_VAULT_PAGE_MESSAGE });
  } catch (_error) {
    // ignore
  }
}
