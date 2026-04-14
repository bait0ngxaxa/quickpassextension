import { webcrypto } from "node:crypto";

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, "binary").toString("base64");
}

if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(value, "base64").toString("binary");
}

export function installMockChrome(initialState = {}) {
  const state = {
    local: new Map(Object.entries(initialState.local || {})),
    session: new Map(Object.entries(initialState.session || {}))
  };

  globalThis.chrome = {
    storage: {
      local: createStorageArea(state.local),
      session: createStorageArea(state.session)
    }
  };

  return {
    reset() {
      state.local.clear();
      state.session.clear();
    },
    dump(area) {
      return Object.fromEntries(state[area].entries());
    }
  };
}

function createStorageArea(store) {
  return {
    async get(keys) {
      if (Array.isArray(keys)) {
        return keys.reduce((result, key) => {
          result[key] = store.has(key) ? store.get(key) : undefined;
          return result;
        }, {});
      }

      if (typeof keys === "string") {
        return {
          [keys]: store.has(keys) ? store.get(keys) : undefined
        };
      }

      if (keys && typeof keys === "object") {
        return Object.entries(keys).reduce((result, [key, fallback]) => {
          result[key] = store.has(key) ? store.get(key) : fallback;
          return result;
        }, {});
      }

      return Object.fromEntries(store.entries());
    },
    async set(items) {
      for (const [key, value] of Object.entries(items || {})) {
        store.set(key, value);
      }
    },
    async remove(keys) {
      const values = Array.isArray(keys) ? keys : [keys];
      values.forEach((key) => store.delete(key));
    }
  };
}
