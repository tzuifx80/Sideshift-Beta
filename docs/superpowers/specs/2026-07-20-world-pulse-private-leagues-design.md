# World Pulse and Private Debate League design

## Scope

This phase adds a sourced, review-gated World Pulse collection and private weekly Friends/Group leagues. It does not add a public feed, global leaderboard, messaging, monetization, push notifications, or a live news crawler.

The applied database baseline is immutable through migration `0027`. This phase adds migration `0028_world_pulse_private_leagues.sql`; migrations `0001` through `0027` are not edited.

## Architecture

World Pulse has four boundaries:

- `world_pulse_items` stores lifecycle, neutral context, regional relevance, sensitivity, and review metadata.
- `world_pulse_translations` stores complete reviewed translations with English fallback.
- `world_pulse_sources` stores bounded source metadata only; article bodies are never copied.
- editor roles and review events are server-authorized. Ordinary users read only published, currently active payloads.

The repository maps an active World Pulse item to an existing `Take` and carries a bounded `WorldPulseSnapshot` on that Take. The snapshot is copied into the existing debate/result JSON payload, preserving historical context even when the source item later expires or changes.

Debate League uses server-owned seasons and score events:

- Friends leagues are opt-in and include only accepted friends who joined the current season.
- Group leagues are private to current Group members and default to opt-in.
- `league_score_events` is append-only through a security-definer RPC. A unique completion/reason key makes retries idempotent.
- standings are derived from score events; completed seasons are frozen and awards are computed once.

## Scoring and abuse controls

The starting scoring version awards bounded events for completed debates, SideSwitch, new categories, direct friend challenges, Team Debate participation, constructive completion, and a three-day consistency milestone. Server functions enforce completion, membership, caps, mock/development exclusion, and season state. Frontend totals are display-only.

## UX

Explore gains a bounded World Pulse tab/filter with region, category, language, sensitivity, freshness, Team Debate, and SideSwitch filters. Cards show the statement, why it matters, region, review/event dates, source count, and a Start Debate action. The existing Home world card gains one compact recommended World Pulse card.

Friends and Group detail screens gain compact private league panels with season dates, aggregate standings, own score breakdown, join/leave, awards, and past-season access. No private transcripts or stances are shown. An internal `/internal/world-pulse` route is not linked from navigation and renders only after the server authorizes the editor role.

Sensitive topics show a neutral warning before debate, can be hidden by preference, and never use sensational imagery. External source links go through the existing browser adapter with `noopener,noreferrer` behavior.

## Verification

Pure tests cover World Pulse validation, lifecycle, fallback, source deduplication, snapshot mapping, and league caps/idempotency/awards. Supabase verification covers editor authorization, draft privacy, publication, expiry, private league membership, denied direct writes, idempotent event creation, frozen seasons, Group removal, and blocked Friends behavior. Existing regression checks remain required, with physical Android UI verification reported separately.
