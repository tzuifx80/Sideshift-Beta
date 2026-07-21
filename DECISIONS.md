# Decisions

## 2026-07-21 Persistent signed-out state and final mobile IA

- A missing Supabase session is an explicit signed-out state; anonymous bootstrap is opt-in and can run only after the user selects Continue as guest. Existing sessions are still reused.
- Deliberate local sign-out writes `sideshift-signed-out-v1` after `auth.signOut({ scope: 'local' })` and before private cleanup completes. The marker contains no secret or personal data and is cleared only by deliberate guest continuation; secure account linking remains out of scope.
- Auth callbacks are ignored while signing out or while the marker is present. Capacitor lifecycle events force the signed-out state, and App clears private React state so a late callback, resume, restart, or Back action cannot restore the previous account.
- The mobile IA keeps exactly five top-level destinations. World Pulse is Home/Explore content, Friends League is Friends content, Group League is Groups content, and account/avatar controls are Profile/Settings content.
- Settings is the configuration hub; Profile remains the identity/presentation surface. Sign Out and Delete Account are separated in Account & Data and use one deliberate modal flow.

## 2026-07-20 World Pulse and Private Debate League

- World Pulse is curated and server-published: normal users read only active published payloads, while draft/review/publish actions use editor roles and security-definer RPCs.
- World Pulse sources store metadata and HTTPS links, not article bodies. Published cards include source count, publication/review dates, region, and a translation fallback indicator.
- World Pulse content is copied into a bounded debate snapshot so later expiration or source edits cannot rewrite completed debate history.
- Friends League is opt-in; Group League is private and membership-gated. Standings expose aggregate participant totals, while detailed score events are returned only for the authenticated participant.
- League events are inserted only by a security-definer RPC from completed debate, friend-challenge, or Team Debate identifiers. Completion/reason uniqueness, daily caps, mock exclusion, and scoring versions are database-enforced.
- Expired seasons finalize on the next authenticated League request, freeze their status, and calculate only evidence-backed awards. No scheduler or public leaderboard was introduced.
- Friends standings are filtered to accepted friendship pairs, and Group dashboards return unavailable before membership is established.
- New work begins at migration `0028`; applied migrations `0001`–`0027` remain immutable.

## 2026-07-20 Profile & Settings 2.0

- Profile viewing uses the server-authoritative `get_profile_for_viewer` boundary. Hidden fields, statistics, and social URLs are omitted from the response.
- Migrations `0021`–`0024` add public visibility, field visibility, validated social links, selected-stat filtering, the viewer-aware profile RPC, and privacy-filtered profile navigation payloads without rewriting `0001`–`0023`.
- Social links are limited to five HTTPS URLs with known-provider host checks and no ownership claim. External navigation uses `noopener noreferrer`.
- Supabase currently provisions anonymous sessions only in this beta. Settings identifies that state and requires a strong confirmation before anonymous sign-out; email/OAuth upgrade is not falsely advertised.

## 2026-07-20 Android logout and avatar repair

- Logout sets an explicit signed-out state after `auth.signOut({ scope: 'local' })`; it does not call the anonymous-session bootstrap again. Auth-state callbacks are ignored during the sign-out transaction so a late `SIGNED_OUT` event cannot undo the route reset.
- Friends is display-only for avatars. The owner editor remains in Profile Settings, and successful upload/removal waits for storage, profile persistence, a fresh signed URL, and the shared profile-state update.
- Avatar processing falls back from `createImageBitmap(File)` to an object-URL `Image` decode for Android WebView picker blobs. No storage policy or applied migration changed.

## 2026-07-20 Android beta completion

- Basic request identity is derived from `debateId` and round, sanitized to the server's accepted request-header alphabet, and reused for safe retries.
- Backgrounding invalidates the active client response and leaves the user turn persisted for retry; no background service was introduced.
- Profile media uses the shared browser/system picker and 512px WebP processing. No Capacitor Camera dependency was added; native camera capture remains a physical-device check and is not claimed as verified.
- No database migration was added or changed.

## 2026-07-20 Mobile UX and avatar synchronization

- The active introduction now follows welcome → debate choice → SideSwitch → personalize; it remains skippable, resumable, keyboard-safe, and re-openable without erasing preferences.
- Profile photo replacement keeps the private `current.webp` object path but increments a client-only avatar revision. The shared profile-avatar snapshot appends that revision to signed image URLs, so header/profile state updates immediately without disabling normal caching or making the bucket public.
- The mobile surface uses shared responsive tokens, 16px form text, 44–48px controls, safe-area padding, compact editorial cards, and a five-destination bottom navigation. No architecture or migration changes were introduced.

## 2026-07-20 Avatar Storage RLS and build preconditions

- Avatar Storage authorization uses exact owner path equality for `<public_profile_key>/current.webp`; INSERT, UPDATE, and DELETE never accept arbitrary keys or path traversal.
- Storage SELECT keeps the bucket private, grants the owner an exact-path transition read needed by `upsert`, and routes every non-owner read through `can_view_profile_avatar`.
- Applied migrations `0025`–`0027` repair the remote policy without rewriting `0001`–`0024`.
- Production Android verification uses a process-only `https://api.example.invalid` placeholder. Local `.env` development values remain untouched.
