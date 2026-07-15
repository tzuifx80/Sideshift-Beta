# Repository Instructions

> Replace every `[VERIFY]` placeholder using actual repository evidence. Do not keep invented commands.

## Purpose

[VERIFY: one paragraph describing the product and repository.]

## Sources of truth

- Executable code and tests override stale documentation.
- Package scripts and configuration define valid commands.
- Applied database migrations are immutable history.
- Nested AGENTS.md files add boundary-specific rules.

## Architecture map

- Entry point: `[VERIFY]`
- Navigation/routing: `[VERIFY]`
- State and persistence: `[VERIFY]`
- AI provider boundary: `[VERIFY]`
- Authentication: `[VERIFY]`
- Human challenge flow: `[VERIFY]`
- Supabase/migrations/RLS: `[VERIFY]`
- PWA/service worker: `[VERIFY]`
- Capacitor/Android: `[VERIFY]`
- Tests: `[VERIFY]`

## Verified commands

- Install: `[VERIFY]`
- Development: `[VERIFY]`
- Targeted test: `[VERIFY]`
- Unit tests: `[VERIFY]`
- Type-check: `[VERIFY]`
- Lint: `[VERIFY]`
- Build: `[VERIFY]`
- Integration/database: `[VERIFY]`
- Browser/E2E: `[VERIFY]`
- Native sync/build: `[VERIFY]`

## Discovery

- Use repository graph/MCP first only on compatible profiles.
- Narrow direct inspection using graph results.
- For shell-only models, use targeted search and exact file reads.
- Do not perform broad recursive listings without need.

## Change workflow

- define acceptance criteria,
- reproduce or establish evidence,
- map impact,
- implement smallest complete change,
- add regression tests,
- run targeted checks,
- run affected broader checks,
- inspect final diff,
- update docs/checkpoint.

## Invariants

[VERIFY stable product and architectural invariants.]

## Security and privacy

- Never expose secrets.
- Never trust client-side ownership checks as security.
- RLS and RPC authorization require behavioral verification.
- External AI providers receive only necessary minimized data.

## Definition of done

- Acceptance criteria satisfied.
- Required checks executed successfully or failures documented.
- Final diff inspected.
- Manual checks separated.
- Known limitations and exact next action recorded.
