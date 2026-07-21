# Changelog

## Unreleased

- Finalized mobile information architecture and shared shell contracts: five bottom destinations, focused Profile/Settings ownership, Home/Explore World Pulse placement, Friends/Groups League placement, safe-area spacing, touch-target sizing, and destructive-action separation.
- Added a durable signed-out preference and explicit guest continuation. Empty-session bootstrap no longer creates anonymous users automatically; late auth callbacks, Capacitor resume, restart, private-state hydration, and Android Back stay signed out after deliberate logout.
- Added a localized mobile logout dialog with anonymous-account warning, active-draft warning, progress state, retryable failure behavior, and separate Delete Account placement.
- Added regression contracts for the physical logout restart failure, deliberate guest creation, bootstrap races, five-destination ownership, World Pulse/League placement, and private-state cleanup.

- Added World Pulse with reviewed statuses, HTTPS source metadata, translations, sensitivity preferences, freshness windows, debate snapshots, Explore integration, and a server-authorized internal review boundary.
- Added private opt-in Friends and Group Debate Leagues with recurring UTC seasons, server-authoritative idempotent scoring, anti-farming caps, private breakdowns, evidence-backed awards, and request-time season finalization.
- Added migrations `0028`–`0032`; migrations `0001`–`0027` remain untouched. Added focused domain tests and the linked World Pulse/League verifier.

- Repaired private avatar Storage RLS across migrations `0025`–`0027`: owner create/replace/remove is canonical-path-only, friend reads remain privacy-gated, and outsider direct access remains denied.
- Added `android:build:verify` for a process-only HTTPS placeholder build while preserving local LAN development configuration and production URL rejection.

- Stabilized SideShift Basic multi-turn submissions, retries, stale-response handling, lifecycle interruption, safe diagnostics, and invalid-response recovery.
- Added three-turn Basic provider regression coverage and expanded the live verifier to three turns plus evaluation.
- Routed Friends profile photos through the shared picker and 512px WebP processing path.
- Added Android beta verification notes and explicit manual-device limitations.
- Polished the Android phone surface with shared responsive typography/spacing, safe-area navigation, and a localized four-stage onboarding flow.
- Fixed immediate avatar synchronization across the top-right header and profile surfaces with a revisioned private signed-URL cache key.
- Added Profile & Settings 2.0: focused settings sections, viewer-aware profile detail, public/friend/shared-Group/private visibility, selected safe statistics, and validated optional social links.
- Added migrations 0021–0024 for privacy-safe profile responses, public visibility, and profile-navigation payloads. The bounded four-viewer remote verifier passes hidden-social omission and blocked neutral-state checks.
- Added anonymous-account security status and strong-confirmation logout; email/OAuth linking remains intentionally unadvertised until configured.
- Repaired Android logout so Supabase sign-out cannot immediately bootstrap a replacement anonymous session; private client state is cleared and the app presents a signed-out welcome state with retryable localized failure handling.
- Removed the duplicate Friends avatar editor. Owner-only profile photo changes now verify a fresh private signed URL before success, and image processing falls back to the WebView decoder for Android picker blobs.
- Completed clickable human profile navigation for Groups, direct friend challenges, bearer-link challenge recipients, and completed friend-challenge rows. Added privacy-filtered challenge creator payloads, Group member profile keys, and private client-state cleanup on logout.
- Added migration `0024_profile_navigation_payloads.sql`; local and remote migrations now match through `0024`.
