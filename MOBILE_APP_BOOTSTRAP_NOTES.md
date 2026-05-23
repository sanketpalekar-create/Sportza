# Mobile App Bootstrap Notes

Created a new Expo + TypeScript mobile foundation under `apps/mobile` for migration work, without running interactive scaffolding commands.

## Created files

- `apps/mobile/package.json`
- `apps/mobile/app.json`
- `apps/mobile/tsconfig.json`
- `apps/mobile/expo-env.d.ts`
- `apps/mobile/index.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/providers/AppProviders.tsx`
- `apps/mobile/src/providers/queryClient.ts`
- `apps/mobile/src/providers/ThemeProvider.tsx`
- `apps/mobile/src/theme/theme.ts`
- `apps/mobile/src/screens/SplashScreen.tsx`
- `apps/mobile/src/screens/LoginScreen.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/README.md`

## App foundation details

- Added Expo app entry and root app component.
- Added native stack navigation shell with simple splash/login/home routing.
- Added React Query provider and theme placeholder provider.
- Added starter placeholder screens for migration.
- Added scripts for `start`, `android`, `ios`, and `typecheck`.

## Workspace config changes

No workspace-level config changes were required.
`pnpm-workspace.yaml` already includes `apps/*`, so `apps/mobile` is automatically included.

## Next setup commands

Run from repository root:

```bash
pnpm install
pnpm --filter @sportza/mobile start
pnpm --filter @sportza/mobile typecheck
```

Optional platform run commands:

```bash
pnpm --filter @sportza/mobile android
pnpm --filter @sportza/mobile ios
```
