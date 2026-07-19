# Codex Checkpoint

## Objective

Complete SideShift Phase 4: private profiles, secure avatar media, exact-handle/friend-code discovery, friendships, blocking, direct friend challenges, Group invitations, and synchronized onboarding progress.

## Confirmed facts

- Supabase migrations are applied locally and remotely through `0020`.
- Social mutations use authenticated RPCs; local repository mode remains explicitly device-only and exposes no simulated multi-user friendship.
- The avatar bucket is private, uses opaque profile-key paths, owner-only writes, and signed reads gated by profile privacy and blocking.
- Exact discovery returns only an opaque profile key, handle, display name, preset/accent metadata, and no bio/avatar path until privacy permits it.
- Blocking atomically marks the relationship blocked, revokes open direct challenges, and revokes pending targeted Group invitations.
- Existing bearer-link challenge RPCs reject direct friend challenges and remain unchanged for bearer-link users.

## Verification

- `npm run typecheck`, `npm run lint`, targeted Vitest, `npm test`, `npm run build`, `npm run test:supabase`, `npm run test:supabase:private-social`, `npm run test:supabase:collaboration`, `npm run test:playwright:person`, `npm run test:playwright:supabase`, and `npm run test:playwright:team` pass.
- Three-user remote social/RLS test passes exact lookup, opposite-direction request resolution, duplicate prevention, outsider denial, avatar signed-read boundaries, Group invitation acceptance, blocking revocation, and cleanup.
- Remote migrations `0016`–`0020` are applied.

## Important limitations

- Physical Android camera/gallery verification remains pending; the web path uses browser-native canvas processing and the existing Capacitor foundation is not changed.
- The new Friends screen is covered by remote three-user RPC/RLS acceptance; a dedicated browser flow for its visual interaction remains future test coverage.
- The repository still contains existing bundle warnings unrelated to this phase.

## Exact next action

Inspect the final diff for the bounded migration/repository/UI scope, then commit the non-secret changes and verify a clean working tree.
