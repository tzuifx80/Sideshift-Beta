# Codex Checkpoint

## Profile & Settings 2.0 checkpoint — 2026-07-20

- Profile/settings is split into a mobile hub with Profile, Privacy and safety, Debate preferences, Appearance/accessibility, Account/data, and Help/app sections.
- `get_profile_for_viewer` is the server boundary for other profiles. The remote four-viewer verifier passes owner, accepted friend, shared-Group member, outsider, hidden social URL omission, and blocked neutral-unavailable behavior.
- Social links are capped at five, normalized to HTTPS, checked against known provider domains, and filtered by overall plus per-link visibility. Selected statistics are filtered before JSON leaves the RPC.
- Friends and exact-handle previews open the new profile detail. Group/challenge/history participant click-through remains a follow-up limitation.
- Migrations `0021`, `0022`, and `0023` are applied locally and remotely; no migration `0001`–`0020` was edited.
- Final automated evidence: 27 Vitest files / 92 tests, typecheck, lint, env validation, provider configuration, encoding, PWA, frontend secret scan, dependency audit, production placeholder build, development build, Capacitor sync, and Android debug APK compilation.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`. `adb` and browser screenshot automation remain unavailable, so physical phone layout, Android Back/logout, and avatar media checks are pending.

## Objective

Complete SideShift Phase 4: private profiles, secure avatar media, exact-handle/friend-code discovery, friendships, blocking, direct friend challenges, Group invitations, and synchronized onboarding progress.

## Confirmed facts

- Supabase migrations are applied locally and remotely through `0023`.
- Social mutations use authenticated RPCs; local repository mode remains explicitly device-only and exposes no simulated multi-user friendship.
- The avatar bucket is private, uses opaque profile-key paths, owner-only writes, and signed reads gated by profile privacy and blocking.
- Exact discovery returns only an opaque profile key, handle, display name, preset/accent metadata, and no bio/avatar path until privacy permits it.
- Blocking atomically marks the relationship blocked, revokes open direct challenges, and revokes pending targeted Group invitations.
- Existing bearer-link challenge RPCs reject direct friend challenges and remain unchanged for bearer-link users.
- Supabase preference hydration now accepts legacy nullable/missing fields, snake_case or camelCase aliases, and legacy JSON-array strings while retaining strict type checks and safe defaults.
- SideShift server requests now use one environment-aware API client. Browser development uses the Vite relative proxy, Android emulator development can use `10.0.2.2`, physical Android development requires an explicit ignored `VITE_API_BASE_URL`, and production requires a public HTTPS API URL.
- Basic AI capability, generation and evaluation requests share the configured API client; development diagnostics expose only host/path, status and safe outcome categories.
- Profile settings now provide system gallery/camera entry points with cancellation handling and a processed 512px WebP preview before upload. Physical gallery/camera behavior remains unverified.

## Verification

- `npm run typecheck`, `npm run lint`, targeted Vitest, `npm test`, `npm run build`, `npm run test:supabase`, `npm run test:supabase:private-social`, `npm run test:supabase:collaboration`, `npm run test:playwright:person`, `npm run test:playwright:supabase`, and `npm run test:playwright:team` pass.
- Three-user remote social/RLS test passes exact lookup, opposite-direction request resolution, duplicate prevention, outsider denial, avatar signed-read boundaries, Group invitation acceptance, blocking revocation, and cleanup.
- Remote migrations `0016`–`0023` are applied.

## Important limitations

- Preference parser and authentication-bootstrap regression coverage passes; structural rejection diagnostics contain only field names, types, null/missing fields, and validation paths.
- Added `scripts/private_social_flow.py` and `npm run test:playwright:private-social` for the focused three-context browser acceptance flow. The run reached the exact-handle lookup and pending-request path, but final remote execution was stopped after Supabase anonymous-auth rate limiting reported `Private session unavailable / Request rate limit reached` for the third isolated context. No further anonymous-auth retries were performed.
- Physical Android camera/gallery verification remains pending; the web path uses browser-native canvas processing and the existing Capacitor foundation is not changed.
- Android Basic routing was previously blocked because `BasicAiProvider` bypassed `VITE_API_BASE_URL` and used WebView-relative `/api` paths. The fix is implemented, but physical-device reachability still requires a configured PC LAN URL and a manual retest.
- `npm run verify:providers:live` reached its Basic capability, live generation, idempotent replay, and structured evaluation assertions, then failed at the unrelated feedback-email delivery assertion (`delivery_status: failed` instead of `sent`). It was not retried to avoid extra provider calls.
- The focused Friends browser flow is implemented but remains remotely unverified because anonymous authentication rate limiting blocked the final run. The earlier three-user RPC/RLS acceptance remains passing.
- The repository still contains existing bundle warnings unrelated to this phase.

## Exact next action

Configure the ignored physical-device API URL, rebuild/sync Android, then manually retest Basic and profile media on a physical device with a valid existing session.

## Android beta checkpoint — 2026-07-20

- Basic client turn preparation now uses stable, header-safe `debateId`/round identities, a single-flight submission guard, stale-response rejection, invalid-response validation, and recoverable retry state.
- Android lifecycle backgrounding invalidates the active response and preserves the submitted user turn; resume clears the cached connection promise.
- The live provider verifier was expanded to three Basic turns and one evaluation. The Basic path passed; the run still stops at the pre-existing feedback-email delivery assertion.
- Development web assets were synced and `android/app/build/outputs/apk/debug/app-debug.apk` was built successfully. `adb` is unavailable, so installation and physical Android checks remain pending.
- The shared system picker/media processor is used by both Settings and Friends. Only `@capacitor/app`, `@capacitor/browser`, and `@capacitor/share` are installed; Capacitor Camera was not added.

### Exact next action

Install `app-debug.apk` on an emulator or physical device with `adb`, run the three-turn Basic/lifecycle/navigation/keyboard smoke matrix, then perform the gallery and camera-or-gallery system-picker checks with a valid ignored API URL.

## Mobile UX and avatar synchronization checkpoint — 2026-07-20

- The active onboarding tree is now a concise four-stage mobile introduction: welcome, debate modes, SideSwitch, and personalization/first debate. Progress remains in the existing per-user local/server hydration path.
- Header and profile avatar rendering consume the shared profile-avatar snapshot. Upload, replacement, and removal update the client-only revision while retaining the private `publicProfileKey/current.webp` path and signed access.
- Shared mobile CSS tokens set 16px form text, 44–48px touch targets, safe-area spacing, responsive headings, compact cards, and five-destination bottom navigation. No applied migration changed.
- Automated evidence is green: 25 Vitest files / 86 tests, typecheck, lint, and development Vite build. Browser automation was unavailable, and physical Android visual/media checks remain pending.

### Exact next action

Install the rebuilt debug APK on the real phone, verify 320–412px-equivalent layout at device font scale, then upload/replace/remove a private avatar and confirm the header and profile update before reporting the visual phase complete.
