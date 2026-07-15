# Workflow Playbooks

## Feature build

1. Define acceptance criteria.
2. Inspect status and instructions.
3. Map architecture and existing patterns.
4. Identify state/persistence/backend/platform impact.
5. Inspect current tests.
6. Implement the smallest complete solution.
7. Add regression tests.
8. Run targeted checks.
9. Run affected broader checks.
10. Inspect final diff.
11. Independent review when meaningful.
12. Update docs/checkpoint.

## Root-cause debug

1. Define symptom and expected behavior.
2. Reproduce or collect strongest evidence.
3. Trace the entire relevant flow.
4. Inspect state transitions, async boundaries, persistence, adapters, and errors.
5. Rank hypotheses.
6. Falsify each with targeted evidence.
7. Identify root cause before editing.
8. Implement smallest complete fix.
9. Add regression test.
10. Run affected checks.
11. Review indirect impact.
12. Report root cause separately from patch.

## UI polish

1. Define user problem—not merely “make modern.”
2. Capture existing behavior at key widths.
3. Identify design tokens and shared components.
4. Fix hierarchy, spacing, states, responsiveness, and accessibility.
5. Avoid arbitrary one-off values.
6. Test keyboard and reduced motion.
7. Verify real content and long text.
8. Capture before/after evidence.
9. Run visual/browser regression checks.

## Supabase/RLS change

1. Identify actors and allowed actions.
2. Inspect existing schema, policies, functions, triggers, and clients.
3. Create a new migration.
4. Use default deny.
5. Verify ownership and auth assumptions.
6. Test two users/two browser contexts.
7. Test direct client attempts, not only UI.
8. Check service-role boundary.
9. Verify backward compatibility.
10. Document migration and rollback limitations.

## AI-provider change

1. Identify provider abstraction.
2. Define mock/live behavior.
3. Trace model resolution and family safety.
4. Preserve current selected content and state.
5. Implement streaming/cancel/retry/timeout.
6. Validate output.
7. Bound repair.
8. Test mock and live separately.
9. Test provider failure and fallback.
10. Verify labels and user-visible errors.

## Android/Capacitor change

1. Identify source-of-truth web code/config.
2. Map native adapter behavior.
3. Change source, not generated output.
4. Sync native project using verified command.
5. Run web tests/build.
6. Run Android build.
7. Verify emulator behavior.
8. Verify physical-device lifecycle/back/deep-link/share/browser.
9. Record pending device checks honestly.

## Release verification

1. Read release checklist.
2. Inspect status and diff.
3. Determine affected boundaries.
4. Run cheap targeted checks.
5. Run full required automated checks.
6. Investigate failures with focused excerpts.
7. Verify critical browser/user flows.
8. Review secrets, dependencies, migrations, RLS, accessibility, PWA, Android.
9. Separate automated/browser/device evidence.
10. Produce one verdict.
