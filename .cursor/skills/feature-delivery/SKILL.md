---
name: feature-delivery
description: Implements a bounded SideShift behaviour change end-to-end with acceptance criteria, targeted tests, and honest verification. Use when adding or changing product behaviour, user flows, API integration, or v0.2 beta milestones.
---

# Feature Delivery

## Workflow

1. Clarify the user outcome and affected surfaces (UI, repository, Worker, Android).
2. Inspect current implementation in `src/`, `worker/`, and relevant tests.
3. Define acceptance criteria (observable, testable).
4. Identify the smallest complete vertical slice; one write owner per state domain.
5. Implement without unrelated cleanup or redesign.
6. Add or update targeted tests near changed code.
7. Run validation per `.cursor/rules/60-testing.mdc`.
8. Review the actual diff.
9. Update `docs/CODEX_CHECKPOINT.md` or `docs/exec-plans/v0.2-private-beta.md` when milestone state changes.
10. Report limitations, manual checks, and exact next action.

## Evidence required

- Changed files list.
- Tests run and outcomes.
- Checks not run and why.
- Any manual device/browser steps still needed.

## Stop conditions

- Acceptance criteria met with passing targeted validation, or
- Blocked on explicit approval (migration, dependency, secret, deploy), or
- Honest partial delivery with documented gaps.

## Key references

- Repository: `src/data/selectRepository.ts`, `src/data/repository.ts`
- Auth: `src/auth/authFlow.ts`
- AI debate: `src/lib/ai/basicProvider.ts`, `src/features/classic-debate/`
- API: `src/data/apiConfig.ts`, `worker/src/index.ts`
