# Atlas Aggregate Timing QA

## What was tested

- Focused Atlas hook suite: `bunx bun@1.3.12 test packages/omo-opencode/src/hooks/atlas/index.test.ts`.
- Full repository aggregate suite: `bunx bun@1.3.12 test`.
- Repository gates: `bun run typecheck` and `bun run build`.
- Real OpenCode SSE smoke: `bash scripts/sse-hook-probe.sh --self-test` from the `opencode-qa` skill against OpenCode 1.18.18.
- The intended behavior was deterministic Atlas idle/failure/backoff testing with no accidental network request to the fixture's `http://localhost` SDK base URL.

## What was observed

- Before the repair, the focused Atlas file took 34.55 seconds and the exact `origin/dev` aggregate run failed two Atlas tests at Bun's five-second per-test deadline.
- After installing an explicit SDK-shaped inactive `session.status` mock and adding keyed busy-route coverage, the focused Atlas file passed 75 tests with 144 assertions in 2.26 seconds.
- The two keyed busy-route tests passed independently in 380 ms.
- The repaired full aggregate run passed 15,821 tests, skipped 13, and failed 0 across 2,065 files in 737.45 seconds.
- Typecheck and build both exited 0.
- The isolated OpenCode server emitted `server.connected`; a direct host SQLite count remained 1,011 immediately before and after the isolated probe.
- Exact aggregate output is stored in `root-bun-1.3.12.txt`.
- Exact gate and isolation outputs are stored in `atlas-focused.txt`, `atlas-busy-routes.txt`, `typecheck.txt`, `build.txt`, `sse-hook-probe-self-test.txt`, and `host-db-isolation-rerun.txt`.

## Why it is enough

- The focused suite proves the fixture still exercises Atlas continuation semantics.
- The full single-process root run reproduces the same aggregate conditions that previously triggered the timeout and now completes without failure.
- The real OpenCode SSE smoke confirms the harness event surface boots in an isolated XDG sandbox without adding a host session.
- No production behavior, timeout, retry count, or assertion was changed.

## Independent review

- Goal and constraint verification: PASS.
- Hands-on QA execution: PASS.
- Code quality review: PASS after correcting the SDK response shape and adding keyed busy-route coverage.
- Security review: PASS with no findings attributable to this patch.
- Repository and GitHub context mining: PASS with no missed companion change.

## What was omitted

- No credentials, tokens, authentication headers, environment dumps, or private session content were captured.
