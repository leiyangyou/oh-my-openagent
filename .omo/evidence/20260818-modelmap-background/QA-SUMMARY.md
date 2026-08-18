# Modelmap Background Admission QA

## What Was Tested

- The 12 local PR 2 commits were rebased without conflicts onto repaired `origin/dev` at `74ac1401e3ce539e43cf3bb4743ac7d4fd85d429`.
- Eighteen focused model-map and background-admission tests covering single-resolution linearization, exact capacity ownership, cancellation before the admission continuation resumes, FIFO behavior, explicit-model precedence, and pinned fallback routes.
- Twenty consecutive runs of the deterministic admission race suite, without sleeps or retry-count production logic.
- The wider model-map, background-agent, task, and call-omo-agent command passed 1,335 tests with zero failures.
- The full `packages/omo-opencode` suite, root typecheck, build, Codex compatibility gate, installer version/freshness tests, and full root suite under Bun 1.3.12.
- Real OpenCode 1.18.18 through an isolated server and local Responses API with provider concurrency set to one. One child occupied the old route, a second child queued, the workspace switched presets, and the first child then entered fallback.

## What Was Observed

- The final linearization suite passed 18 tests with zero failures. The wider targeted command passed 1,335 tests with zero failures.
- Twenty race iterations each passed six tests, for 120 passing race executions and zero failures.
- The full `packages/omo-opencode` suite passed 8,392 tests, reported one stable skip, and had zero failures.
- Typecheck and build exited successfully. The Codex gate passed 97 and 422 Vitest tests, 78 and 417 Bun tests with one skip in the 418-test stage, and 519 Node tests, with zero failures.
- Installer version/freshness passed three tests. The full root suite passed 15,819 tests, reported 13 stable skips, and had zero failures across 2,065 files.
- The active child reached the provider as `mapped-old` at workspace revision 0.
- The queued child reached the provider as `mapped-new` at workspace revision 1 and never requested `mapped-old`.
- The failed active child reached the provider as `fallback-old`. The retained live artifact proves the provider request; focused attempt-history tests prove that its revision remains pinned to the admitted route.
- Both `task` tool events exposed structured `modelMap` metadata including source, scope, revision, preset, mapped key, and concurrency key.
- The real host OpenCode database remained at 874 sessions before and after. The isolated database contained five QA sessions. The real Codex config checksum was unchanged.
- The merge-base equals repaired `origin/dev`, the tracked installer embeds beta.8, and the PR 2 diff contains no installer bundle change.

## Why This Is Enough

The focused suites prove one immutable route resolution after initial capacity admission, at most one transfer to that pinned route, exact release ownership, cancellation cleanup, and fallback route immutability. The live run proves old-active and new-queued routing at the OpenCode tool, session, queue, command, and provider boundaries. The provider artifact is intentionally not described as independent attempt-history metadata.

## Stable Skips And Omitted Data

- The package and root suites reported one and 13 existing stable skips respectively; neither suite reported a failure.
- No secrets, auth headers, full provider prompts, or configuration contents were retained. Provider evidence was reduced to model and prompt-role observations.
