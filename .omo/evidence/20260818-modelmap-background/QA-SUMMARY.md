# Modelmap Background Admission QA

## What Was Tested

- Scoped model-map, background-agent, task, and call-omo-agent tests, including late admission, repeated revision transfer, cancellation, FIFO behavior, explicit-model precedence, and pinned fallback routes.
- Twenty consecutive runs of the admission race suites.
- Root typecheck and build.
- Real OpenCode 1.18.18 through an isolated server and local Responses API with provider concurrency set to one. One child occupied the old route, a second child queued, the workspace switched presets, and the first child then entered fallback.

## What Was Observed

- The final focused suite passed 587 tests with zero failures. The wider scoped suite passed 1,333 tests with zero failures.
- Typecheck and build exited successfully.
- The active child reached the provider as `mapped-old` at workspace revision 0.
- The queued child reached the provider as `mapped-new` at workspace revision 1 and never requested `mapped-old`.
- The failed active child retried as `fallback-old`, proving the retry continued from its captured fallback route rather than re-resolving through the new preset.
- Both `task` tool events exposed structured `modelMap` metadata including source, scope, revision, preset, mapped key, and concurrency key.
- The real host OpenCode database remained at 826 sessions before and after. The isolated database contained five QA sessions. The real Codex config checksum was unchanged.

## Why This Is Enough

The unit and race suites pin ownership transfer, monotonic revision progress, cancellation cleanup, and route immutability. The live run proves the same behavior at the OpenCode tool, session, queue, command, and provider boundaries, including the concurrency-one handoff that creates the race this change fixes.

## Broad-Suite Constraint

- `bun test` was attempted serially. Task-related tests stayed green, but unrelated root/vendored tests failed under installed Bun 1.3.7, including Vitest APIs unavailable through Bun, web Playwright discovery, generated installer drift, and root Bun-config assertions.
- This repository requires Bun 1.3.12. Installing it through mise was blocked by the environment's exhausted unauthenticated GitHub API rate limit. The prior base-branch evidence also records unrelated root-suite failures under Bun 1.3.12.
- No secrets, auth headers, full provider prompts, or configuration contents were retained. Provider evidence was reduced to model and prompt-role observations.
