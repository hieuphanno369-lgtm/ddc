# Suggested Commands (Windows)

Developed on Windows. PowerShell is the primary shell; a POSIX Bash tool is also available — don't mix
PowerShell and bash syntax within one command.

- Dev server: `npm run dev` (Next.js on :3000). Usually already running in the user's own terminal —
  check before starting or killing one.
- Type check: `npx tsc --noEmit`
- Tests: `npm test` (= `vitest run`, single pass) / `npm run test:watch` (watch mode)
- Build: `npm run build`
- Prisma: `npx prisma migrate dev` (create+apply a migration locally) / `npx prisma migrate status`
  (check drift — don't assume a migration needs applying without checking) / `npx prisma migrate deploy`
  (apply pending migrations, no new one created). DB: Postgres on `localhost:5433` (not default 5432),
  db `ddc_control_tower`.
- Seed: `npx prisma db seed` (runs `prisma/seed.ts`, wired via `package.json` → `prisma.seed`).
