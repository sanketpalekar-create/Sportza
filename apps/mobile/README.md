# Sportza Mobile Bootstrap

This directory contains a minimal Expo + TypeScript foundation for the Sportza mobile migration.

## What is included

- Expo app entry (`index.ts`, `App.tsx`)
- Root navigation shell with stack flow:
  - `Splash` -> `Login` -> `Home`
- Providers:
  - React Query provider
  - Theme placeholder provider/context
  - Safe area provider
- Placeholder screens:
  - Splash
  - Login
  - Home

## Install and run

From the repository root:

```bash
pnpm install
set EXPO_PUBLIC_API_URL=http://localhost:5000/api
pnpm --filter @sportza/mobile start
```

Optional platform commands:

```bash
pnpm --filter @sportza/mobile android
pnpm --filter @sportza/mobile ios
```

Type-check:

```bash
pnpm --filter @sportza/mobile typecheck
```

## Next migration steps

1. Replace `LoginScreen` placeholder with real OTP/password/Google auth flow.
2. Add auth actions that persist access token through the configured secure-storage adapter.
3. Split navigation into dedicated auth/app stacks once route list is finalized.
4. Start migrating venue discovery + booking flows using `@sportza/api-client` hooks.
