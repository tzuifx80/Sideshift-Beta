# Backend implementation plan

## Current status

The application data boundary is connected to anonymous Supabase Auth, Postgres RLS, and repository/RPC calls. Local browser persistence remains development-only. Migrations `0001`–`0005` are applied to the verified project.

## Completed

- explicit local/Supabase repository selection and production mismatch checks;
- anonymous session bootstrap, hydration, retry, reset, and refresh recovery;
- debates, turns, stances, results, challenge RPCs, reports, and owner-safe data deletion;
- hashed challenge tokens, expiry, self-response rejection, single-use locking, and restricted result shapes;
- user-scoped Supabase RPC throttles and safe analytics storage;
- two-user integration, RLS denial checks, two-context browser flow, typecheck/lint/unit/build verification;
- server-side AI boundary with mock mode disclosure, safe logs, CORS, security headers, and process-local legacy API limits.

## Runtime data path

```text
React PWA -> AuthProvider -> AppRepository -> SupabaseRepository
                                  -> Supabase Auth/Postgres/RLS/RPC
React PWA -> same-origin /api/ai/* -> mock or configured provider
```

## Remaining decisions

- deploy one Render Web Service and run the public smoke command;
- complete physical device/PWA checks;
- configure and verify live AI only if the beta needs it;
- add a shared rate limiter before more than one service instance;
- decide on anonymous identity upgrade/recovery before long-term retention.
