import {
  ENTRY_TYPE_LOGIN,
  ENTRY_TYPE_SECRET,
  SCOPE_ALL,
  SCOPE_CROSS,
  SCOPE_CURRENT,
  SCOPE_PINNED,
  TAB_ALL,
  TAB_LOGIN,
  TAB_SECRET
} from "./constants.js";
import { getItemSubtitle, getItemTitle } from "./form.js";

export function filterAndSortCredentials(items, state) {
  const keyword = state.search.trim().toLowerCase();
  const currentHost = (state.currentHost || "").toLowerCase();

  return items
    .filter((item) => matchesTab(item, state.tab))
    .filter((item) => matchesScope(item, state.scope, currentHost))
    .filter((item) => matchesKeyword(item, keyword))
    .sort((a, b) => {
      if (a.pinned && !b.pinned) {
        return -1;
      }
      if (!a.pinned && b.pinned) {
        return 1;
      }
      const aMatched = a.domain === currentHost;
      const bMatched = b.domain === currentHost;
      if (aMatched && !bMatched) {
        return -1;
      }
      if (!aMatched && bMatched) {
        return 1;
      }
      const aScore = Number(a.lastUsedAt) || Number(a.updatedAt) || 0;
      const bScore = Number(b.lastUsedAt) || Number(b.updatedAt) || 0;
      return bScore - aScore;
    });
}

export function groupByDomain(items, currentHost) {
  const groups = new Map();
  for (const item of items) {
    const domain = item.domain || "ไม่ระบุโดเมน";
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain).push(item);
  }

  const entries = Array.from(groups.entries()).map(([domain, groupedItems]) => ({
    domain,
    isCurrent: domain === currentHost,
    items: groupedItems
  }));

  return entries.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) {
      return -1;
    }
    if (!a.isCurrent && b.isCurrent) {
      return 1;
    }
    return a.domain.localeCompare(b.domain);
  });
}

export function makeSearchText(item) {
  return `${getItemTitle(item)} ${getItemSubtitle(item)} ${item.domain || ""} ${item.kind || ""}`.toLowerCase();
}

function matchesTab(item, tab) {
  if (tab === TAB_ALL) {
    return true;
  }
  if (tab === TAB_LOGIN) {
    return (item.kind || ENTRY_TYPE_LOGIN) === ENTRY_TYPE_LOGIN;
  }
  if (tab === TAB_SECRET) {
    return item.kind === ENTRY_TYPE_SECRET;
  }
  return true;
}

function matchesScope(item, scope, currentHost) {
  if (scope === SCOPE_ALL) {
    return true;
  }
  if (scope === SCOPE_PINNED) {
    return Boolean(item.pinned);
  }
  if (scope === SCOPE_CURRENT) {
    return item.domain === currentHost;
  }
  if (scope === SCOPE_CROSS) {
    return item.domain !== currentHost;
  }
  return true;
}

function matchesKeyword(item, keyword) {
  if (!keyword) {
    return true;
  }
  return makeSearchText(item).includes(keyword);
}
