# API Client Platform Adapters

`packages/api-client` now supports platform-specific auth storage and unauthorized handling through an injectable adapter.

## Why this exists

The API client previously depended directly on browser APIs (`localStorage` and `window.dispatchEvent`) inside axios interceptors and auth hooks. That made reuse in non-web runtimes (for example, mobile apps with secure storage) difficult.

The new adapter keeps existing web behavior by default while allowing apps to inject their own implementation.

## Default behavior (no migration required for web)

If you do nothing, the API client uses `defaultWebPlatformAdapter`, which matches previous behavior:

- Reads `auth_token` from `localStorage` when attaching auth headers.
- Stores refreshed `auth_token` after `/auth/refresh`.
- Clears `auth_token`, `sportza_user`, `sportza_token`, and `sportza_active_role` on logout/session clear paths.
- Dispatches `auth:unauthorized` on `window` for unauthorized flows.

## Public API

Import from `@sportza/api-client` (or your local package alias):

- `setApiClientPlatformAdapter(adapter)`
- `getApiClientPlatformAdapter()`
- `resetApiClientPlatformAdapter()`
- `defaultWebPlatformAdapter`
- `ApiClientPlatformAdapter` (type)

Adapter shape:

```ts
type MaybePromise<T> = T | Promise<T>;

interface ApiClientPlatformAdapter {
  getAccessToken: () => MaybePromise<string | null>;
  setAccessToken: (token: string) => MaybePromise<void>;
  clearAuthState: () => MaybePromise<void>;
  notifyUnauthorized: () => MaybePromise<void>;
}
```

## Mobile adapter example

```ts
import {
  setApiClientPlatformAdapter,
  type ApiClientPlatformAdapter,
} from "@sportza/api-client";
import * as SecureStore from "expo-secure-store";

const mobileAdapter: ApiClientPlatformAdapter = {
  async getAccessToken() {
    return SecureStore.getItemAsync("auth_token");
  },
  async setAccessToken(token) {
    await SecureStore.setItemAsync("auth_token", token);
  },
  async clearAuthState() {
    await Promise.all([
      SecureStore.deleteItemAsync("auth_token"),
      SecureStore.deleteItemAsync("sportza_user"),
      SecureStore.deleteItemAsync("sportza_token"),
      SecureStore.deleteItemAsync("sportza_active_role"),
    ]);
  },
  notifyUnauthorized() {
    // Bridge into your app's auth/session flow.
    // Example: event emitter, global store action, or navigation reset.
  },
};

setApiClientPlatformAdapter(mobileAdapter);
```

## Migration notes

- Existing web apps do not need code changes.
- For non-web clients, call `setApiClientPlatformAdapter(...)` early in app startup (before authenticated requests).
- Backend endpoints and request shapes are unchanged.
