# Sportza — Brand

**Version:** 1.1  
**Last updated:** Apr 2026

---

## Product name

**Sportza** (title case)

---

## Taglines

| Use | Text |
|-----|------|
| **Cultural / hero** | **हर दिन. Game On.** (Hindi + English) |
| **Functional** | **Book. Train. Track.** |

---

## Logo

- **Logo mark:** Rounded square with stylized “S” (two curved shapes). Use on light background (blue on white) or dark background (white on dark blue).
- **Asset:** `apps/web/public/logo.png` — used as favicon, app icon (apple-touch-icon), navbar logo, and on login/register and home hero. When rendering, use `object-position: 51% 52%` for optical centering of the inner “S”.
- **Wordmark:** “Sportza” — sans-serif; the “z” can be styled in an accent blue.
- **Full lockup:** Logo mark + wordmark; tagline **हर दिन. Game On.** below when needed.

---

## Where branding is applied

- **App:** Client title and meta description (Sportza, tagline).
- **API:** Health check message (“Sportza API is running”).
- **Docs:** Document titles and headers use “Sportza” where the product name is shown.
- **Package:** `package.json` name `sportza`, description includes tagline.

---

## Built with

Sportza is built as a **Turborepo monorepo** with pnpm: **apps/web** (Vite + React + Tailwind + Auth0 + TanStack Query), **apps/api** (Express + Prisma + Zod + OpenAPI + Redis + BullMQ), **packages/tokens**, **packages/ui**, **packages/api-client**.

---

## Related

- **Navigation and UX:** `docs/NAVIGATION.md`
- **Document index:** `docs/TRACEABILITY.md`
