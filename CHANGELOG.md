# Changelog

## Unreleased

- Stabilized SideShift Basic multi-turn submissions, retries, stale-response handling, lifecycle interruption, safe diagnostics, and invalid-response recovery.
- Added three-turn Basic provider regression coverage and expanded the live verifier to three turns plus evaluation.
- Routed Friends profile photos through the shared picker and 512px WebP processing path.
- Added Android beta verification notes and explicit manual-device limitations.
- Polished the Android phone surface with shared responsive typography/spacing, safe-area navigation, and a localized four-stage onboarding flow.
- Fixed immediate avatar synchronization across the top-right header and profile surfaces with a revisioned private signed-URL cache key.
- Added Profile & Settings 2.0: focused settings sections, viewer-aware profile detail, public/friend/shared-Group/private visibility, selected safe statistics, and validated optional social links.
- Added migrations 0021–0023 for privacy-safe profile responses and public visibility. The bounded four-viewer remote verifier passes hidden-social omission and blocked neutral-state checks.
- Added anonymous-account security status and strong-confirmation logout; email/OAuth linking remains intentionally unadvertised until configured.
