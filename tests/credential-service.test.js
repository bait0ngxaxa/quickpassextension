import assert from "node:assert/strict";
import test from "node:test";

import { derivePortableKeyFromPassword } from "../src/shared/crypto.js";
import { encryptCredentialItem } from "../src/popup/vault.js";
import {
  getEntriesForHost,
  resetCredentialServiceDependencies,
  resolveEntryFieldForHost,
  setCredentialServiceDependencies,
  touchEntry
} from "../src/background/credentialService.js";

test.afterEach(() => {
  resetCredentialServiceDependencies();
});

test("getEntriesForHost returns not_initialized when vault is not set up", async () => {
  setCredentialServiceDependencies({
    initializeVault: async () => ({ mode: "setup", key: null })
  });

  const result = await getEntriesForHost("example.com");

  assert.deepEqual(result, { locked: true, reason: "not_initialized", entries: [] });
});

test("getEntriesForHost returns not_logged_in when Supabase session is missing", async () => {
  const key = await derivePortableKeyFromPassword("strong-password-123");

  setCredentialServiceDependencies({
    initializeVault: async () => ({ mode: "ready", key }),
    touchVaultSession: async () => true,
    listEncryptedVaultItems: async () => ({ ok: false, error: "ยังไม่ได้ login Supabase", items: [] })
  });

  const result = await getEntriesForHost("example.com");

  assert.deepEqual(result, { locked: true, reason: "not_logged_in", entries: [] });
});

test("getEntriesForHost returns only current-domain metadata", async () => {
  const key = await derivePortableKeyFromPassword("strong-password-123");
  const currentLogin = await encryptCredentialItem(
    {
      id: "login-current",
      kind: "login",
      domain: "example.com",
      label: "เว็บหลัก",
      username: "me@example.com",
      password: "pw-1",
      pinned: false,
      lastUsedAt: 100,
      updatedAt: 100
    },
    key
  );
  const currentPinnedSecret = await encryptCredentialItem(
    {
      id: "secret-current",
      kind: "secret",
      domain: "example.com",
      label: "คีย์ในโดเมนนี้",
      secretName: "CURRENT_API_KEY",
      secretValue: "sk-current",
      pinned: true,
      lastUsedAt: 150,
      updatedAt: 150
    },
    key
  );
  const pinnedSecret = await encryptCredentialItem(
    {
      id: "secret-cross",
      kind: "secret",
      domain: "api.other.com",
      label: "สำคัญ",
      secretName: "OPENAI_API_KEY",
      secretValue: "sk-123",
      pinned: true,
      lastUsedAt: 50,
      updatedAt: 50
    },
    key
  );

  setCredentialServiceDependencies({
    initializeVault: async () => ({ mode: "ready", key }),
    touchVaultSession: async () => true,
    listEncryptedVaultItems: async () => ({ ok: true, error: "", items: [currentLogin, currentPinnedSecret, pinnedSecret] })
  });

  const result = await getEntriesForHost("example.com");

  assert.equal(result.locked, false);
  assert.equal(result.reason, "");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].id, "secret-current");
  assert.equal(result.entries[0].pinned, true);
  assert.equal(result.entries[1].id, "login-current");
  assert.equal(result.entries[1].isMatched, true);
  assert.equal(result.entries[0].label, "คีย์ในโดเมนนี้");
  assert.equal("secretValue" in result.entries[0], false);
  assert.equal("password" in result.entries[1], false);
  assert.equal(result.entries.some((item) => item.id === "secret-cross"), false);
});

test("resolveEntryFieldForHost decrypts only the requested field for the current domain", async () => {
  const key = await derivePortableKeyFromPassword("strong-password-123");
  const currentLogin = await encryptCredentialItem(
    {
      id: "login-current",
      kind: "login",
      domain: "example.com",
      label: "เว็บหลัก",
      username: "me@example.com",
      password: "pw-1",
      pinned: false,
      lastUsedAt: 100,
      updatedAt: 100
    },
    key
  );
  const crossSecret = await encryptCredentialItem(
    {
      id: "secret-cross",
      kind: "secret",
      domain: "api.other.com",
      label: "สำคัญ",
      secretName: "OPENAI_API_KEY",
      secretValue: "sk-123",
      pinned: true,
      lastUsedAt: 50,
      updatedAt: 50
    },
    key
  );

  setCredentialServiceDependencies({
    initializeVault: async () => ({ mode: "ready", key }),
    touchVaultSession: async () => true,
    listEncryptedVaultItems: async () => ({ ok: true, error: "", items: [currentLogin, crossSecret] })
  });

  const password = await resolveEntryFieldForHost("example.com", "login-current", "password");
  const crossDomain = await resolveEntryFieldForHost("example.com", "secret-cross", "secretValue");

  assert.deepEqual(password, { ok: true, reason: "", value: "pw-1", error: "" });
  assert.equal(crossDomain.ok, false);
  assert.equal(crossDomain.reason, "not_found");
});

test("touchEntry updates lastUsedAt and upserts only the changed encrypted row", async () => {
  const encryptedItems = [
    {
      id: "first",
      kind: "login",
      domain: "example.com",
      label: "A",
      pinned: false,
      lastUsedAt: 1,
      updatedAt: 1
    },
    {
      id: "second",
      kind: "secret",
      domain: "api.example.com",
      label: "B",
      pinned: false,
      lastUsedAt: 2,
      updatedAt: 2
    }
  ];
  let upserted = [];

  setCredentialServiceDependencies({
    touchVaultSession: async () => true,
    listEncryptedVaultItems: async () => ({ ok: true, error: "", items: encryptedItems }),
    upsertEncryptedVaultItems: async (items) => {
      upserted = items;
      return { ok: true, error: "", count: items.length };
    }
  });

  await touchEntry("second");

  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].id, "second");
  assert.ok(Number(upserted[0].lastUsedAt) >= Date.now() - 1000);
  assert.ok(Number(upserted[0].updatedAt) >= Date.now() - 1000);
});
