# Changelog

## Unreleased

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
