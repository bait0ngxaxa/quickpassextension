import assert from "node:assert/strict";
import test from "node:test";

import { derivePortableKeyFromPassword } from "../src/shared/crypto.js";
import {
  AUTO_LOCK_MS,
  clearVaultSession,
  getVaultSessionExpiry,
  readUnlockedKey,
  saveUnlockedKey,
  touchVaultSession
} from "../src/shared/vaultSession.js";
import { installMockChrome } from "./helpers/mockChrome.js";

test.beforeEach(() => {
  installMockChrome();
});

test.afterEach(async () => {
  await clearVaultSession();
});

test("saveUnlockedKey stores session key and expiry", async () => {
  const originalNow = Date.now;
  Date.now = () => 1_000;

  try {
    const key = await derivePortableKeyFromPassword("password-123456");
    await saveUnlockedKey(key);

    const session = await readUnlockedKey();
    const expiresAt = await getVaultSessionExpiry();

    assert.ok(session.key);
    assert.equal(session.expired, false);
    assert.equal(expiresAt, 1_000 + AUTO_LOCK_MS);
  } finally {
    Date.now = originalNow;
  }
});

test("readUnlockedKey clears expired session automatically", async () => {
  const originalNow = Date.now;

  try {
    Date.now = () => 2_000;
    const key = await derivePortableKeyFromPassword("password-123456");
    await saveUnlockedKey(key);

    Date.now = () => 2_000 + AUTO_LOCK_MS + 1;
    const session = await readUnlockedKey();
    const expiresAt = await getVaultSessionExpiry();

    assert.equal(session.key, null);
    assert.equal(session.expired, true);
    assert.equal(expiresAt, 0);
  } finally {
    Date.now = originalNow;
  }
});

test("touchVaultSession extends expiry for active session", async () => {
  const originalNow = Date.now;

  try {
    Date.now = () => 5_000;
    const key = await derivePortableKeyFromPassword("password-123456");
    await saveUnlockedKey(key);

    Date.now = () => 8_000;
    const touched = await touchVaultSession();
    const expiresAt = await getVaultSessionExpiry();

    assert.equal(touched, true);
    assert.equal(expiresAt, 8_000 + AUTO_LOCK_MS);
  } finally {
    Date.now = originalNow;
  }
});
