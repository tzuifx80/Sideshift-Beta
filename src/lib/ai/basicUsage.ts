export type FreeEntitlements = { plan: 'free'; basicDebatesPerDay: number; basicMaxRounds: number; argumentLabUsesPerDay: number; advancedReplayEnabled: boolean; privateGroupLimit: number }

export function utcDateKey(value: string | Date = new Date()): string { return new Date(value).toISOString().slice(0, 10) }
export function freeEntitlements(env: Record<string, string | undefined> = {}): FreeEntitlements {
  const limit = (value: string | undefined, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback }
  return { plan: 'free', basicDebatesPerDay: limit(env.BASIC_AI_DAILY_DEBATES, 3), basicMaxRounds: limit(env.BASIC_AI_MAX_ROUNDS, 3), argumentLabUsesPerDay: 0, advancedReplayEnabled: false, privateGroupLimit: 1 }
}
export function basicUsageResponse({ debatesStarted, turnsGenerated, entitlements = freeEntitlements(), now = new Date(), reason }: { debatesStarted: number; turnsGenerated: number; entitlements?: FreeEntitlements; now?: Date; reason?: string }) {
  return { allowed: !reason && entitlements.basicDebatesPerDay > debatesStarted && entitlements.basicMaxRounds > turnsGenerated, debatesRemaining: Math.max(0, entitlements.basicDebatesPerDay - debatesStarted), turnsRemaining: Math.max(0, entitlements.basicMaxRounds - turnsGenerated), resetsAt: new Date(new Date(`${utcDateKey(now)}T00:00:00.000Z`).getTime() + 86_400_000).toISOString(), ...(reason ? { reason } : {}) }
}
export function requestScope(userId: string, debateId: string, action: string, round: number): string { return `${userId}:${debateId}:${action}:${round}` }
