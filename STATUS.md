# Status

Completion: `IMPLEMENTED_WITH_MANUAL_ANDROID_RETEST_PENDING`

The Android mobile polish phase adds a phone-first typography/spacing contract, safe-area mobile navigation, a localized four-stage introduction, and a single profile-avatar snapshot with revisioned signed-image URLs. Profile & Settings 2.0 now adds a focused settings hub, viewer-aware profile detail, validated social links, selected safe statistics, preview controls, clickable human profile targets in Friends, Groups, and challenges, and anonymous-account logout protection. This repair keeps avatar editing in the owner Profile Settings flow, adds a WebView image-decoder fallback, and makes logout enter a signed-out welcome state without automatic anonymous re-authentication. Physical Android logout and media confirmation remains pending.

SideShift Basic now owns one guarded client turn pipeline: each round has a stable header-safe idempotency identity, retries reuse the same turn identity, stale responses are rejected, invalid responses become recoverable errors, and Android lifecycle backgrounding interrupts safely without losing the submitted argument.

Repository verification is green for typecheck, lint, 30 Vitest files / 100 tests, provider configuration, encoding, PWA checks, frontend secret scanning, dependency audit, development Vite build, Capacitor sync, Android debug APK compilation, and the four-viewer profile/RLS verifier. Physical Android installation/lifecycle/media/logout verification remains pending because `adb` is unavailable in this environment.

## Avatar RLS and Android build precondition repair — 2026-07-20

- Remote private avatar Storage now authorizes the canonical `<public_profile_key>/current.webp` path for owner insert, replacement/upsert, and removal without making the bucket public.
- Non-owner reads continue through the privacy-aware signed-URL boundary; the owner-only transition read permits Storage upsert before `profiles.avatar_path` metadata is linked.
- Remote migrations `0025`–`0027` are applied. The targeted private-social verifier passed owner write, replacement, friend signed read, outsider denial, and cleanup once after the repair.
- `android:build:verify` now supplies a process-only public HTTPS placeholder. Local Android development still uses the configured LAN URL, and production rejects HTTP/private addresses.
- The four-viewer profile/privacy verifier now passes owner, accepted friend, shared-Group member, outsider, hidden-field omission, and blocked-access coverage.
