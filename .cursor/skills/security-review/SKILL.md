---
name: security-review
description: Reviews SideShift changes for auth, RLS, secrets, CORS, quota bypass, and data-boundary risks. Use before merging security-sensitive work on auth, Worker routes, Supabase migrations, repositories, or entitlement logic.
---

# Security Review

Read-only by default. Edit only to document findings unless explicitly asked to fix.

## Checklist

- **RLS**: policies on new/changed tables and RPCs; owner vs outsider vs anonymous.
- **Auth**: OTP/session flows; no implicit privilege escalation.
- **Service role**: only in `worker/` and server scripts; never in `src/` client bundle.
- **Worker**: bearer validation, CORS origin allowlist, bounded Zod input/output.
- **Quota**: server-authoritative; no client-side bypass of entitlements.
- **User ID trust**: derive from validated token, never from request body alone.
- **Secrets**: no keys in frontend, commits, or error messages.
- **PII**: profile visibility, blocking, and signed URL boundaries.
- **Replay/idempotency**: duplicate turn/evaluation requests handled safely.

## Output format

For each finding:

- Severity: critical / high / medium / low
- Evidence: file and behaviour
- Smallest safe mitigation

## Stop conditions

- No critical/high findings, or all documented with agreed mitigation path.

## Key references

- Worker: `worker/src/index.ts`
- Repositories: `src/data/supabaseRepository.ts`
- Migrations: `supabase/migrations/`
- Secret scan: `npm run audit:frontend-secrets`
- RLS tests: `npm run test:rls`, `npm run test:supabase:private-social`
