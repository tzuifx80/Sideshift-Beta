export const BASIC_USAGE_REASONS = ['quota_exhausted', 'rate_limited', 'provider_unavailable', 'invalid_request']

export function utcDateKey(value = new Date()) {
  return new Date(value).toISOString().slice(0, 10)
}

export function parsePositiveLimit(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function freeEntitlements(env = {}) {
  return {
    plan: 'free',
    basicDebatesPerDay: parsePositiveLimit(env.BASIC_AI_DAILY_DEBATES, 3),
    basicMaxRounds: parsePositiveLimit(env.BASIC_AI_MAX_ROUNDS, 3),
    argumentLabUsesPerDay: 0,
    advancedReplayEnabled: false,
    privateGroupLimit: 1,
  }
}

export function basicUsageResponse({ debatesStarted, turnsGenerated, entitlements = freeEntitlements(), now = new Date(), reason }) {
  const debatesRemaining = Math.max(0, entitlements.basicDebatesPerDay - debatesStarted)
  const turnsRemaining = Math.max(0, entitlements.basicMaxRounds - turnsGenerated)
  return {
    allowed: !reason && debatesRemaining > 0 && turnsRemaining > 0,
    debatesRemaining,
    turnsRemaining,
    resetsAt: new Date(new Date(`${utcDateKey(now)}T00:00:00.000Z`).getTime() + 86_400_000).toISOString(),
    ...(reason ? { reason } : {}),
  }
}

export function requestScope(userId, debateId, action, round) {
  return `${userId}:${debateId}:${action}:${round}`
}
