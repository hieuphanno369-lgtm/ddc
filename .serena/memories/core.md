# DDC Control Tower — Core Map

Next.js 14 App Router app (Vietnamese ERP / project-progress dashboard). Root layout:
- `app/` = routes only, at repo root (NOT `src/app`). `app/[locale]/(app)/...` = authenticated shell pages (overview, projects, projects/[id], report, alerts, compliance, audit, admin, import, data-dictionary, data-schema, nhap-lieu). `app/[locale]/login` and `app/[locale]/not-found` sit outside the `(app)` group (no shell). `app/api/*` = route handlers.
- `src/lib/` = pure business logic (clock, evm, stages, daily-series, thresholds, format, password, rate-limit, uploads, activity, session).
- `src/server/` = data access + server actions (`queries.ts`, `project-queries.ts`, `actions.ts`, `authz.ts`, `validation.ts`, `report.ts`) plus `src/server/repo/` (repo abstraction).
- `src/components/` = UI grouped by domain (dashboard, admin, alerts, form, layout, project, ui).
- `prisma/` = `schema.prisma`, `migrations/`, `seed.ts`, `rls.sql` (RLS policy defined but not yet applied to the DB).

Invariants:
- Repo abstraction: import through `src/server/repo/index.ts`, never `prisma-repo.ts`/`mock-repo.ts` directly. `mock-repo.ts` (sync, in-memory) backs tests; `prisma-repo.ts` (async) backs the real DB — keep both in sync via `src/server/repo/types.ts` when the interface changes.
- Clock is virtualized: read "today" via `src/lib/clock.ts`, never `new Date()` in business logic. `DDC_FAKE_TODAY` override is guarded to non-production only.
- Fact/progress tables are append-only: rows carry `version`/`isLatest`, never UPDATE-in-place.
- Per-project read authz goes through `src/server/authz.ts` (`requireProjectRead()`) — Admin/BOD see all projects, Data-entry/Viewer only projects listed in `project_assignments`. This was retrofitted after most routes already existed — verify a given route actually calls it, don't assume.
- Manpower is stored PER SHIFT (`fact_daily_manpower.shiftCode` → `dim_shift`, open-ended code list, currently `morning`/`afternoon`); daily totals = sum of shifts (`src/lib/shifts.ts`, done in the repo layer). Never add fixed per-shift columns.
- Photo uploads: both entry points (`addPhotoAction`, `POST /api/photo-upload`) go through `addPhotoForUser` (`src/server/photo-service.ts`); file type is decided by magic bytes (`detectImageKind` in `src/lib/uploads.ts`), never by client MIME/filename.
- Finance visibility is fail-closed (`canViewFinance ?? false`); pages must self-check role, not rely on middleware alone.
- 4 roles: Admin, BOD, Data-entry, Viewer. Auth = next-auth v4 credentials + Google OAuth stub (no CLIENT_ID set, not live).

More: `mem:tech_stack` (deps/versions/DB), `mem:conventions` (workflow + code conventions, `.bangiao/` pipeline artifacts), `mem:suggested_commands` (Windows-specific commands), `mem:task_completion` (done-criteria for a coding task).
