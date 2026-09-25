# Suggested Commands (Windows)

Developed on Windows. PowerShell is the primary shell; a POSIX Bash tool is also available — don't mix
PowerShell and bash syntax within one command.

- Dev server: `npm run dev` (Next.js on :3000). Usually already running in the user's own terminal —
  check before starting or killing one.
- Type check: `npx tsc --noEmit`
- Run `npm test`/`npx vitest` from PowerShell with an uppercase drive (`D:\_project\...`). From Git Bash
  (`/d/_project/...`) Vitest falsely reports "no test suite found" en masse (Windows path case bug).
- Tests: `npm test` (= `vitest run`, single pass) / `npm run test:watch` (watch mode)
- Build: `npm run build`
- Prisma: `npx prisma migrate dev` (create+apply a migration locally) / `npx prisma migrate status`
  (check drift — don't assume a migration needs applying without checking) / `npx prisma migrate deploy`
  (apply pending migrations, no new one created). DB: Postgres on `localhost:5433` (not default 5432),
  db `ddc_control_tower`.
- Seed: `npx prisma db seed` (runs `prisma/seed.ts`, wired via `package.json` → `prisma.seed`).
- npm tarball download fails with `SELF_SIGNED_CERT_IN_CHAIN` (corporate TLS interception; `npm view` still works).
  Fix without weakening TLS: export Windows trusted roots (`Cert:\LocalMachine\Root`, `CurrentUser\Root`,
  `LocalMachine\CA`) to a PEM and set `NODE_EXTRA_CA_CERTS=<pem>` for the npm process. Never use
  `NODE_TLS_REJECT_UNAUTHORIZED=0` / `strict-ssl=false`.
- Stopping a dev server: kill by PID (`netstat -ano | findstr :3000`), NEVER `taskkill /IM node.exe`
  (kills the other account's dev server and node-based MCP servers).
- `next dev -H 127.0.0.1` breaks every request (500) on Next 14 with middleware — use Windows Firewall instead.
