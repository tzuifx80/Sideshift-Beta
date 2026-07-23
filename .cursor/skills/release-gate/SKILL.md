---
name: release-gate
description: Runs the SideShift private-beta release verification using real repository scripts and records a readiness verdict. Use before v0.2 handoff, APK distribution, or production deploy.
---

# Release Gate

Read-only audit unless fixing release-blocking script issues is explicitly requested.

## Procedure

1. `git status` — no unintended secrets, `.env`, `dist/`, or APK artifacts staged.
2. `npm run validate:env` when environment files are available.
3. `npm run typecheck`
4. `npm run lint`
5. Targeted then full relevant tests (`npm test`, subsystem scripts as applicable).
6. `npm run api:worker:test`
7. `npm run api:worker:verify -- <HTTPS_WORKER_URL>` when configured (never placeholder URL).
8. `npm run audit:frontend-secrets`
9. `npm run build` with real production configuration.
10. `npm run android:build:verify` when Android is in scope.
11. Record APK path: `android/app/build/outputs/apk/debug/app-debug.apk`
12. Summarize known limitations, rollback steps, and manual device checks remaining.

## Verdicts

- **READY** — automated gate passed; manual checks documented if any remain.
- **READY_WITH_DOCUMENTED_LIMITATIONS** — shippable with explicit gaps.
- **NOT_READY** — blocking failure with evidence.

## Stop conditions

- Verdict issued with command evidence, or
- Blocked on missing production credentials/deploy (document exact blocker).

## References

- `docs/RELEASE_CHECKLIST.md`
- `docs/exec-plans/v0.2-private-beta.md`
- `worker/README.md`
