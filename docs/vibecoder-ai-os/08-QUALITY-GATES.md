# Quality Gates

## Gate 0 — Scope

- Acceptance criteria defined.
- Existing changes identified.
- Affected boundaries mapped.
- No silent scope expansion.

## Gate 1 — Implementation

- Smallest complete change.
- No unrelated refactor.
- Shared logic reused.
- Dependencies justified.
- Generated files handled correctly.

## Gate 2 — Targeted verification

- Regression test added/updated.
- Targeted tests pass.
- Failure paths tested.
- State/persistence verified.

## Gate 3 — Repository health

As relevant:

- unit tests,
- type-check,
- lint,
- production build,
- integration tests,
- browser/E2E,
- database verification,
- dependency audit,
- secret scan.

## Gate 4 — User behavior

- loading/empty/error/offline/unavailable states,
- refresh/recovery,
- keyboard/accessibility,
- responsive layouts,
- mock/live honesty,
- two-user flows,
- PWA behavior,
- Android behavior.

## Gate 5 — Independent review

Required for:

- auth/security,
- RLS/migrations,
- data-loss risk,
- provider architecture,
- broad state refactors,
- release-critical work.

## Gate 6 — Final diff

- diff stat understood,
- relevant hunks reviewed,
- no unexpected files,
- no secrets,
- no accidental formatting wave,
- no unrelated deletion.

## Gate 7 — Documentation

- current status updated,
- known limitations explicit,
- release checklist accurate,
- checkpoint complete.

## Verdicts

### READY

All required evidence completed successfully.

### READY_WITH_DOCUMENTED_LIMITATIONS

No blocking defect, but explicitly documented manual checks or bounded limitations remain.

### NOT_READY

One or more blockers remain, required evidence failed, or behavior is uncertain in a high-risk boundary.
