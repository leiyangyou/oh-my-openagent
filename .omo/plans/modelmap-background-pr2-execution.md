# Modelmap PR 2 Execution Plan

## Scope

Implement only late-bound background admission from the Boulder modelmap plan. Team runtime, mailbox, team live delivery, public modelmap commands, and PR 1 scope semantics remain unchanged.

## Design

1. Add a model-map-owned immutable background launch intent and captured attempt route. The intent contains native routing facts only: session, route kind/key, base or explicit model, and fallback chain. Admission calls the existing controller resolver, so session/workspace/global and explicit/map/base precedence stay in one module.
2. Resolve a queued intent after a capacity slot is acquired and immediately before first-attempt session creation. If the resolved normalized key differs, release the exact acquired key and acquire the new key. Repeat only when a strictly newer route revision changes the normalized key; unchanged or older revisions cannot cause another transfer.
3. Record capacity ownership synchronously when a FIFO waiter receives a slot. This closes the cancellation race between waiter resolution and the awaiting manager continuation. Terminal paths release only the key recorded on the current attempt/task projection.
4. Capture model, fallback chain, route source/scope/preset/revision, and normalized concurrency key on the admitted attempt. A fallback attempt derives from that captured route and never calls the model-map controller again.
5. Keep synchronous dispatch behavior unchanged. Background adapters pass unresolved intent plus the native base route. Launches without an intent, including explicit callers outside these adapters, retain existing behavior.

## Planned Files

- `packages/omo-opencode/src/features/model-map/background-admission.ts`: immutable intent creation, admission capture, fallback-attempt derivation, and revision-progress invariant.
- `packages/omo-opencode/src/features/model-map/types.ts`: launch intent, captured route, and controller admission-facing types.
- `packages/omo-opencode/src/features/model-map/index.ts`: export the new deep-module interface.
- `packages/omo-opencode/src/features/model-map/background-admission.test.ts`: pure policy tests for immutable capture, explicit precedence, revision progress, and fallback pinning.
- `packages/omo-opencode/src/features/background-agent/types.ts`: minimal route intent, captured route, admission target, and attempt ownership fields.
- `packages/omo-opencode/src/features/background-agent/constants.ts`: queue item ownership/admission fields if required by the manager seam.
- `packages/omo-opencode/src/features/background-agent/concurrency.ts`: synchronous acquisition callback for exact ownership transfer and cancellation safety.
- `packages/omo-opencode/src/features/background-agent/attempt-lifecycle.ts`: project captured route and capacity ownership through the current attempt.
- `packages/omo-opencode/src/features/background-agent/manager.ts`: narrow admission callback, transfer loop, cancellation cleanup, and first-attempt capture.
- `packages/omo-opencode/src/features/background-agent/fallback-retry-handler.ts`: derive retry attempts from the pinned captured route without scope resolution.
- `packages/omo-opencode/src/features/background-agent/background-admission-characterization.test.ts`: pre-change FIFO, key normalization, cancellation, and fallback characterization.
- `packages/omo-opencode/src/features/background-agent/background-admission.test.ts`: manager-level late revision, transfer, pinning, cancellation, repeated changes, no duplicate start, and unchanged-key FIFO scenarios.
- `packages/omo-opencode/src/create-managers.ts`: inject the existing model-map controller into the background manager.
- `packages/omo-opencode/src/tools/delegate-task/tools.ts` and `background-task.ts`: preserve sync resolution but pass unresolved category/agent intent for background work.
- `packages/omo-opencode/src/tools/call-omo-agent/tools.ts` and `background-executor.ts`: preserve sync resolution but pass unresolved direct-agent intent for background work.
- Focused existing tests beside changed adapters and manager construction will be updated only where their typed contracts require it.
- `.omo/evidence/20260818-modelmap-background/`: baseline, RED, GREEN, live OpenCode, DB isolation, diagnostics, gates, cleanup, and final ledger.

## TDD Sequence

1. Add characterization tests for current FIFO handoff, normalized-key ownership, cancellation, and fallback queue behavior. Run them against `4a53431de` production code and capture passing output.
2. Add pure model-map admission tests and manager/adapter tests for every requested PR 2 scenario. Run before production changes and capture failures caused by missing admission behavior.
3. Implement the model-map admission module to GREEN its pure tests.
4. Implement the concurrency ownership callback and manager adapter to GREEN transfer/cancellation/FIFO tests.
5. Wire unresolved intents from both background dispatch adapters and GREEN explicit/base/map precedence tests.
6. Pin retry route state and GREEN active-attempt/fallback/next-task tests.

## Verification

- Focused baseline and RED/GREEN commands under `packages/omo-opencode/src/features/model-map/`, `features/background-agent/`, `tools/delegate-task/`, and `tools/call-omo-agent/`.
- Repeat timing-sensitive queue/admission tests at least 20 times with a bounded shell loop.
- `lsp_diagnostics` for every changed TypeScript file plus the repository TypeScript no-excuse audit.
- `bun test packages/omo-opencode/src/features/model-map packages/omo-opencode/src/features/background-agent packages/omo-opencode/src/tools/delegate-task packages/omo-opencode/src/tools/call-omo-agent`.
- `bun test packages/omo-opencode`.
- `bun run typecheck`.
- `bun run build`.
- `bun run test:codex` only if a shared config/runtime contract is touched; otherwise record why omitted.
- Bounded full `bun test`.
- Real isolated OpenCode with model/provider concurrency one: occupy the initial slot, queue a mapped task, change the session map, release the first slot, and assert the second request/task metadata use the new model and revision. Trigger a retry and assert it remains on the captured chain while a later independent task uses the new revision.
- Record real OpenCode DB session counts before/after, structured requests and task metadata, rapid-map/cancel/stale-state probes, process/port/tmux cleanup, and unchanged real Codex config hash.

## Commit Plan

Commit boundaries will follow the repository's semantic English style and pair implementation with direct tests:

1. Characterization tests and baseline evidence.
2. Model-map admission types/policy and policy tests.
3. Background concurrency/attempt lifecycle integration and manager tests.
4. Background dispatch adapter wiring and adapter tests.
5. Reviewer-readable QA/gate evidence and final ledger.

The exact groups will be recalculated from the final touched-file set before staging. No commit will mix team-mode or PR 3 work.

## Adversarial Remediation

1. Add a deterministic sustained-revision test whose resolver produces a different route on every invocation and races a prompt signal against a second resolution signal. Current code must lose to the second resolution without timers; fixed code must prompt after one resolution.
2. Define admission linearization as the single route resolution after the initial queued capacity wait. Pin that immutable route before any stale-key transfer, release the initial key once, and acquire the pinned route key without resolving again.
3. Count release/acquire effects in tests so the initial stale key and final pinned key each have exactly one ownership lifecycle. Re-run cancellation, start-error, duplicate-prompt, and unchanged normalized-key FIFO coverage.
4. Sanitize committed evidence whitespace, retain only claims backed by route/attempt metadata and reduced provider observations, and regenerate final-head inventory and cleanup receipts.
5. Run focused and scoped suites, twenty repeated race runs, typecheck, build, Bun 1.3.12 Codex tests, pinned root fail-fast, and an exact `origin/dev` comparison for the unchanged beta installer mismatch.
