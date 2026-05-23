import * as SecureStore from "expo-secure-store";
import {
  apiClient,
  setApiBaseUrl,
  setApiClientPlatformAdapter,
} from "@sportza/api-client";
import { emitUnauthorized } from "./authEvents";

const ACCESS_TOKEN_KEY = "auth_token";
const AUTH_STATE_KEYS = [
  "auth_token",
  "sportza_user",
  "sportza_token",
  "sportza_active_role",
] as const;

let apiClientInitialized = false;

export async function getStoredAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearStoredAuthState() {
  await Promise.all(AUTH_STATE_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}

export function initializeApiClient() {
  if (apiClientInitialized) return;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
  setApiBaseUrl(apiUrl);

  setApiClientPlatformAdapter({
    getAccessToken: async () => getStoredAccessToken(),
    setAccessToken: async (token: string) => {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
    },
    clearAuthState: async () => {
      await clearStoredAuthState();
    },
    notifyUnauthorized: () => {
      emitUnauthorized();
    },
  });

  apiClientInitialized = true;
}

export async function validateCurrentSession() {
  const token = await getStoredAccessToken();
  if (!token) return false;

  try {
    await apiClient.get("/auth/me");
    return true;
  } catch {
    return false;
  }
}
