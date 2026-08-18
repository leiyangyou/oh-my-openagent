# Verification Inventory

Repaired base: `74ac1401e3ce539e43cf3bb4743ac7d4fd85d429`

Rebased product head: `33080cafd9133839c281c9f0bd43fc6293468ea4`

Pre-refresh rebased branch head: `f8e918d369eb39a003b9ef1169cfb0f68268c88f`

## Branch-Owned Gates

- Bun 1.3.12 focused linearization and ownership suite: 18 passed, 0 failed. Artifact: `rebase/focused-18.txt`.
- Twenty consecutive deterministic ownership-race runs: 20 iterations, six tests per iteration, zero failures. Artifact: `rebase/race-20x.txt`.
- Wider model-map, background-agent, task, and call-omo-agent command: 1,335 passed, 0 failed. Artifact: `rebase/wider-targeted.txt`.
- Full `packages/omo-opencode`: 8,392 passed, one stable skip, 0 failed across 993 files. Artifact: `rebase/omo-opencode-full.txt`.
- `bunx bun@1.3.12 run typecheck`: exit 0. Artifact: `rebase/typecheck.txt`.
- `bunx bun@1.3.12 run build`: exit 0. Artifact: `rebase/build.txt`.
- `bunx bun@1.3.12 run test:codex`: exit 0 across Vitest, Bun, and Node stages. Artifact: `rebase/codex-gate.txt`.
- Installer version/freshness against the restored tracked beta.8 bundle: three passed, 0 failed. Artifact: `rebase/installer-version-freshness-tracked.txt`.
- Full Bun 1.3.12 root suite: 15,819 passed, 13 stable skips, 0 failed across 2,065 files. Artifact: `rebase/root-full.txt`.
- Isolated real OpenCode run: passed old-active, new-queued, fallback-provider, structured route metadata, host DB isolation, and Codex checksum checks. Artifacts: `live/qa-verdict.json`, `live/provider-observations.json`, and `live/isolation-verdict.json`.
- `git diff --check` and `git diff --check origin/dev...HEAD`: exit 0 before evidence refresh.
- Merge-base and `origin/dev` both resolve to `74ac1401e`; the PR 2 diff contains no `packages/omo-codex` installer bundle change.

## Stable Skips

- The package suite reported one stable skip and the full root suite reported 13 stable skips. Both commands exited 0 with no failures.

## Omitted

- The LSP tool rejected worktree paths outside its request working directory. Repository and package typechecks were used as the diagnostics substitute.
- Raw provider payloads, auth headers, tokens, complete prompts, and environment dumps were not retained.
