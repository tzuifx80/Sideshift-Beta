# Private beta checklist

- [x] Anonymous Supabase Auth with session restore, profile bootstrap, loading/error/retry states.
- [x] Repository-backed onboarding, active debate recovery, turns, stances, results, challenges, and reports.
- [x] Migrations 0001–0005 applied and listed on the verified Supabase project.
- [x] Two-user integration verifies RLS denials, challenge expiry/single-use behavior, report privacy, owner-only deletion, and responder anonymization.
- [x] Lifecycle-safe two-context Playwright flow passes against Supabase.
- [x] PWA manifest, icons, service worker, offline fallback, update handling, and asset test.
- [x] Network-loss banner and guards for onboarding, AI rounds, results, reports, challenges, and deletion.
- [x] Share-card native file share, PNG download fallback, deep-link URL construction, and no private stance in shared content.
- [x] Mock-AI/private-beta disclosure, legal pages, safe analytics allowlist, structured redacted logs, request IDs, CORS, security headers, and secret scan.
- [x] Supabase and local rate-limit checks are implemented; local API rate-limit regression is covered by `server_api_test.py`.
- [x] Deployment runbook and device test checklist.
- [ ] Deploy the Render service and run the public HTTPS smoke command.
- [ ] Complete the physical Windows/Android/PWA checklist on the deployed URL.
- [ ] Verify live AI in English and German if a provider key is intentionally enabled; mock mode remains the safe default.
- [ ] Introduce shared rate limiting before scaling beyond one service instance.
- [ ] Decide whether to add anonymous-account upgrade/recovery before expanding beta retention.
