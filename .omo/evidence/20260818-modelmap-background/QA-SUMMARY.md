# Modelmap Background Admission QA

## What Was Tested

- Eighteen focused model-map and background-admission tests covering single-resolution linearization, exact capacity ownership, cancellation before the admission continuation resumes, FIFO behavior, explicit-model precedence, and pinned fallback routes.
- Twenty consecutive runs of the deterministic admission race suite, without sleeps or retry-count production logic.
- The wider model-map, background-agent, task, and call-omo-agent command passed 1,335 tests with zero failures.
- Root typecheck, build, and the Bun 1.3.12 Codex compatibility gate.
- Real OpenCode 1.18.18 through an isolated server and local Responses API with provider concurrency set to one. One child occupied the old route, a second child queued, the workspace switched presets, and the first child then entered fallback.

## What Was Observed

- The final linearization suite passed 18 tests with zero failures. The wider targeted command passed 1,335 tests with zero failures.
- Typecheck and build exited successfully. `bunx bun@1.3.12 run test:codex` completed with zero failures across its Bun, Vitest, and Node test stages.
- The active child reached the provider as `mapped-old` at workspace revision 0.
- The queued child reached the provider as `mapped-new` at workspace revision 1 and never requested `mapped-old`.
- The failed active child reached the provider as `fallback-old`. The retained live artifact proves the provider request; focused attempt-history tests prove that its revision remains pinned to the admitted route.
- Both `task` tool events exposed structured `modelMap` metadata including source, scope, revision, preset, mapped key, and concurrency key.
- The real host OpenCode database remained at 835 sessions before and after. The isolated database contained five QA sessions. The real Codex config checksum was unchanged.

## Why This Is Enough

The focused suites prove one immutable route resolution after initial capacity admission, at most one transfer to that pinned route, exact release ownership, cancellation cleanup, and fallback route immutability. The live run proves old-active and new-queued routing at the OpenCode tool, session, queue, command, and provider boundaries. The provider artifact is intentionally not described as independent attempt-history metadata.

## Broad-Suite Constraint

- A package-wide Bun 1.3.7 scan passed 8,390 tests and failed two Atlas continuation timing tests. Both named tests pass when isolated on this branch and on `origin/dev`, so they are not attributed to PR 2.
- Bun 1.3.12 root fail-fast remains red outside PR 2. The generated Codex installer version test produces the same beta.8 expected versus beta.7 embedded mismatch on this branch and exact `origin/dev`; the paired artifacts preserve that comparison.
- No secrets, auth headers, full provider prompts, or configuration contents were retained. Provider evidence was reduced to model and prompt-role observations.
