# Backend Mobile Compatibility

This document describes backend foundations added for native mobile support while keeping existing web APIs intact.

## Goals

- Preserve current web push subscription behavior.
- Introduce mobile-ready feature flags (env-driven).
- Add a dedicated mobile push token contract for iOS/Android clients.

## Feature Flags

The API reads mobile flags from environment variables via `apps/api/src/config/mobileFlags.ts`.

- `AUTH_MOBILE_V2` (boolean, default `false`)
- `PAYMENTS_MOBILE_SDK` (boolean, default `false`)
- `PUSH_MOBILE_TOKENS` (boolean, default `false`)
- `MAPS_MOBILE_PROVIDER` (`mappls` | `google` | `none`, default `mappls`)
- `DEEPLINK_MOBILE_ROUTES` (boolean, default `false`)

`apps/api/.env.example` includes all of these entries.

## Endpoints

### Existing web push contract (unchanged)

- `POST /api/push-subscriptions`
- `DELETE /api/push-subscriptions`
- `GET /api/push-subscriptions/vapid-public-key`

These remain browser-oriented and backward-compatible.

### New mobile push token contract

- `POST /api/mobile-push-tokens`
  - Auth required (`Bearer` token).
  - Body:
    - `platform`: `"ios"` or `"android"` (required)
    - `token`: string (required)
    - `appVersion`: string (required)
    - `deviceId`: string (optional)
  - Returns:
    - `200` `{ success: true, message: "Mobile push token registered" }`
    - `503` when `PUSH_MOBILE_TOKENS=false`

## Rollout Notes

1. Deploy backend with `PUSH_MOBILE_TOKENS=false` first (safe no-op for mobile writes).
2. Run DB migration to create `mobile_push_tokens`.
3. Turn `PUSH_MOBILE_TOKENS=true` in environments where mobile clients are ready.
4. Keep web clients on `/api/push-subscriptions` unchanged.

## Data Model

New table: `mobile_push_tokens`

- Stores native device tokens separately from web push subscriptions.
- Supports token refreshes and optional stable `deviceId` updates.
- Enforces uniqueness by `(userId, platform, token)`.
