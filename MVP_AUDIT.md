# SideShift MVP and private-beta audit

## Current verified state

The browser MVP is implemented on the repository boundary. Supabase migrations `0001`–`0005` are applied and verified. The two-user integration reports eight RLS denials, challenge expiry/single-use/ownership checks, report privacy, owner-only deletion, and responder anonymization. The lifecycle-safe two-context Playwright flow passes.

Core fixes include refresh recovery, real challenge tokens/deep links, response-derived mock opponent prompts, bounded persisted scores, server-only AI boundaries, bilingual take content, feedback for optional browser APIs, dynamic history/profile data, and safe report persistence.

## Private-beta hardening complete

- explicit local/test/private-beta env templates and fail-closed production validation;
- same-origin Render deployment plan and `/api/health` contract;
- installable PWA assets, offline fallback, update handling, network-loss UI, and device checklist;
- HTTPS challenge URL construction, native/PNG share-card fallback, and no starting stance in shared content;
- mock-AI disclosure, Privacy/Beta Terms/Community Rules routes;
- authenticated `delete_my_beta_data()` action with owner-safe responder anonymization;
- privacy-conscious allow-listed analytics with no raw debate text;
- structured request-ID logs, security headers, CORS allowlist, secret scan, and rate-limit regressions;
- managed test-server lifecycle cleanup and production smoke command.

## Remaining launch gates

1. No Render credentials or public HTTPS URL were supplied, so the public deployment smoke test is blocked.
2. Android/installed-PWA manual testing remains to be executed on the deployed origin.
3. Live AI in English/German is optional and remains unverified when mock mode is selected.
4. Shared rate limiting and anonymous-account recovery are future scale decisions.

## Honest rating

`PWA_READY_BUT_NOT_DEPLOYED`: ready for a controlled private-beta deployment, not evidence of a live public deployment.
