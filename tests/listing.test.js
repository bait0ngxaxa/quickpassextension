import assert from "node:assert/strict";
import test from "node:test";

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
} from "../src/popup/constants.js";
import { filterAndSortCredentials, groupByDomain, makeSearchText } from "../src/popup/listing.js";

function createItem(overrides = {}) {
  return {
    id: overrides.id || crypto.randomUUID(),
    kind: overrides.kind || ENTRY_TYPE_LOGIN,
    domain: overrides.domain || "example.com",
    label: overrides.label || "",
    username: overrides.username || "",
    password: overrides.password || "",
    secretName: overrides.secretName || "",
    secretValue: overrides.secretValue || "",
    pinned: Boolean(overrides.pinned),
    lastUsedAt: Number(overrides.lastUsedAt) || 0,
    updatedAt: Number(overrides.updatedAt) || 0
  };
}

test("filterAndSortCredentials filters by tab and keyword", () => {
  const items = [
    createItem({ id: "login-1", kind: ENTRY_TYPE_LOGIN, domain: "example.com", label: "งาน", username: "user@example.com" }),
    createItem({
      id: "secret-1",
      kind: ENTRY_TYPE_SECRET,
      domain: "api.example.com",
      label: "OpenAI",
      secretName: "OPENAI_API_KEY",
      secretValue: "sk-123"
    })
  ];

  const result = filterAndSortCredentials(items, {
    search: "openai",
    tab: TAB_SECRET,
    scope: SCOPE_ALL,
    currentHost: "example.com"
  });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "secret-1");
});

test("filterAndSortCredentials prioritizes pinned then current host then recency", () => {
  const items = [
    createItem({ id: "recent-cross", domain: "other.com", updatedAt: 300 }),
    createItem({ id: "current", domain: "example.com", updatedAt: 200 }),
    createItem({ id: "pinned", domain: "other.com", pinned: true, updatedAt: 100 })
  ];

  const result = filterAndSortCredentials(items, {
    search: "",
    tab: TAB_ALL,
    scope: SCOPE_ALL,
    currentHost: "example.com"
  });

  assert.deepEqual(
    result.map((item) => item.id),
    ["pinned", "current", "recent-cross"]
  );
});

test("filterAndSortCredentials applies current, cross, and pinned scopes correctly", () => {
  const items = [
    createItem({ id: "current", domain: "example.com" }),
    createItem({ id: "cross", domain: "other.com" }),
    createItem({ id: "pinned", domain: "elsewhere.com", pinned: true })
  ];

  const currentOnly = filterAndSortCredentials(items, {
    search: "",
    tab: TAB_ALL,
    scope: SCOPE_CURRENT,
    currentHost: "example.com"
  });
  const crossOnly = filterAndSortCredentials(items, {
    search: "",
    tab: TAB_ALL,
    scope: SCOPE_CROSS,
    currentHost: "example.com"
  });
  const pinnedOnly = filterAndSortCredentials(items, {
    search: "",
    tab: TAB_ALL,
    scope: SCOPE_PINNED,
    currentHost: "example.com"
  });

  assert.deepEqual(currentOnly.map((item) => item.id), ["current"]);
  assert.deepEqual(crossOnly.map((item) => item.id), ["pinned", "cross"]);
  assert.deepEqual(pinnedOnly.map((item) => item.id), ["pinned"]);
});

test("groupByDomain groups items and puts current domain first", () => {
  const items = [
    createItem({ id: "cross-1", domain: "zeta.com" }),
    createItem({ id: "current-1", domain: "example.com" }),
    createItem({ id: "cross-2", domain: "alpha.com" }),
    createItem({ id: "current-2", domain: "example.com" })
  ];

  const groups = groupByDomain(items, "example.com");

  assert.deepEqual(
    groups.map((group) => group.domain),
    ["example.com", "alpha.com", "zeta.com"]
  );
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].isCurrent, true);
});

test("makeSearchText includes title subtitle domain and kind", () => {
  const item = createItem({
    kind: ENTRY_TYPE_SECRET,
    domain: "api.example.com",
    label: "OpenAI",
    secretName: "OPENAI_API_KEY"
  });

  const text = makeSearchText(item);

  assert.match(text, /openai/);
  assert.match(text, /api\.example\.com/);
  assert.match(text, /secret/);
});

test("filterAndSortCredentials returns only login items for login tab", () => {
  const items = [
    createItem({ id: "login-1", kind: ENTRY_TYPE_LOGIN }),
    createItem({ id: "secret-1", kind: ENTRY_TYPE_SECRET, secretName: "TOKEN", secretValue: "x" })
  ];

  const result = filterAndSortCredentials(items, {
    search: "",
    tab: TAB_LOGIN,
    scope: SCOPE_ALL,
    currentHost: "example.com"
  });

  assert.deepEqual(result.map((item) => item.id), ["login-1"]);
});
