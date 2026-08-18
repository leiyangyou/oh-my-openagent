# Worktree Ledger

## Branch

- Branch: `feature/modelmap-background`
- Repaired base and merge-base: `origin/dev` at `74ac1401e3ce539e43cf3bb4743ac7d4fd85d429`
- Rebased product head: `33080cafd9133839c281c9f0bd43fc6293468ea4`
- Pre-refresh rebased branch head: `f8e918d369eb39a003b9ef1169cfb0f68268c88f`
- Ahead of repaired base before new evidence commits: 12 local commits

## PR 2 Commits

- `d93a139ed` `feat(model-map): resolve background routes at admission`
- `f26eda020` `test(model-map): record background admission QA`
- `eef8b719d` `docs(model-map): add PR 2 done claim`
- `09b09dd85` `fix(model-map): linearize background admission routes`
- `14cd82220` `fix(background-agent): pin admission before capacity transfer`
- `33080cafd` `test(background-agent): cover linearized admission races`

## Rebased Evidence Commits

- `fa94578ea` `test(model-map): refresh focused verification evidence`
- `c6de127de` `test(model-map): record compatibility gate evidence`
- `c0327ef4b` `test(model-map): refresh live admission evidence`
- `1ba5aba3f` `test(model-map): sanitize legacy QA artifacts`
- `3a71ef661` `docs(model-map): finalize linearization evidence ledger`
- `f8e918d36` `test(model-map): sanitize final gate artifacts`

## Scope

- Product changes remain under `packages/omo-opencode/src/features/model-map/`, `packages/omo-opencode/src/features/background-agent/`, and the original PR 2 adapter/tool wiring.
- Evidence and execution-plan changes remain under `.omo/evidence/20260818-modelmap-background/` and `.omo/plans/modelmap-background-pr2-execution.md`.
- No team runtime, mailbox, PR 3, package version, Codex product, or Senpi product change is included.
- The repaired beta.8 installer is inherited from `origin/dev`; no installer bundle path appears in the PR 2 diff.
