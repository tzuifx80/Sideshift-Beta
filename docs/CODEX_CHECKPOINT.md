# Codex Checkpoint

## Production auth, hosted Basic, and final mobile correction checkpoint - 2026-07-21

- Auth flow now has explicit guest creation, email OTP sign-in without implicit account creation, and email-change OTP to secure an active anonymous account without changing its UUID. Auth errors are mapped to safe UI categories; the signed-out marker clears only after verified success.
- The live onboarding route is three stages: Welcome, SideSwitch, Personalize/start. Group detail uses compact tabs and grouped invite display; Friends uses Friends, Requests, and League tabs.
- `worker/` contains the Wrangler/Workers AI implementation, scoped CORS, Supabase bearer validation, existing quota RPC calls, health/capability routes, deployment README, and `scripts/verify-worker.mjs`. Local Worker tests pass; Wrangler dry-run passes with explicit production bindings.
- Applied migrations remain unchanged through `0032`; no invite migration was needed because display formatting is derived from the existing secure token.
- Verification: 35 Vitest files / 125 tests, typecheck, lint, encoding, PWA, frontend secret scan, dependency audit, production HTTPS-placeholder build, Worker tests, and Wrangler dry-run pass. Real deployment credentials, Supabase Dashboard OTP/linking configuration, and physical Android retest remain pending.

### Exact next action

Enable Supabase manual linking and the OTP email template, authenticate Wrangler, set Worker secrets, deploy the production environment, then build the APK with that HTTPS Worker URL and repeat the physical three-turn/visual matrix with the PC stopped.

## Final mobile structure and persistent logout checkpoint - 2026-07-21

- Root cause confirmed: logout previously changed only React memory. After Android WebView restart, no durable signed-out marker existed, so `getOrCreateAnonymousSession` saw no session and immediately created a replacement anonymous account.
- Fixed with `sideshift-signed-out-v1`, opt-in anonymous bootstrap, late-callback/lifecycle guards, full in-memory/private-state cleanup, and explicit Continue as guest. The marker is cleared only after deliberate guest continuation.
- Settings logout is now one deliberate confirmation flow. Home, Explore, Friends, Groups, Profile, and Settings ownership is contract-tested; navigation remains five destinations with Friends/Groups nested back handling.
- Verification: 33 Vitest files / 114 tests, typecheck, lint, env, provider, encoding, PWA, secret, dependency, HTTPS-placeholder build, Capacitor sync, and Gradle debug APK passed. Browser runtime and `adb` are unavailable.

### Exact next action

Install `android/app/build/outputs/apk/debug/app-debug.apk` on the confirmed physical Android device and run the signed-out welcome, logout/restart/resume, Continue as guest, Android Back, keyboard, dark mode, Large Text, German, and 320-412px matrix.

## World Pulse and Private Debate League checkpoint — 2026-07-20

- Local and remote migrations match through `0032`; migrations `0001`–`0027` remain immutable and the phase began with `0028`.
- World Pulse is a reviewed, source-linked, time-bounded collection with translation fallback, sensitivity filtering, editor RPCs, and historical debate snapshots.
- Friends and Group Leagues are private, opt-in, server-scored, idempotent, capped, and season-versioned; expired seasons finalize on authenticated League access.
- Targeted domain tests, typecheck, lint, and the linked World Pulse/League verifier pass. Android debug/build and full-device interaction remain separate checks.

## Profile & Settings 2.0 checkpoint — 2026-07-20

- Profile/settings is split into a mobile hub with Profile, Privacy and safety, Debate preferences, Appearance/accessibility, Account/data, and Help/app sections.
- `get_profile_for_viewer` is the server boundary for other profiles. The remote four-viewer verifier passes owner, accepted friend, shared-Group member, outsider, hidden social URL omission, and blocked neutral-unavailable behavior.
- Social links are capped at five, normalized to HTTPS, checked against known provider domains, and filtered by overall plus per-link visibility. Selected statistics are filtered before JSON leaves the RPC.
- Friends, Group member rows, direct friend-challenge participants, and bearer-link challenge creators open the same privacy-aware profile detail. AI opponents remain non-clickable; the current debate history has no human participant identity rows.
- Migrations `0021`–`0024` are applied locally and remotely; no migration `0001`–`0023` was edited.
- Final automated evidence: 29 Vitest files / 95 tests, typecheck, lint, env validation, provider configuration, encoding, PWA, frontend secret scan, dependency audit, production placeholder build, development build, Capacitor sync, Android debug APK compilation, and the four-viewer profile/RLS verifier.
- APK: `android/app/build/outputs/apk/debug/app-debug.apk`. `adb` and browser screenshot automation remain unavailable, so physical phone layout, Android Back/logout, and avatar media checks are pending.

## Objective

Complete SideShift Phase 4: private profiles, secure avatar media, exact-handle/friend-code discovery, friendships, blocking, direct friend challenges, Group invitations, and synchronized onboarding progress.

## Confirmed facts

- Supabase migrations are applied locally and remotely through `0024`.
- Social mutations use authenticated RPCs; local repository mode remains explicitly device-only and exposes no simulated multi-user friendship.
- The avatar bucket is private, uses opaque profile-key paths, owner-only writes, and signed reads gated by profile privacy and blocking.
- Exact discovery returns only an opaque profile key, handle, display name, preset/accent metadata, and no bio/avatar path until privacy permits it.
- Blocking atomically marks the relationship blocked, revokes open direct challenges, and revokes pending targeted Group invitations.
- Existing bearer-link challenge RPCs reject direct friend challenges and remain unchanged for bearer-link users.
- Supabase preference hydration now accepts legacy nullable/missing fields, snake_case or camelCase aliases, and legacy JSON-array strings while retaining strict type checks and safe defaults.
- SideShift server requests now use one environment-aware API client. Browser development uses the Vite relative proxy, while Android hosted/debug builds require an explicit `VITE_API_BASE_URL` for the HTTPS Worker; local emulator/PC API values remain explicit development-only overrides.
- Basic AI capability, generation and evaluation requests share the configured API client; development diagnostics expose only host/path, status and safe outcome categories.
- Profile settings now provide system gallery/camera entry points with cancellation handling and a processed 512px WebP preview before upload. Physical gallery/camera behavior remains unverified.

## Verification

- `npm run typecheck`, `npm run lint`, targeted Vitest, `npm test`, `npm run build`, `npm run test:supabase`, `npm run test:supabase:private-social`, `npm run test:supabase:collaboration`, `npm run test:playwright:person`, `npm run test:playwright:supabase`, and `npm run test:playwright:team` pass.
- Three-user remote social/RLS test passes exact lookup, opposite-direction request resolution, duplicate prevention, outsider denial, avatar signed-read boundaries, Group invitation acceptance, blocking revocation, and cleanup.
- Remote migrations `0016`–`0024` are applied.

## Important limitations

- Preference parser and authentication-bootstrap regression coverage passes; structural rejection diagnostics contain only field names, types, null/missing fields, and validation paths.
- Added `scripts/private_social_flow.py` and `npm run test:playwright:private-social` for the focused three-context browser acceptance flow. The run reached the exact-handle lookup and pending-request path, but final remote execution was stopped after Supabase anonymous-auth rate limiting reported `Private session unavailable / Request rate limit reached` for the third isolated context. No further anonymous-auth retries were performed.
- Physical Android camera/gallery verification remains pending; the web path uses browser-native canvas processing and the existing Capacitor foundation is not changed.
- Android Basic routing was previously blocked because `BasicAiProvider` bypassed `VITE_API_BASE_URL` and used WebView-relative `/api` paths. The fix is implemented; physical-device reachability now requires the deployed Worker URL and a manual retest.
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
- The shared system picker/media processor is used by owner Profile Settings only. Friends is display-only for avatars. Only `@capacitor/app`, `@capacitor/browser`, and `@capacitor/share` are installed; Capacitor Camera was not added.

### Exact next action

Install `app-debug.apk` on an emulator or physical device with `adb`, run the three-turn Basic/lifecycle/navigation/keyboard smoke matrix, then perform the gallery and camera-or-gallery system-picker checks with a valid ignored API URL.

## Mobile UX and avatar synchronization checkpoint — 2026-07-20

- The active onboarding tree is now a concise three-stage mobile introduction: welcome, SideSwitch, and personalization/first debate. Progress remains in the existing per-user local/server hydration path.
- Header and profile avatar rendering consume the shared profile-avatar snapshot. Upload, replacement, and removal update the client-only revision while retaining the private `publicProfileKey/current.webp` path and signed access.
- Shared mobile CSS tokens set 16px form text, 44–48px touch targets, safe-area spacing, responsive headings, compact cards, and five-destination bottom navigation. No applied migration changed.
- Automated evidence is green: 25 Vitest files / 86 tests, typecheck, lint, and development Vite build. Browser automation was unavailable, and physical Android visual/media checks remain pending.

### Exact next action

Install the rebuilt debug APK on the real phone, verify 320–412px-equivalent layout at device font scale, then upload/replace/remove a private avatar and confirm the header and profile update before reporting the visual phase complete.

## Android logout and avatar repair checkpoint — 2026-07-20

- Logout no longer retries the anonymous-session bootstrap after local Supabase sign-out. It clears private client storage, ignores late auth callbacks during the transaction, and routes to a signed-out welcome screen; failed sign-out remains retryable.
- Friends no longer contains avatar editing. Profile photo upload/removal remains owner-only in Profile Settings and only reports success after storage, profile persistence, fresh signed URL resolution, and global avatar-state publication.
- Android picker blobs now have an object-URL `Image` decode fallback when `createImageBitmap` is unavailable or rejects.
- Automated focused logout/avatar tests pass. Physical Android picker/upload/replacement/removal, logout/relaunch, and Android Back checks remain pending because `adb` is unavailable.

## Avatar RLS and Android build precondition checkpoint — 2026-07-20

- Root cause: Storage initial INSERT passed, but `upsert`/UPDATE required a row read while `profiles.avatar_path` was still unset; the privacy SELECT policy therefore rejected the owner transition. A second policy attempt also exposed that an outer `profiles` query bypassed friend visibility under profile RLS.
- Migrations `0025`–`0027` now use exact canonical owner paths, an owner-only transition read, and direct `can_view_profile_avatar` evaluation for validated non-owner paths. Remote migration history is applied through `0027` and the bucket remains private.
- The targeted private-social verifier passed owner write, replacement, friend signed read, outsider denial, and cleanup. The four-viewer profile/privacy verifier now passes owner, accepted friend, shared-Group member, outsider, hidden-field omission, and blocked neutral-unavailable behavior.
- `android:build:verify` passed with a process-only HTTPS placeholder. The local development TypeScript/Vite build, Capacitor sync, and Gradle debug APK build also passed. Production still rejects the configured private HTTP URL.

### Exact next action

Begin the next approved product phase only after the normal phase preconditions are rechecked; do not combine it with unrelated repairs.

### Exact next action

Install the debug APK on the physical phone, verify anonymous and secured logout plus gallery upload/replacement/removal, and confirm the header/profile avatar after relaunch.
