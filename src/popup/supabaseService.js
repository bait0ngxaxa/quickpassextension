import { getSupabaseClient, getSupabaseConfig } from "../supabase/client.js";

export async function readSupabaseSetup() {
  const config = await getSupabaseConfig();
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return {
      config: config || { url: "", anonKey: "" },
      sessionEmail: "",
      setupError: clientResult.error
    };
  }

  const client = clientResult.client;
  if (!client) {
    return {
      config: config || { url: "", anonKey: "" },
      sessionEmail: "",
      setupError: ""
    };
  }

  const {
    data: { session }
  } = await client.auth.getSession();
  return {
    config: config || { url: "", anonKey: "" },
    sessionEmail: session?.user?.email || "",
    setupError: ""
  };
}

export async function signOutSupabase() {
  const clientResult = await requireSupabaseClient();
  const client = clientResult.client;
  if (!client) {
    return;
  }
  await client.auth.signOut();
}

export async function signInWithOAuthProvider(provider) {
  const clientResult = await requireSupabaseClient();
  if (clientResult.error) {
    return { ok: false, error: clientResult.error };
  }

  const client = clientResult.client;
  if (!client) {
    return { ok: false, error: "ยังไม่ได้ตั้งค่า Supabase URL และ anon key" };
  }

  const redirectTo = chrome.identity.getRedirectURL();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true
    }
  });

  if (error || !data?.url) {
    return { ok: false, error: error?.message || "ไม่สามารถเริ่ม OAuth flow ได้" };
  }

  const callbackUrl = await launchOAuthFlow(data.url);
  if (!callbackUrl) {
    return { ok: false, error: "OAuth ถูกยกเลิกหรือไม่สำเร็จ (ไม่ได้ callback URL)" };
  }

  const callback = parseOAuthCallback(callbackUrl);
  if (callback.errorMessage) {
    return { ok: false, error: callback.errorMessage };
  }

  let sessionError = null;
  if (callback.code) {
    const { error } = await client.auth.exchangeCodeForSession(callback.code);
    sessionError = error;
  } else if (callback.accessToken && callback.refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: callback.accessToken,
      refresh_token: callback.refreshToken
    });
    sessionError = error;
  } else {
    return { ok: false, error: "ไม่พบ code/token จาก OAuth callback" };
  }

  if (sessionError) {
    return { ok: false, error: sessionError.message };
  }

  const setup = await readSupabaseSetup();
  return { ok: true, error: "", sessionEmail: setup.sessionEmail };
}

async function launchOAuthFlow(url) {
  return new Promise((resolve) => {
    chrome.identity.launchWebAuthFlow(
      {
        url,
        interactive: true
      },
      (callbackUrl) => {
        if (chrome.runtime.lastError) {
          resolve(`error://oauth?error_description=${encodeURIComponent(chrome.runtime.lastError.message || "unknown")}`);
          return;
        }
        resolve(callbackUrl || "");
      }
    );
  });
}

function parseOAuthCallback(callbackUrl) {
  try {
    if (callbackUrl.startsWith("error://oauth")) {
      const fallback = new URL(callbackUrl);
      return {
        code: "",
        accessToken: "",
        refreshToken: "",
        errorMessage: `launchWebAuthFlow: ${fallback.searchParams.get("error_description") || "unknown"}`
      };
    }

    const url = new URL(callbackUrl);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const queryParams = new URLSearchParams(url.search);
    const errorDescription =
      hashParams.get("error_description") || queryParams.get("error_description") || "";
    const errorCode = hashParams.get("error") || queryParams.get("error") || "";

    return {
      code: queryParams.get("code") || "",
      accessToken: hashParams.get("access_token") || queryParams.get("access_token") || "",
      refreshToken: hashParams.get("refresh_token") || queryParams.get("refresh_token") || "",
      errorMessage: errorCode ? `${errorCode}${errorDescription ? `: ${errorDescription}` : ""}` : ""
    };
  } catch (_error) {
    return { code: "", accessToken: "", refreshToken: "", errorMessage: "callback URL ไม่ถูกต้อง" };
  }
}

async function requireSupabaseClient() {
  try {
    const client = await getSupabaseClient();
    return { client, error: "" };
  } catch (error) {
    return {
      client: null,
      error: error instanceof Error ? error.message : "ไม่สามารถเริ่มต้น Supabase client ได้"
    };
  }
}
