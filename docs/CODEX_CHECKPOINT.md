# Codex Checkpoint

## Objective

Complete SideShift Phase 3: SideShift Basic AI, server-authoritative usage and free entitlements, improved onboarding, secure feedback delivery, honest AI runtime states, and regression verification.

## Confirmed facts

- Phase 3 implementation is complete in the Node server/API boundary and the existing typed `AiProvider` boundary.
- Supabase migrations match locally and remotely through `0015`.
- SideShift Basic is unavailable without server credentials and cannot fall back to the development mock in production.
- Puter remains an optional browser-based advanced route.
- Free usage and entitlement values are server-authoritative; duplicate usage requests are idempotent and provider failures do not consume a completed debate.
- Onboarding is four-stage, resumable per authenticated user in the existing client persistence boundary, localized in EN/DE/FR/ES/IT, and reopenable from Settings.
- Feedback is persisted before notification; notification failure leaves the feedback record intact and stores minimal delivery state.

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (14 files, 48 tests), and `npm run build` pass.
- Basic server security, Supabase integration, collaboration/RLS, AI mock, Explore, person challenge, Team Debate reload, onboarding, encoding, PWA, frontend secret scan, environment validation, dependency audit, and Capacitor sync pass.
- Team Debate remains at four turns and exactly 20 points through the tested reload flow.
- Production smoke is blocked only because no deployed frontend/API URLs were supplied.
- Live Puter and live Basic/email delivery remain manual or credential-gated checks.

## Important limitations

- Live Basic provider and transactional email credentials are not configured in this workspace.
- Basic uses the bounded JSON server adapter with a controlled retry; the client preserves the provider streaming contract through its existing chunk interface.
- The current local progress persistence is browser/device scoped rather than cross-device onboarding synchronization.
- Build retains existing Puter CommonJS and large-chunk warnings.
- `scripts/setup-live-providers.ps1` now writes only the ignored `.env.server.local` file through hidden prompts and preserves unrelated values.
- `npm run verify:providers` checks server configuration, Basic capability, production mock protection, and the frontend secret scan without printing values.
- `npm run verify:providers:live` is ready to run one authenticated Basic/evaluation/feedback smoke test after secrets are entered; mailbox arrival still needs an inbox check.

## Exact next action

Run `npm run setup:providers` in an interactive PowerShell window, then run `npm run verify:providers:live` and check the configured mailbox.
