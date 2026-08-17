# DoneClaim: Modelmap Background Admission PR 2

## Delivered

- Background category and direct-agent launches carry immutable unresolved route intent into the queue.
- Queue admission resolves the current modelmap revision, transfers normalized capacity when the route changes, and requires strictly newer revisions for repeated transfers.
- Active attempts retain captured route, concurrency, and fallback provenance through retries and terminal cleanup.
- Task tool metadata reports the admitted model and structured modelmap provenance.

## Evidence

- RED: `red-background-admission.txt`
- Scoped GREEN: `green-scoped-suite-final.txt`
- Repeated races: `repeated-admission-20x.txt`
- Final focused GREEN: `final-focused-after-build.txt`
- Typecheck: `final-typecheck.txt`
- Build: `final-build.txt`
- Live OpenCode verdict: `live/qa-verdict.json`
- Isolation: `live/isolation-verdict.json`
- Reviewer summary: `QA-SUMMARY.md`

## Boundary

This claim covers PR 2 late-bound background admission only. No PR 3 scope was started.
