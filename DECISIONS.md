# Decisions

## 2026-07-20 Android beta completion

- Basic request identity is derived from `debateId` and round, sanitized to the server's accepted request-header alphabet, and reused for safe retries.
- Backgrounding invalidates the active client response and leaves the user turn persisted for retry; no background service was introduced.
- Profile media uses the shared browser/system picker and 512px WebP processing. No Capacitor Camera dependency was added; native camera capture remains a physical-device check and is not claimed as verified.
- No database migration was added or changed.

## 2026-07-20 Mobile UX and avatar synchronization

- The active introduction now follows welcome → debate choice → SideSwitch → personalize; it remains skippable, resumable, keyboard-safe, and re-openable without erasing preferences.
- Profile photo replacement keeps the private `current.webp` object path but increments a client-only avatar revision. The shared profile-avatar snapshot appends that revision to signed image URLs, so header/profile state updates immediately without disabling normal caching or making the bucket public.
- The mobile surface uses shared responsive tokens, 16px form text, 44–48px controls, safe-area padding, compact editorial cards, and a five-destination bottom navigation. No architecture or migration changes were introduced.
