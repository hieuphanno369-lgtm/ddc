# Tech Stack

- Next.js 15.5.26 (App Router; nâng lên ≥ 15.5.24 trước go-live, merge 2026-09-27) + React 19.3.0 + TypeScript 5.5.4. `cookies()`/`headers()` là async.
- next-intl 4.14.7 — locales vi/en, routing config in `src/i18n/` (`routing.ts`/`navigation.ts`/`request.ts`), pages under `app/[locale]/...`.
- next-auth 4.24.15 — credentials + Google OAuth (chỉ email có trong danh sách tài khoản; cần GOOGLE_CLIENT_ID/SECRET khi deploy).
- Prisma 6.19.3 + Postgres 16.6, LOCAL DEV at `localhost:5433` (non-default port) — db `ddc_control_tower`.
- Recharts 2.15.4 (charts). exceljs 4.4.0 is the ONLY Excel engine for app code (import + export; `.xls` no longer accepted since P2A). `xlsx` 0.18.5 is still in package.json but no app code imports it — don't reintroduce it (known CVEs). `jszip` is a dependency (pending owner decision whether to keep).
- Zod 4.6.5 (validation, `src/server/validation.ts`). bcryptjs 3.0.3 (password hashing).
- Tailwind 3.4.10 + design tokens in `app/tokens.css` / `tailwind.config.ts`. Gotcha: a unitless numeric token (e.g. duration `'180'` instead of a value using `var(--dur-fast)`) compiles to invalid CSS with no build/type error — browser silently ignores the declaration. Verify token wiring visually, not just via `tsc`/build success.
- Vitest 2.1.1 (`npm test` = `vitest run`). Tests are co-located as `*.test.ts` next to the source they cover.
