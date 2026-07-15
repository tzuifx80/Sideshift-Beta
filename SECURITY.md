# Security audit

## Implemented

- Supabase mode uses real anonymous Auth and fails closed when the authenticated data path is unavailable.
- Browser configuration contains only the public Supabase anon key; service-role and AI keys are rejected from `VITE_*` variables and frontend build output.
- Supabase rows are parsed with Zod and database errors map to safe UI messages.
- Owner-scoped RLS protects private profiles, preferences, debates, turns, stances, results, reports, and challenge ownership. Challenge RPCs enforce expiry, row locking, creator self-response rejection, and single-use responses.
- Migration 0005 adds security-definer, user-scoped rate-limit enforcement; report insertion through a validated RPC; responder-reference anonymization; and owner-authenticated `delete_my_beta_data()`.
- Analytics uses a fixed event allowlist, bounded scalar properties, no raw transcript/report text, and a table that is not directly writable by anonymous/authenticated clients.
- The Node boundary has explicit production CORS, request IDs, safe JSON logs, rate limits, no-store API responses, CSP, frame/referrer/content-type protections, and no secret-bearing health output.
- Service-worker caching excludes `/api/`, challenge routes, Supabase responses, and other private data.
- Local file/browser persistence is visibly development-only; production startup/build validation rejects local persistence.

## Verification evidence

The current verified Supabase run reports `rls_denials=8`, challenge checks for self-response, second-user response, duplicate response, expiry, creator result, responder result, and `deletion=owner_only,responder_anonymized`. Unit tests, typecheck, lint, build, PWA checks, and frontend secret scan pass.

## Remaining risks/blockers

1. No Render credentials or public HTTPS URL were supplied, so deployment and public smoke verification are not claimed.
2. Physical Android/installed-PWA testing remains a manual release gate.
3. Live AI is optional and unverified unless provider credentials are intentionally configured; the private beta currently discloses mock mode.
4. Node API rate limits are process-local. Keep one instance until a shared limiter is added.
5. Anonymous identities do not have account recovery; decide on an upgrade path before long-term reliance.

Never commit `.env`, `.data/`, service-role keys, provider keys, or real beta exports.
