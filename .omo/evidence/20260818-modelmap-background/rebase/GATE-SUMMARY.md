# Post-Rebase Gate Summary

- Focused admission/ownership: 18 passed, 0 failed across four files.
- Race repetition: 20 iterations, six passed per iteration, 120 total test executions, 0 failed.
- Wider targeted: 1,335 passed, 0 failed across 120 files.
- Full `packages/omo-opencode`: 8,392 passed, one stable skip, 0 failed across 993 files.
- Typecheck: exit 0 under Bun 1.3.12.
- Build: exit 0 under Bun 1.3.12.
- Codex gate: 97 and 422 Vitest passes; 78 and 417 Bun passes with one skip in the 418-test stage; 519 Node passes; 0 failures.
- Installer version/freshness: three passed, 0 failed against the restored tracked beta.8 bundle.
- Full root: 15,819 passed, 13 stable skips, 0 failed across 2,065 files.
- Diff hygiene before evidence refresh: working diff and `origin/dev...HEAD` both passed `git diff --check`.
- Real OpenCode: `mapped-old`, `mapped-new`, and `fallback-old` observed; host DB 874 before and after; isolated DB five sessions; Codex checksum unchanged.
