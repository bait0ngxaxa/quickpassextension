import { TAB_ALL, TAB_LOGIN, TAB_SECRET } from "./constants.js";

export function createPanelState(overrides = {}) {
  return {
    host: "",
    entries: [],
    reason: "",
    search: "",
    tab: TAB_ALL,
    ...overrides
  };
}

export function getFilteredEntries(state) {
  const keyword = state.search.trim().toLowerCase();
  return state.entries.filter((item) => {
    if (state.tab === TAB_LOGIN && item.kind !== "login") return false;
    if (state.tab === TAB_SECRET && item.kind !== "secret") return false;
    if (!keyword) return true;
    return `${getEntryTitle(item, 0)} ${getEntrySubtitle(item, state.host)}`.toLowerCase().includes(keyword);
  });
}

export function getEntryTitle(entry, index) {
  const marker = entry.pinned ? "★ " : "";
  if (entry.kind === "secret") return `${marker}${entry.label || entry.secretName || `Secret ที่ ${index + 1}`}`;
  return `${marker}${entry.label || entry.username || `บัญชีที่ ${index + 1}`}`;
}

export function getEntrySubtitle(entry, currentHost) {
  const domainText = entry.domain || "ไม่ระบุโดเมน";
  const scopeText = entry.domain === currentHost ? "โดเมนปัจจุบัน" : "รายการนี้";
  return `${domainText} · ${scopeText}`;
}
