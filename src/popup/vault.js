import { decryptText, encryptText } from "../shared/crypto.js";

export function normalizeHost(hostname) {
  return (hostname || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "");
}

export function isEncryptedCredential(item) {
  const kind = item?.kind || "login";
  const hasLoginFields = Boolean(
    item && item.usernameCipher && item.usernameIv && item.passwordCipher && item.passwordIv
  );
  const hasSecretFields = Boolean(
    item && item.secretNameCipher && item.secretNameIv && item.secretValueCipher && item.secretValueIv
  );
  return Boolean(
    item && item.domain && ((kind === "login" && hasLoginFields) || (kind === "secret" && hasSecretFields))
  );
}

export async function encryptCredentialItem(item, key) {
  const baseItem = {
    id: item.id,
    kind: item.kind || "login",
    domain: normalizeHost(item.domain),
    label: item.label || "",
    pinned: Boolean(item.pinned),
    lastUsedAt: Number(item.lastUsedAt) || 0,
    updatedAt: item.updatedAt
  };

  if (baseItem.kind === "secret") {
    const secretName = await encryptText(item.secretName || "", key);
    const secretValue = await encryptText(item.secretValue || "", key);
    return {
      ...baseItem,
      secretNameCipher: secretName.cipherBase64,
      secretNameIv: secretName.ivBase64,
      secretValueCipher: secretValue.cipherBase64,
      secretValueIv: secretValue.ivBase64
    };
  }

  const username = await encryptText(item.username || "", key);
  const password = await encryptText(item.password || "", key);
  return {
    ...baseItem,
    usernameCipher: username.cipherBase64,
    usernameIv: username.ivBase64,
    passwordCipher: password.cipherBase64,
    passwordIv: password.ivBase64
  };
}

export async function encryptCredentials(items, key) {
  const encrypted = [];
  for (const item of items) {
    encrypted.push(await encryptCredentialItem(item, key));
  }
  return encrypted;
}

export async function decryptCredentials(items, key) {
  const { credentials } = await decryptCredentialsWithReport(items, key);
  return credentials;
}

export async function decryptCredentialsWithReport(items, key) {
  const decrypted = [];
  let failedCount = 0;
  let encryptedCount = 0;

  for (const item of items) {
    if (!isEncryptedCredential(item)) {
      continue;
    }

    encryptedCount += 1;
    try {
      const kind = item.kind || "login";
      const baseItem = {
        id: item.id,
        kind,
        domain: item.domain,
        label: item.label || "",
        pinned: Boolean(item.pinned),
        lastUsedAt: Number(item.lastUsedAt) || 0,
        updatedAt: Number(item.updatedAt) || Date.now()
      };

      if (kind === "secret") {
        const secretName = await decryptText(item.secretNameCipher, item.secretNameIv, key);
        const secretValue = await decryptText(item.secretValueCipher, item.secretValueIv, key);
        decrypted.push({
          ...baseItem,
          secretName,
          secretValue
        });
      } else {
        const username = await decryptText(item.usernameCipher, item.usernameIv, key);
        const password = await decryptText(item.passwordCipher, item.passwordIv, key);
        decrypted.push({
          ...baseItem,
          username,
          password
        });
      }
    } catch (_error) {
      failedCount += 1;
    }
  }

  return {
    credentials: decrypted,
    failedCount,
    encryptedCount
  };
}

export async function migrateExistingCredentials(stored, key) {
  const migrated = [];

  for (const item of stored) {
    if (isEncryptedCredential(item)) {
      migrated.push(item);
      continue;
    }

    if (!item || !item.domain) continue;

    if ((item.kind || "login") === "secret") {
      if (!item.secretValue) continue;
      migrated.push(
        await encryptCredentialItem(
          {
            id: item.id || crypto.randomUUID(),
            kind: "secret",
            domain: normalizeHost(item.domain),
            label: item.label || "",
            secretName: item.secretName || item.label || "API Key",
            secretValue: item.secretValue,
            pinned: Boolean(item.pinned),
            lastUsedAt: Number(item.lastUsedAt) || 0,
            updatedAt: Number(item.updatedAt) || Date.now()
          },
          key
        )
      );
      continue;
    }

    if (!item.username || !item.password) continue;
    migrated.push(
      await encryptCredentialItem(
        {
          id: item.id || crypto.randomUUID(),
          kind: "login",
          domain: normalizeHost(item.domain),
          label: item.label || "",
          username: item.username,
          password: item.password,
          pinned: Boolean(item.pinned),
          lastUsedAt: Number(item.lastUsedAt) || 0,
          updatedAt: Number(item.updatedAt) || Date.now()
        },
        key
      )
    );
  }

  return migrated;
}
