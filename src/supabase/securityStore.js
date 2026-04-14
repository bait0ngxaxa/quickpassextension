import { getSupabaseClient } from "./client.js";

export async function readCloudSecurityProfile() {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error, profile: null };
  }

  const sessionResult = await getSupabaseSession(clientResult.client);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error, profile: null };
  }

  const { data, error } = await clientResult.client
    .from("vault_security_profiles")
    .select("strategy, iterations, verifier, updated_at")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message, profile: null };
  }

  if (!data) {
    return { ok: true, error: "", profile: null };
  }

  return {
    ok: true,
    error: "",
    profile: {
      strategy: data.strategy || "",
      iterations: Number(data.iterations) || 0,
      verifier: data.verifier || null,
      updatedAt: data.updated_at || ""
    }
  };
}

export async function saveCloudSecurityProfile(profile) {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error };
  }

  const sessionResult = await getSupabaseSession(clientResult.client);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  const { error } = await clientResult.client.from("vault_security_profiles").upsert(
    {
      user_id: sessionResult.userId,
      strategy: profile.strategy || "",
      iterations: Number(profile.iterations) || 0,
      verifier: profile.verifier || null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: "" };
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
