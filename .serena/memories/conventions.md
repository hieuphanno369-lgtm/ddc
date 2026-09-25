# Project Conventions

## Delivery pipeline and `.bangiao/` (NOT app code)
Work is delivered through Claude Code subagents named `ddc-tower:*` (e.g. planner→coder→tester→
debugger→security-reviewer→reviewer for a "ship" run; scout→architect→plan-critic for planning;
qa-gate→release-manager→canary-watch for go-live). Each run's working artifacts live in `.bangiao/`:
- `ke-hoach.md` = plan, `thay-doi.md` = change/diff summary, `ket-qua-test.md` = test results,
  `danh-gia-bao-mat.md` = security review, `danh-gia.md` = final review verdict ("CHỐT" = accepted,
  "CẦN SỬA" = needs fixing, capped at 2 fix rounds before stopping to ask the human).
- `checkpoint.md` = hand-written resume note for a session cut off by a usage limit — never commit it.
- `archive/<run-name>-<date>/` = a finished run's artifacts moved aside (committed). Before merging a phase
  branch into `main`, all root `.bangiao/*.md` must be moved into archive so `main`'s `.bangiao/` root stays empty.

## Two parallel accounts (A / B)
Two git worktrees work in parallel (A: `D:\_project\DDC_Control_Tower`, port 3000, db `ddc_control_tower`; B:
`...-B`, port 3001, db `ddc_control_tower_b`). Coordination files live outside the repo in `D:\_project\DDC_dieu-phoi\`
(`lo-trinh.md`, `phien-A.md`/`phien-B.md`, `quy-trinh.md` = merge procedure). Hot files (schema/migrations,
`globals.css`, `vi.json`/`en.json`, `actions.ts`, `prisma-repo.ts`, `queries.ts`, `project-queries.ts`) must be
"held" in the session file before editing; only the holder of `schema.prisma` may create migrations. Merge to
`main` = `git push . HEAD:main` (fast-forward only, no checkout). `PROGRESS.md` and `.serena/memories/` are only
updated in the merge-to-main turn, never on a phase branch. New i18n keys go in a feature-specific group object.
- Canonical, durable project status/history lives in root `PROGRESS.md`, not in `.bangiao/`. Read
  `PROGRESS.md` first when resuming work; `.bangiao/` is per-run scratch that gets archived away.

## Commit message style
Conventional Commits prefix (`feat(...)`, `fix(...)`, `chore(...)`, `docs(...)`) + a Vietnamese
description WITHOUT diacritics, e.g. `fix(glass): va B-1..B-5 ... chip null-safe + mau SPI hero`.
Match this style — don't switch to accented Vietnamese or English prose in commit subjects.

## Seed/test credentials
Seed account passwords (e.g. the admin/viewer dev logins) get referenced in `.bangiao/` review docs
and `docs/README_NON_TECH.md`. Treat any seed password as sensitive-by-convention in new docs — mask
it (e.g. `Admin@***`) even though it's a low-value dev credential. `.gitignore` excludes
`.playwright-mcp/` and `.obsidian/` specifically because a Playwright MCP snapshot once leaked a seed
password into a committable directory — don't remove those two entries without knowing why they're there.
