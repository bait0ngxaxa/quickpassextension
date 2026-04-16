import { decryptText } from "../shared/crypto.js";
import { touchVaultSession } from "../shared/vaultSession.js";
import { listEncryptedVaultItems, upsertEncryptedVaultItems } from "../supabase/vaultStore.js";
import { initializeVault } from "../popup/vaultService.js";

const services = {
  initializeVault,
  listEncryptedVaultItems,
  upsertEncryptedVaultItems,
  touchVaultSession
};

export async function getEntriesForHost(host) {
  const normalizedHost = normalizeHost(host || "");
  const vaultState = await services.initializeVault();
  if (vaultState.mode === "setup") {
    return { locked: true, reason: "not_initialized", entries: [] };
  }
  if (vaultState.mode !== "ready" || !vaultState.key) {
    return { locked: true, reason: "locked", entries: [] };
  }

  await services.touchVaultSession();
  const result = await services.listEncryptedVaultItems();
  if (!result.ok) {
    return {
      locked: result.error === "ยังไม่ได้ login Supabase",
      reason: result.error === "ยังไม่ได้ login Supabase" ? "not_logged_in" : "unknown",
      entries: []
    };
  }

  const visibleEntries = result.items
    .filter((item) => shouldExposeItemForHost(item, normalizedHost))
    .map((item) => buildEntrySummary(item, normalizedHost));

  if (!visibleEntries.length) {
    return { locked: false, reason: "empty", entries: [] };
  }

  return { locked: false, reason: "", entries: sortEntries(visibleEntries) };
}

export async function resolveEntryFieldForHost(host, id, field) {
  const normalizedHost = normalizeHost(host || "");
  const normalizedId = String(id || "").trim();
  const normalizedField = normalizeEntryField(field);

  if (!normalizedHost || !normalizedId || !normalizedField) {
    return { ok: false, reason: "invalid_request", value: "", error: "คำขอไม่ถูกต้อง" };
  }

  const vaultState = await services.initializeVault();
  if (vaultState.mode === "setup") {
    return { ok: false, reason: "not_initialized", value: "", error: "ยังไม่ได้ตั้ง Master Password" };
  }
  if (vaultState.mode !== "ready" || !vaultState.key) {
    return { ok: false, reason: "locked", value: "", error: "Vault ยังถูกล็อกอยู่" };
  }

  await services.touchVaultSession();
  const result = await services.listEncryptedVaultItems();
  if (!result.ok) {
    return {
      ok: false,
      reason: result.error === "ยังไม่ได้ login Supabase" ? "not_logged_in" : "unknown",
      value: "",
      error: result.error || "ไม่สามารถอ่านข้อมูลได้"
    };
  }

  const item = result.items.find((candidate) => candidate.id === normalizedId && shouldExposeItemForHost(candidate, normalizedHost));
  if (!item) {
    return { ok: false, reason: "not_found", value: "", error: "ไม่พบข้อมูลที่ร้องขอ" };
  }

  try {
    const value = await decryptEntryField(item, vaultState.key, normalizedField);
    return { ok: true, reason: "", value, error: "" };
  } catch (_error) {
    return { ok: false, reason: "unavailable", value: "", error: "ไม่สามารถถอดรหัสข้อมูลได้" };
  }
}

export async function touchEntry(id) {
  if (!id) return;
  await services.touchVaultSession();
  const result = await services.listEncryptedVaultItems();
  if (!result.ok) return;

  const now = Date.now();
  let changedItem = null;
  result.items.forEach((item) => {
    if (item.id !== id) return;
    changedItem = { ...item, lastUsedAt: now, updatedAt: now };
  });

  if (changedItem) {
    await services.upsertEncryptedVaultItems([changedItem]);
  }
}

export function setCredentialServiceDependencies(overrides) {
  Object.assign(services, overrides || {});
}

export function resetCredentialServiceDependencies() {
  services.initializeVault = initializeVault;
  services.listEncryptedVaultItems = listEncryptedVaultItems;
  services.upsertEncryptedVaultItems = upsertEncryptedVaultItems;
  services.touchVaultSession = touchVaultSession;
}

function buildEntrySummary(item, normalizedHost) {
  const kind = item.kind || "login";
  const entryDomain = normalizeHost(item.domain || "");
  return {
    id: item.id,
    kind,
    domain: entryDomain,
    isMatched: entryDomain === normalizedHost,
    pinned: Boolean(item.pinned),
    lastUsedAt: Number(item.lastUsedAt) || 0,
    updatedAt: Number(item.updatedAt) || 0,
    label: item.label || ""
  };
}

async function decryptEntryField(item, key, field) {
  const kind = item.kind || "login";

  if (kind === "secret") {
    if (field === "secretName") {
      return decryptText(item.secretNameCipher, item.secretNameIv, key);
    }
    if (field === "secretValue") {
      return decryptText(item.secretValueCipher, item.secretValueIv, key);
    }
    throw new Error("field_not_allowed");
  }

  if (field === "username") {
    return decryptText(item.usernameCipher, item.usernameIv, key);
  }
  if (field === "password") {
    return decryptText(item.passwordCipher, item.passwordIv, key);
  }
  throw new Error("field_not_allowed");
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.isMatched && !b.isMatched) return -1;
    if (!a.isMatched && b.isMatched) return 1;
    const scoreA = a.lastUsedAt || a.updatedAt;
    const scoreB = b.lastUsedAt || b.updatedAt;
    return scoreB - scoreA;
  });
}

function shouldExposeItemForHost(item, normalizedHost) {
  if (!normalizedHost) {
    return false;
  }

  return normalizeHost(item?.domain || "") === normalizedHost;
}

function normalizeEntryField(field) {
  const value = String(field || "").trim();
  if (value === "username" || value === "password" || value === "secretName" || value === "secretValue") {
    return value;
  }
  return "";
}

function normalizeHost(hostname) {
  if (!hostname) return "";
  return hostname.replace(/^www\./i, "");
}
