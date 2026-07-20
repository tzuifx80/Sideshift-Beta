export type LeagueActivityType = 'completed_debate' | 'friend_challenge' | 'team_debate'
export type LeagueActivity = { completionId: string; type: LeagueActivityType; mode: string; category: string; completedAt: string; isMock: boolean; isCompleted: boolean; constructive?: boolean }
export type LeagueScoreReason = 'completed_debate' | 'sideswitch' | 'topic_variety' | 'friend_challenge' | 'team_debate' | 'constructive_completion' | 'weekly_consistency'
export type LeagueScoreEvent = { id: string; completionId: string; reason: LeagueScoreReason; points: number; occurredAt: string; category: string }

const points: Record<LeagueScoreReason, number> = { completed_debate: 10, sideswitch: 4, topic_variety: 3, friend_challenge: 5, team_debate: 5, constructive_completion: 2, weekly_consistency: 5 }
const dayKey = (value: string) => value.slice(0, 10)

export function canAddLeagueActivity(activity: LeagueActivity, existing: LeagueScoreEvent[]): { allowed: boolean; reason?: 'mock_activity' | 'incomplete' | 'duplicate' | 'daily_cap' } {
  if (activity.isMock) return { allowed: false, reason: 'mock_activity' }
  if (!activity.isCompleted) return { allowed: false, reason: 'incomplete' }
  if (existing.some(event => event.completionId === activity.completionId)) return { allowed: false, reason: 'duplicate' }
  const todayPoints = existing.filter(event => dayKey(event.occurredAt) === dayKey(activity.completedAt)).reduce((total, event) => total + event.points, 0)
  return todayPoints >= 30 ? { allowed: false, reason: 'daily_cap' } : { allowed: true }
}

export function calculateLeagueEvents(activity: LeagueActivity, existing: LeagueScoreEvent[]): LeagueScoreEvent[] {
  if (!canAddLeagueActivity(activity, existing).allowed) return []
  const occurredAt = activity.completedAt
  const events: LeagueScoreEvent[] = [{ id: `${activity.completionId}:completed_debate`, completionId: activity.completionId, reason: 'completed_debate', points: points.completed_debate, occurredAt, category: activity.category }]
  if (activity.mode === 'sideswitch') events.push({ id: `${activity.completionId}:sideswitch`, completionId: activity.completionId, reason: 'sideswitch', points: points.sideswitch, occurredAt, category: activity.category })
  if (!existing.some(event => event.category === activity.category)) events.push({ id: `${activity.completionId}:topic_variety`, completionId: activity.completionId, reason: 'topic_variety', points: points.topic_variety, occurredAt, category: activity.category })
  if (activity.type === 'friend_challenge') events.push({ id: `${activity.completionId}:friend_challenge`, completionId: activity.completionId, reason: 'friend_challenge', points: points.friend_challenge, occurredAt, category: activity.category })
  if (activity.type === 'team_debate') events.push({ id: `${activity.completionId}:team_debate`, completionId: activity.completionId, reason: 'team_debate', points: points.team_debate, occurredAt, category: activity.category })
  if (activity.constructive) events.push({ id: `${activity.completionId}:constructive_completion`, completionId: activity.completionId, reason: 'constructive_completion', points: points.constructive_completion, occurredAt, category: activity.category })
  return events
}

export type LeagueAwardCandidate = { userId: string; totalPoints: number; completedDebates: number; categories: number; activityDays: number }
export function finalizeLeague(season: { status: 'scheduled' | 'active' | 'completed' | 'archived' | 'cancelled'; endAt: string }, candidates: LeagueAwardCandidate[], now = new Date('2026-07-20T00:00:00.000Z')) {
  if (season.status === 'completed' || season.status === 'archived' || season.status === 'cancelled') return { status: season.status, awards: [] as Array<{ userId: string; award: string }> }
  if (Date.parse(season.endAt) > now.getTime()) return { status: season.status, awards: [] as Array<{ userId: string; award: string }> }
  const awards: Array<{ userId: string; award: string }> = []
  for (const candidate of candidates) {
    if (candidate.categories >= 2) awards.push({ userId: candidate.userId, award: 'Topic Explorer' })
    if (candidate.activityDays >= 3) awards.push({ userId: candidate.userId, award: 'Most Consistent' })
  }
  return { status: 'completed' as const, awards }
}
