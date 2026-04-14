import { getSupabaseClient } from "./client.js";

export async function listEncryptedVaultItems() {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error, items: [] };
  }

  const sessionResult = await getSupabaseSession(clientResult.client);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error, items: [] };
  }

  const { data, error } = await clientResult.client
    .from("vault_items")
    .select("id, kind, domain, label, pinned, last_used_at, updated_at, cipher_json")
    .order("updated_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message, items: [] };
  }

  return {
    ok: true,
    error: "",
    items: (data || []).map(fromVaultRow)
  };
}

export async function upsertEncryptedVaultItems(items) {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error, count: 0 };
  }

  const sessionResult = await getSupabaseSession(clientResult.client);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error, count: 0 };
  }

  const rows = (items || []).filter((item) => item?.id).map((item) => toVaultRow(item, sessionResult.userId));
  if (!rows.length) {
    return { ok: true, error: "", count: 0 };
  }

  const { error } = await clientResult.client.from("vault_items").upsert(rows, { onConflict: "id" });
  if (error) {
    return { ok: false, error: error.message, count: 0 };
  }

  return { ok: true, error: "", count: rows.length };
}

export async function deleteVaultItem(id) {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error };
  }

  const sessionResult = await getSupabaseSession(clientResult.client);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const { error } = await clientResult.client.from("vault_items").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: "" };
}

async function getSupabaseSession(client) {
  const {
    data: { session }
  } = await client.auth.getSession();
  const userId = session?.user?.id || "";
  if (!userId) {
    return { ok: false, error: "ยังไม่ได้ login Supabase", userId: "" };
  }
  return { ok: true, error: "", userId };
}

async function requireSupabaseClient() {
  try {
    const client = await getSupabaseClient();
    if (!client) {
      return { client: null, error: "ยังไม่ได้ตั้งค่า Supabase URL และ anon key" };
    }
    return { client, error: "" };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error.message : "ไม่สามารถเริ่มต้น Supabase client ได้"
    };
  }
}

function toVaultRow(item, userId) {
  const updatedAtIso = item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString();
  const lastUsedAtIso = item.lastUsedAt ? new Date(item.lastUsedAt).toISOString() : null;

  const {
    id,
    kind,
    domain,
    label,
    pinned,
    usernameCipher,
    usernameIv,
    passwordCipher,
    passwordIv,
    secretNameCipher,
    secretNameIv,
    secretValueCipher,
    secretValueIv
  } = item;

  return {
    id,
    user_id: userId,
    kind: kind || "login",
    domain: domain || "",
    label: label || "",
    pinned: Boolean(pinned),
    last_used_at: lastUsedAtIso,
    updated_at: updatedAtIso,
    cipher_json: {
      usernameCipher: usernameCipher || null,
      usernameIv: usernameIv || null,
      passwordCipher: passwordCipher || null,
      passwordIv: passwordIv || null,
      secretNameCipher: secretNameCipher || null,
      secretNameIv: secretNameIv || null,
      secretValueCipher: secretValueCipher || null,
      secretValueIv: secretValueIv || null
    }
  };
}

function fromVaultRow(row) {
  const cipher = row.cipher_json || {};
  return {
    id: row.id,
    kind: row.kind || "login",
    domain: row.domain || "",
    label: row.label || "",
    pinned: Boolean(row.pinned),
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).getTime() : 0,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    usernameCipher: cipher.usernameCipher || null,
    usernameIv: cipher.usernameIv || null,
    passwordCipher: cipher.passwordCipher || null,
    passwordIv: cipher.passwordIv || null,
    secretNameCipher: cipher.secretNameCipher || null,
    secretNameIv: cipher.secretNameIv || null,
    secretValueCipher: cipher.secretValueCipher || null,
    secretValueIv: cipher.secretValueIv || null
  };
}
