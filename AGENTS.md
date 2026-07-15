# Project Working Rules

- Application code and tests are the primary source of truth.
- Confirm commands against package scripts and configuration.
- Preserve current user changes and avoid unrelated refactors.
- Map affected UI, state, persistence, backend, tests, PWA, and Android boundaries.
- Preserve selected content, drafts, debate state, and refresh recovery.
- Keep AI mock/live labels accurate and never present simulation as a real human.
- Treat Supabase RLS as default deny and verify behavior as actual users.
- Never expose service-role credentials client-side.
- Use existing design tokens, localization, responsive patterns, and shared logic.
- Include loading, empty, unavailable, offline, and error states.
- Separate automated, browser, emulator, and physical-device verification.
- Update docs/CODEX_CHECKPOINT.md before compaction or handoff.
