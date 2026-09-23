# Task Completion Checklist

Before treating any code change in this repo as done:
1. `npx tsc --noEmit` — must report 0 errors.
2. `npm test` — must be fully green. `PROGRESS.md` tracks the exact green count for each run; treat
   any drop from the last recorded count as a regression to explain, not as "good enough."
3. `npm run build` — required for anything touching Client/Server Component boundaries or config
   (`next.config`, `tailwind.config.ts`); `tsc` + `vitest` passing has missed build-only breakage here
   before (e.g. a Client Component boundary issue).
4. For UI changes: verify in a real browser (Playwright, or the Claude Code browser pane), not just by
   reading code. This project has repeatedly caught real visual regressions (text overlap, collapsed
   whitespace) that type-checking and unit tests did not catch.

Cultural norm specific to this project: a pipeline stage should independently re-run 1-3 itself rather
than trust a prior stage's report of "tests pass" — the reviewer stage here has caught real staleness
(a fix that looked complete but only covered part of the affected viewport/range) by re-verifying
instead of trusting the handoff.
