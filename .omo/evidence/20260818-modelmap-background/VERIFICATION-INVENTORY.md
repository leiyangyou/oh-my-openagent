# Verification Inventory

Implementation head: `4bb3670d4ef05a85527b38d4ab542ea3924dc257`

## Branch-Owned Gates

- `bun test` on the four linearization and ownership files: 18 passed, 0 failed. Artifact: `final-linearization-focused.txt`.
- Twenty consecutive deterministic ownership-race runs: passed. Artifact: `repeated-linearization-20x.txt`.
- Wider model-map, background-agent, task, and call-omo-agent command: 1,335 passed, 0 failed. Artifact: `final-focused-after-build.txt`.
- `bun run typecheck`: exit 0. Artifact: `final-typecheck.txt`.
- `bun run build`: exit 0. Artifact: `final-build.txt`.
- `bunx bun@1.3.12 run test:codex`: exit 0 across Vitest, Bun, and Node stages. Artifact: `final-codex-bun-1.3.12.txt`.
- Isolated real OpenCode run: passed old-active, new-queued, fallback-provider, structured route metadata, host DB isolation, and Codex checksum checks. Artifacts: `live/qa-verdict.json`, `live/provider-observations.json`, and `live/isolation-verdict.json`.
- `git diff --check origin/dev`: exit 0 after evidence sanitation.

## Non-Branch Failures

- The package-wide Bun 1.3.7 scan passed 8,390 tests and failed two Atlas continuation timing tests. Both named tests pass in isolation on this branch and exact `origin/dev`. Artifacts: `green-scoped-suite-final.txt`, `atlas-failures-branch.txt`, and `atlas-failures-origin-dev.txt`.
- Bun 1.3.12 root fail-fast remains red outside PR 2. Artifacts: `final-root-bun-1.3.12.txt` and `origin-dev-root-bun-1.3.12.txt`.
- The focused generated-installer version test fails identically on this branch and exact `origin/dev`: root expects beta.8 while the tracked bundle embeds beta.7. Artifacts: `codex-installer-version-branch.txt` and `codex-installer-version-origin-dev.txt`.

## Omitted

- The LSP tool rejected worktree paths outside its request working directory. Repository and package typechecks were used as the diagnostics substitute.
- Raw provider payloads, auth headers, tokens, complete prompts, and environment dumps were not retained.
