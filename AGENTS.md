# SideShift — Agent Guide

SideShift is a multilingual debate app (React, TypeScript, Vite, Supabase, Cloudflare Worker, Capacitor Android, PWA) targeting v0.2.0 Private Beta.

## Core commands

| Task | Command |
|------|---------|
| Dev (web + local API) | `npm run dev:all` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit tests | `npm test` |
| Worker tests | `npm run api:worker:test` |
| Worker verify | `npm run api:worker:verify -- <url>` |
| Secret scan | `npm run audit:frontend-secrets` |
| Production build | `npm run build` |
| Android build | `npm run android:build:verify` |
| Supabase RLS | `npm run test:rls` |
| Env validation | `npm run validate:env` |

## Directory map

| Path | Purpose |
|------|---------|
| `src/` | React app, i18n, auth, AI providers, UI |
| `src/data/` | Repository abstraction (local + Supabase) |
| `worker/` | Hosted SideShift Basic API (Cloudflare) |
| `supabase/migrations/` | Schema, RLS, RPCs (through `0032`) |
| `android/` | Capacitor Android project |
| `scripts/` | Verification, Playwright flows, env checks |
| `.cursor/rules/` | Cursor Composer rules (minimal always-on) |
| `.cursor/skills/` | Procedural workflows |
| `.cursor/agents/` | Custom subagents |

## Non-negotiable security

- Service-role key and AI secrets stay server-side (`worker/`, Wrangler secrets).
- Production frontend uses Supabase anon key only; `VITE_DATA_BACKEND=supabase`.
- RLS default deny; verify as real users, not service role.
- Never trust client-supplied user IDs for authorization.
- AI mock/live labels must be honest.

## Deeper documentation

- Status checkpoint: `docs/CODEX_CHECKPOINT.md`
- v0.2 plan: `docs/exec-plans/v0.2-private-beta.md`
- Release checklist: `docs/RELEASE_CHECKLIST.md`
- Cursor workflow: `docs/CURSOR_WORKFLOW.md`
- Worker deploy: `worker/README.md`

## Working rules

- Inspect code before editing; smallest complete solution.
- Preserve repository abstractions and debate/draft recovery state.
- Ask before migrations, dependencies, secrets, or destructive operations.
- Report unverified behaviour honestly.
