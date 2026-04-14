import { decryptText } from "../shared/crypto.js";
import { touchVaultSession } from "../shared/vaultSession.js";
import { listEncryptedVaultItems, upsertEncryptedVaultItems } from "../supabase/vaultStore.js";
import { initializeVault, unlockVault } from "../popup/vaultService.js";

export async function getEntriesForHost(host) {
  const normalizedHost = normalizeHost(host || "");
  const vaultState = await initializeVault();
  if (vaultState.mode === "setup") {
    return { locked: true, reason: "not_initialized", entries: [] };
  }
  if (vaultState.mode !== "ready" || !vaultState.key) {
    return { locked: true, reason: "locked", entries: [] };
  }

  await touchVaultSession();
  const key = vaultState.key;
  const result = await listEncryptedVaultItems();
  if (!result.ok) {
    return {
      locked: result.error === "ยังไม่ได้ login Supabase",
      reason: result.error === "ยังไม่ได้ login Supabase" ? "not_logged_in" : "unknown",
      entries: []
    };
  }

  const decryptedEntries = [];

  for (const item of result.items) {
    try {
      const entry = await decryptEntry(item, key, normalizedHost);
      if (entry) {
        decryptedEntries.push(entry);
      }
    } catch (_error) {
      // ignore broken rows
    }
  }

  if (!decryptedEntries.length) {
    return { locked: false, reason: "empty", entries: [] };
  }

  const sortedEntries = sortEntries(decryptedEntries);
  const hasMatched = sortedEntries.some((item) => item.isMatched);
  return { locked: false, reason: hasMatched ? "" : "fallback_all", entries: sortedEntries };
}

export async function unlockVaultFromPanel(password) {
  const value = String(password || "").trim();
  if (!value) {
    return { ok: false, error: "กรอก Master Password ก่อน" };
  }

  const result = await unlockVault(value);
  if (!result.ok) {
    return {
      ok: false,
      error: result.reason === "invalid_password" ? "Master Password ไม่ถูกต้อง" : "ไม่สามารถปลดล็อกได้"
    };
  }

  return { ok: true, error: "" };
}

export async function touchEntry(id) {
  if (!id) return;
  await touchVaultSession();
  const result = await listEncryptedVaultItems();
  if (!result.ok) return;

  const now = Date.now();
  let changedItem = null;
  result.items.forEach((item) => {
    if (item.id !== id) return;
    changedItem = { ...item, lastUsedAt: now, updatedAt: now };
  });

  if (changedItem) {
    await upsertEncryptedVaultItems([changedItem]);
  }
}

async function decryptEntry(item, key, normalizedHost) {
  const kind = item.kind || "login";
  const entryDomain = normalizeHost(item.domain || "");
  const base = {
    id: item.id,
    kind,
    domain: entryDomain,
    isMatched: entryDomain === normalizedHost,
    pinned: Boolean(item.pinned),
    lastUsedAt: Number(item.lastUsedAt) || 0,
    updatedAt: Number(item.updatedAt) || 0,
    label: item.label || ""
  };

  if (kind === "secret") {
    return {
      ...base,
      secretName: await decryptText(item.secretNameCipher, item.secretNameIv, key),
      secretValue: await decryptText(item.secretValueCipher, item.secretValueIv, key)
    };
  }

  return {
    ...base,
    kind: "login",
    username: await decryptText(item.usernameCipher, item.usernameIv, key),
    password: await decryptText(item.passwordCipher, item.passwordIv, key)
  };
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

function normalizeHost(hostname) {
  if (!hostname) return "";
  return hostname.replace(/^www\./i, "");
}
