# Database schema

The source of truth is the versioned sequence `supabase/migrations/0001` through `0005`.

## Private tables

- `profiles`, `user_preferences`: owner profile and onboarding data.
- `debates`, `debate_turns`, `stance_snapshots`, `debate_results`: owner-scoped debate state, transcript turns, private stances, and results.
- `challenges`, `challenge_responses`: private-link challenge metadata and one response/comparison.
- `reports`: authenticated reporter and target metadata.
- `user_rate_limits`: user-scoped RPC throttle counters; direct browser access is revoked.
- `analytics_events`: allow-listed event names and bounded scalar properties; direct browser access is revoked.

## Security boundary

RLS protects private rows. Challenge preview/completion, report insertion, deletion, and rate limiting use validated security-definer RPCs with fixed search paths. Challenge tokens are generated and hashed in Postgres; raw tokens are returned only when creating a link. Expiry, row locking, creator self-response rejection, and single-use constraints are enforced in the database.

`delete_my_beta_data()` deletes the caller’s profile, preferences, debates/results, challenges, reports, and rate-limit rows. It sets `challenge_responses.responder_id` to null on another user’s challenge so that creator-owned result data can remain without identifying the responder.

## Validation

Zod validates client rows/snapshots. Postgres constraints bound content, stance, confidence, modes, statuses, and JSON shapes. Unique turn sequences, challenge responses, and report target/reason combinations prevent duplicate writes.
