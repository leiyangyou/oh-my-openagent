# No-Excuses Parameter Declaration Repair

## Objective

Prevent the TypeScript no-excuses checker from crashing when it encounters a typed function parameter under TypeScript 7.

## Changes

1. Extend `check-no-excuse-rules.test.ts` with a clean fixture containing a typed parameter and assert the checker exits successfully.
2. Run the focused test before implementation and capture the expected `ts.isParameter is not a function` failure.
3. Replace the invalid parameter-node predicate in `check-no-excuse-rules.ts` with the supported TypeScript API predicate.
4. Re-run the focused test, the checker against the modelmap changed files, diagnostics, and typecheck.
5. Record reviewer-readable RED/GREEN evidence under `.omo/evidence/20260818-no-excuses-parameter/`.
6. Commit the implementation and its regression atomically, open a PR against `dev`, wait for required checks, merge with a merge commit, then rebase the blocked modelmap branch.

## Success Criteria

- The new regression fails before the implementation change for the observed runtime error.
- The checker accepts typed parameters without weakening any no-excuses rule.
- Existing violation detection still reports `as any` with exit 1.
- Focused tests, diagnostics, and typecheck pass.
- The repair lands through a merge commit before modelmap verification resumes.
