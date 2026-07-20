import { describe, expect, it } from 'vitest'
import { calculateLeagueEvents, canAddLeagueActivity, finalizeLeague, type LeagueActivity, type LeagueScoreEvent } from './league'

const activity: LeagueActivity = { completionId: 'debate-1', type: 'completed_debate', mode: 'classic', category: 'School and Education', completedAt: '2026-07-20T10:00:00.000Z', isMock: false, isCompleted: true }

describe('private Debate League scoring', () => {
  it('is idempotent and awards bounded reasons for one completion', () => {
    const events = calculateLeagueEvents(activity, [])
    expect(events.map(event => event.reason)).toContain('completed_debate')
    expect(calculateLeagueEvents(activity, events)).toEqual([])
  })

  it('rejects mock activity and enforces the daily cap', () => {
    expect(canAddLeagueActivity({ ...activity, isMock: true }, [])).toEqual({ allowed: false, reason: 'mock_activity' })
    const prior: LeagueScoreEvent[] = Array.from({ length: 3 }, (_, index) => ({ id: `e-${index}`, completionId: `old-${index}`, reason: 'completed_debate', points: 10, occurredAt: '2026-07-20T08:00:00.000Z', category: 'School and Education' }))
    expect(canAddLeagueActivity(activity, prior)).toEqual({ allowed: false, reason: 'daily_cap' })
  })

  it('freezes a completed season and calculates supported awards once', () => {
    const result = finalizeLeague({ status: 'active', endAt: '2026-07-19T00:00:00.000Z' }, [{ userId: 'a', totalPoints: 20, completedDebates: 2, categories: 2, activityDays: 2 }])
    expect(result.status).toBe('completed')
    expect(result.awards).toEqual([{ userId: 'a', award: 'Topic Explorer' }])
    expect(finalizeLeague({ status: 'completed', endAt: '2026-07-19T00:00:00.000Z' }, [])).toEqual({ status: 'completed', awards: [] })
  })
})
