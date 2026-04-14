import { createClient } from "@supabase/supabase-js";

const GLOBAL_CLIENT_CACHE_KEY = "__quickPassSupabaseClientCache";
const SUPABASE_AUTH_STORAGE_PREFIX = "supabaseAuth";
const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

function getGlobalCache() {
  if (!globalThis[GLOBAL_CLIENT_CACHE_KEY]) {
    globalThis[GLOBAL_CLIENT_CACHE_KEY] = {
      client: null,
      key: ""
    };
  }
  return globalThis[GLOBAL_CLIENT_CACHE_KEY];
}

export async function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY
  };
}

export async function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  const cache = getGlobalCache();
  const identity = `${SUPABASE_URL}::${SUPABASE_ANON_KEY}`;
  if (cache.client && cache.key === identity) {
    return cache.client;
  }

  const authStorageKey = buildAuthStorageKey(SUPABASE_URL);
  cache.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: authStorageKey,
      storage: createChromeStorageAdapter(authStorageKey)
    }
  });
  cache.key = identity;
  return cache.client;
}

function normalizeSupabaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function buildAuthStorageKey(url) {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch (_error) {
    throw new Error("Project URL ของ Supabase ไม่ถูกต้อง");
  }

  const safeHost = hostname.replace(/[^a-z0-9.-]/gi, "-");
  return `quick-pass-supabase-auth:${safeHost}`;
}

function createChromeStorageAdapter(namespace) {
  const prefix = `${SUPABASE_AUTH_STORAGE_PREFIX}:${namespace}:`;

  return {
    async getItem(key) {
      const storageKey = `${prefix}${key}`;
      const result = await chrome.storage.local.get([storageKey]);
      const value = result[storageKey];
      return typeof value === "string" ? value : null;
    },
    async setItem(key, value) {
      await chrome.storage.local.set({
        [`${prefix}${key}`]: String(value)
      });
    },
    async removeItem(key) {
      await chrome.storage.local.remove(`${prefix}${key}`);
    }
  };
}
