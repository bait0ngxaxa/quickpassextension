import assert from "node:assert/strict";
import test from "node:test";

import { derivePortableKeyFromPassword } from "../src/shared/crypto.js";
import { encryptCredentialItem } from "../src/popup/vault.js";
import {
  getEntriesForHost,
  resetCredentialServiceDependencies,
  setCredentialServiceDependencies,
  touchEntry,
  unlockVaultFromPanel
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

test("getEntriesForHost decrypts, sorts pinned first, and falls back to cross-domain items", async () => {
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
    listEncryptedVaultItems: async () => ({ ok: true, error: "", items: [currentLogin, pinnedSecret] })
  });

  const result = await getEntriesForHost("example.com");

  assert.equal(result.locked, false);
  assert.equal(result.reason, "");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].id, "secret-cross");
  assert.equal(result.entries[0].pinned, true);
  assert.equal(result.entries[1].id, "login-current");
  assert.equal(result.entries[1].isMatched, true);
  assert.equal(result.entries[0].secretValue, "sk-123");
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

test("unlockVaultFromPanel validates empty and wrong password states", async () => {
  setCredentialServiceDependencies({
    unlockVault: async (password) => {
      if (password === "good-pass") {
        return { ok: true, reason: "", key: {} };
      }
      return { ok: false, reason: "invalid_password" };
    }
  });

  const empty = await unlockVaultFromPanel("   ");
  const wrong = await unlockVaultFromPanel("bad-pass");
  const success = await unlockVaultFromPanel("good-pass");

  assert.deepEqual(empty, { ok: false, error: "กรอก Master Password ก่อน" });
  assert.deepEqual(wrong, { ok: false, error: "Master Password ไม่ถูกต้อง" });
  assert.deepEqual(success, { ok: true, error: "" });
});
