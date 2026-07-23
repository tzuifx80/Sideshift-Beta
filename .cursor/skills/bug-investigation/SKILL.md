---
name: bug-investigation
description: Diagnoses SideShift bugs by separating symptoms from root cause before editing. Use when fixing failures, regressions, flaky tests, auth/session issues, AI provider errors, or Android persistence problems.
---

# Bug Investigation

## Workflow

1. Reproduce or collect strongest evidence (error, test output, logs, user steps).
2. Separate symptom from root cause; define expected vs actual behaviour.
3. Inspect affected boundaries: React state, `src/data/`, Worker responses, Supabase RLS, Capacitor lifecycle.
4. Form ranked hypotheses; test the cheapest first.
5. Implement the smallest safe correction once root cause is confirmed.
6. Add regression coverage at the correct layer (unit, integration, or script).
7. Verify neighbouring behaviour was not broken.
8. Do not randomly edit files until the failure disappears.

## Evidence required

- Reproduction steps or why reproduction was not possible.
- Root cause stated separately from the patch.
- Hypotheses ruled out.
- Validation run and results.

## Stop conditions

- Root cause identified with regression test and passing targeted checks, or
- Evidence shows external blocker (rate limit, missing deploy, device unavailable) with documented next step.

## Key references

- Auth/session: `src/auth/`, `src/logout.ts`
- AI errors: `src/lib/ai/errors.ts`, `worker/src/index.ts`
- Turn/state: `src/lib/ai/turnState.ts`, `src/drafts.ts`
- API config: `src/data/apiConfig.ts`
