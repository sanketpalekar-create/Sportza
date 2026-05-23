type MaybePromise<T> = T | Promise<T>;

export interface ApiClientPlatformAdapter {
  getAccessToken: () => MaybePromise<string | null>;
  setAccessToken: (token: string) => MaybePromise<void>;
  clearAuthState: () => MaybePromise<void>;
  notifyUnauthorized: () => MaybePromise<void>;
}

const AUTH_STORAGE_KEYS = ["auth_token", "sportza_user", "sportza_token", "sportza_active_role"] as const;

function getStorage() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.localStorage ?? null;
}

function getWindowObject() {
  if (typeof globalThis === "undefined") return null;
  return globalThis.window ?? null;
}

export const defaultWebPlatformAdapter: ApiClientPlatformAdapter = {
  getAccessToken: () => {
    const storage = getStorage();
    return storage?.getItem("auth_token") ?? null;
  },
  setAccessToken: (token) => {
    const storage = getStorage();
    storage?.setItem("auth_token", token);
  },
  clearAuthState: () => {
    const storage = getStorage();
    if (!storage) return;
    AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
  },
  notifyUnauthorized: () => {
    const windowObject = getWindowObject();
    if (!windowObject) return;
    windowObject.dispatchEvent(new CustomEvent("auth:unauthorized"));
  },
};

let platformAdapter: ApiClientPlatformAdapter = defaultWebPlatformAdapter;

export function setApiClientPlatformAdapter(adapter: ApiClientPlatformAdapter) {
  platformAdapter = adapter;
}

export function resetApiClientPlatformAdapter() {
  platformAdapter = defaultWebPlatformAdapter;
}

export function getApiClientPlatformAdapter() {
  return platformAdapter;
}

export async function getStoredAccessToken() {
  return platformAdapter.getAccessToken();
}

export async function storeAccessToken(token: string) {
  await platformAdapter.setAccessToken(token);
}

export async function clearStoredAuthState() {
  await platformAdapter.clearAuthState();
}

export async function emitUnauthorizedEvent() {
  await platformAdapter.notifyUnauthorized();
}
