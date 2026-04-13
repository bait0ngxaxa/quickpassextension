import { decryptText, importKeyFromBase64 } from "../shared/crypto.js";

const SECURITY_KEY = "security";
const SESSION_KEY = "masterKeyBase64";
const CREDENTIALS_KEY = "credentials";

export async function getEntriesForHost(host) {
  const normalizedHost = normalizeHost(host || "");
  const { security } = await chrome.storage.local.get([SECURITY_KEY]);
  if (!security) {
    return { locked: true, reason: "not_initialized", entries: [] };
  }

  const { masterKeyBase64 = "" } = await chrome.storage.session.get([SESSION_KEY]);
  if (!masterKeyBase64) {
    return { locked: true, reason: "locked", entries: [] };
  }

  const key = await importKeyFromBase64(masterKeyBase64);
  const { credentials = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  const decryptedEntries = [];

  for (const item of credentials) {
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

export async function touchEntry(id) {
  if (!id) return;
  const { credentials = [] } = await chrome.storage.local.get([CREDENTIALS_KEY]);
  const now = Date.now();
  let changed = false;
  const nextCredentials = credentials.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, lastUsedAt: now };
  });

  if (changed) {
    await chrome.storage.local.set({ [CREDENTIALS_KEY]: nextCredentials });
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
