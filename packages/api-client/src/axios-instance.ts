import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { clearStoredAuthState, emitUnauthorizedEvent, getStoredAccessToken, storeAccessToken } from "./platform-adapter";

// Base URL is injected at app startup via setApiBaseUrl() (called in main.tsx).
// The hardcoded fallback is only used if the app bootstraps without calling setApiBaseUrl.
const DEFAULT_API_URL = "http://localhost:5000/api";

export const apiClient = axios.create({
  baseURL: DEFAULT_API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

// ─── Request interceptor: attach access token ────────────────────────────────

apiClient.interceptors.request.use(async (config) => {
  const token = await getStoredAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: auto-refresh on 401 ──────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null) {
  refreshQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  refreshQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/refresh") &&
      !originalRequest.url?.includes("/auth/login") &&
      !originalRequest.url?.includes("/auth/verify-otp") &&
      !originalRequest.url?.includes("/auth/verify-phone-otp") &&
      !originalRequest.url?.includes("/auth/google")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiClient.post<{ token: string }>("/auth/refresh");
        const newToken = data.token;

        await storeAccessToken(newToken);
        setAuthToken(newToken);
        processQueue(null, newToken);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Refresh failed — clear session and notify app
        await clearStoredAuthState();
        setAuthToken(null);
        await emitUnauthorizedEvent();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401) {
      await emitUnauthorizedEvent();
    }

    return Promise.reject(error);
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const promise = apiClient(config).then(({ data }: AxiosResponse<T>) => data);
  return promise;
};

export function setApiBaseUrl(url: string) {
  apiClient.defaults.baseURL = url;
}

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common["Authorization"];
  }
}

export default apiClient;
