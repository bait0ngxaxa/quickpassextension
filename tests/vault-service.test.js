import assert from "node:assert/strict";
import test from "node:test";

import { isEncryptedCredential } from "../src/popup/vault.js";
import {
  getLegacyEncryptedVaultItems,
  initializeVault,
  lockVault,
  setupMasterPassword,
  unlockVault
} from "../src/popup/vaultService.js";
import { installMockChrome } from "./helpers/mockChrome.js";

test.beforeEach(() => {
  installMockChrome();
});

test.afterEach(async () => {
  await lockVault();
});

test("setupMasterPassword sets ready state immediately", async () => {
  await setupMasterPassword("strong-password-123");

  const state = await initializeVault();

  assert.equal(state.mode, "ready");
  assert.ok(state.key);
});

test("lockVault removes unlocked session and returns to locked mode", async () => {
  await setupMasterPassword("strong-password-123");

  await lockVault();
  const state = await initializeVault();

  assert.equal(state.mode, "locked");
  assert.equal(state.key, null);
});

test("unlockVault rejects wrong password and accepts correct password", async () => {
  await setupMasterPassword("strong-password-123");
  await lockVault();

  const failed = await unlockVault("wrong-password");
  const success = await unlockVault("strong-password-123");

  assert.equal(failed.ok, false);
  assert.equal(failed.reason, "invalid_password");
  assert.equal(success.ok, true);
  assert.ok(success.key);
});

test("setupMasterPassword migrates plaintext legacy credentials into encrypted payloads", async () => {
  installMockChrome({
    local: {
      credentials: [
        {
          id: "login-1",
          kind: "login",
          domain: "https://www.example.com/login",
          label: "งาน",
          username: "user@example.com",
          password: "secret-1"
        },
        {
          id: "secret-1",
          kind: "secret",
          domain: "api.example.com",
          label: "API",
          secretName: "OPENAI_API_KEY",
          secretValue: "secret-2"
        }
      ]
    }
  });

  await setupMasterPassword("strong-password-123");
  const migrated = await getLegacyEncryptedVaultItems();

  assert.equal(migrated.length, 2);
  assert.equal(isEncryptedCredential(migrated[0]), true);
  assert.equal(isEncryptedCredential(migrated[1]), true);
  assert.equal(migrated[0].domain, "example.com");
  assert.equal(migrated[1].domain, "api.example.com");
});
