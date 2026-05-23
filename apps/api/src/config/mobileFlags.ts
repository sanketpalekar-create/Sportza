type MobileMapsProvider = "mappls" | "google" | "none";

function parseBooleanFlag(raw: string | undefined, fallback = false): boolean {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function parseMapsProvider(raw: string | undefined): MobileMapsProvider {
  const normalized = (raw ?? "mappls").trim().toLowerCase();
  if (normalized === "google") return "google";
  if (normalized === "none") return "none";
  return "mappls";
}

/**
 * Lightweight env-driven mobile compatibility flags.
 * These are intentionally read once at startup to keep behavior predictable.
 */
export const mobileFlags = {
  authMobileV2: parseBooleanFlag(process.env.AUTH_MOBILE_V2, false),
  paymentsMobileSdk: parseBooleanFlag(process.env.PAYMENTS_MOBILE_SDK, false),
  pushMobileTokens: parseBooleanFlag(process.env.PUSH_MOBILE_TOKENS, false),
  mapsMobileProvider: parseMapsProvider(process.env.MAPS_MOBILE_PROVIDER),
  deeplinkMobileRoutes: parseBooleanFlag(process.env.DEEPLINK_MOBILE_ROUTES, false),
} as const;

export type MobileFlags = typeof mobileFlags;
