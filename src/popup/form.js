import { ENTRY_TYPE_LOGIN, ENTRY_TYPE_SECRET } from "./constants.js";
import { normalizeHost } from "./vault.js";

export function createEmptyForm(domain = "") {
  return {
    id: "",
    kind: ENTRY_TYPE_LOGIN,
    domain,
    label: "",
    username: "",
    password: "",
    secretName: "",
    secretValue: ""
  };
}

export function buildPayload(form) {
  const id = form.id.trim() || crypto.randomUUID();
  const kind = form.kind;
  const domain = normalizeHost(form.domain.trim());
  const label = form.label.trim();

  if (!domain) {
    return { error: "กรอกโดเมนให้ครบ", payload: null };
  }

  if (kind === ENTRY_TYPE_SECRET) {
    const secretName = form.secretName.trim();
    const secretValue = form.secretValue.trim();
    if (!secretValue) {
      return { error: "กรอกค่า API Key / Secret ให้ครบ", payload: null };
    }
    return {
      error: "",
      payload: {
        id,
        kind,
        domain,
        label,
        secretName: secretName || "API Key",
        secretValue,
        pinned: Boolean(form.pinned),
        lastUsedAt: Number(form.lastUsedAt) || 0,
        updatedAt: Date.now()
      }
    };
  }

  const username = form.username.trim();
  const password = form.password.trim();
  if (!username || !password) {
    return { error: "กรอก Username และ Password ให้ครบ", payload: null };
  }

  return {
    error: "",
    payload: {
      id,
      kind: ENTRY_TYPE_LOGIN,
      domain,
      label,
      username,
      password,
      pinned: Boolean(form.pinned),
      lastUsedAt: Number(form.lastUsedAt) || 0,
      updatedAt: Date.now()
    }
  };
}

export function formFromItem(item) {
  return {
    id: item.id,
    kind: item.kind || ENTRY_TYPE_LOGIN,
    domain: item.domain || "",
    label: item.label || "",
    username: item.username || "",
    password: item.password || "",
    secretName: item.secretName || "",
    secretValue: item.secretValue || "",
    pinned: Boolean(item.pinned),
    lastUsedAt: Number(item.lastUsedAt) || 0
  };
}

export function getItemTitle(item) {
  if (item.kind === ENTRY_TYPE_SECRET) {
    return item.label || item.secretName || "Secret";
  }
  return item.label || item.username;
}

export function getItemSubtitle(item) {
  if (item.kind === ENTRY_TYPE_SECRET) {
    return `${item.domain} · ${item.secretName || "API Key/Secret"}`;
  }
  return `${item.domain} · ${item.username}`;
}
