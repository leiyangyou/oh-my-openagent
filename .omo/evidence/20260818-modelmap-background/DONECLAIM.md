# DoneClaim: Modelmap Background Admission PR 2

## Delivered

- Background category and direct-agent launches carry immutable unresolved route intent into the queue.
- Queue admission resolves once after initial capacity acquisition, records the `post-initial-capacity` linearization point, and performs at most one transfer to the pinned normalized key.
- Active and fallback attempts retain the linearized route, concurrency, revision, and fallback provenance through retries and terminal cleanup.
- Task tool metadata reports the admitted model and structured modelmap provenance.

## Evidence

- RED: `red-background-admission.txt`
- Linearization GREEN: `final-linearization-focused.txt`
- Wider targeted GREEN: `final-focused-after-build.txt`
- Repeated races: `repeated-linearization-20x.txt`
- Typecheck: `final-typecheck.txt`
- Build: `final-build.txt`
- Bun 1.3.12 Codex gate: `final-codex-bun-1.3.12.txt`
- Live OpenCode verdict: `live/qa-verdict.json`
- Isolation: `live/isolation-verdict.json`
- Exact base comparison: `codex-installer-version-branch.txt` and `codex-installer-version-origin-dev.txt`
- Reviewer summary: `QA-SUMMARY.md`

## Boundary

This claim covers PR 2 late-bound background admission only. No PR 3 scope was started.
