import { describe, expect, it } from 'vitest'
import { getTake, type ResultData } from './domain'
import { calculatePersonalStats, calculateStreak } from './stats'

const utc = 'UTC'

function result(id: string, mode: ResultData['mode'], completedAt: string, score: number): ResultData {
  const take = getTake('politics-voting-age')
  return { id, debateId: `${id}-debate`, score, movement: 1, understanding: 'yes', mode, take, assignedSide: take.supportLabel, transcript: [], scores: [{ label: 'Clarity', score: 15, explanation: 'Clear.' }, { label: 'Reasoning', score: 18, explanation: 'Specific.' }], coaching: 'Keep going.', completedAt }
}

describe('streak and personal statistics', () => {
  it('counts the first completion as one active day', () => {
    expect(calculateStreak(['2026-07-13T10:00:00.000Z'], new Date('2026-07-13T12:00:00.000Z'), utc)).toEqual({ currentStreak: 1, bestStreak: 1, totalActiveDays: 1 })
  })

  it('is idempotent for several completions on the same day', () => {
    expect(calculateStreak(['2026-07-13T10:00:00.000Z', '2026-07-13T18:00:00.000Z'], new Date('2026-07-13T20:00:00.000Z'), utc).totalActiveDays).toBe(1)
  })

  it('increments on the next day and resets after a missed day', () => {
    expect(calculateStreak(['2026-07-13T10:00:00.000Z', '2026-07-14T10:00:00.000Z'], new Date('2026-07-14T12:00:00.000Z'), utc).currentStreak).toBe(2)
    expect(calculateStreak(['2026-07-13T10:00:00.000Z', '2026-07-14T10:00:00.000Z', '2026-07-16T10:00:00.000Z'], new Date('2026-07-16T12:00:00.000Z'), utc)).toMatchObject({ currentStreak: 1, bestStreak: 2, totalActiveDays: 3 })
  })

  it('calculates useful private statistics from completed debates', () => {
    const history = [result('one', 'sideswitch', '2026-07-13T10:00:00.000Z', 80), result('two', 'classic', '2026-07-14T10:00:00.000Z', 60)]
    const stats = calculatePersonalStats(history, { challengeCreated: 2, challengeResponses: 1, activityDates: ['2026-07-14T11:00:00.000Z'] }, new Date('2026-07-14T12:00:00.000Z'), utc)
    expect(stats).toMatchObject({ currentStreak: 2, bestStreak: 2, totalActiveDays: 2, debatesCompleted: 2, sideSwitchCompleted: 1, classicCompleted: 1, averageScore: 70, strongestDimension: 'Reasoning', challengeCreated: 2, challengeResponses: 1, categoriesExplored: 1 })
  })
})
