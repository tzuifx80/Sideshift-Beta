import type { ResultData } from './domain'
import type { UserStatsSnapshot } from './data/types'

export type PersonalStats = {
  currentStreak: number
  bestStreak: number
  totalActiveDays: number
  debatesCompleted: number
  sideSwitchCompleted: number
  classicCompleted: number
  averageScore: number
  strongestDimension: string
  challengeCreated: number
  challengeResponses: number
  categoriesExplored: number
}

function localDateKey(value: Date | string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function previousDate(key: string): string {
  const date = new Date(`${key}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function calculateStreak(activityDates: string[], now = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): { currentStreak: number; bestStreak: number; totalActiveDays: number } {
  const days = new Set(activityDates.map(value => localDateKey(value, timezone)))
  const sorted = [...days].sort()
  let bestStreak = 0
  let run = 0
  let previous = ''
  for (const day of sorted) {
    run = previous && previousDate(day) === previous ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = day
  }
  let currentStreak = 0
  let cursor = localDateKey(now, timezone)
  if (days.has(cursor)) {
    while (days.has(cursor)) {
      currentStreak += 1
      cursor = previousDate(cursor)
    }
  }
  return { currentStreak, bestStreak, totalActiveDays: days.size }
}

export function calculatePersonalStats(history: ResultData[], snapshot: UserStatsSnapshot, now = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone): PersonalStats {
  const activityDates = [...snapshot.activityDates, ...history.map(result => result.completedAt)]
  const streak = calculateStreak(activityDates, now, timezone)
  const dimensions = new Map<string, number>()
  const categories = new Set<string>()
  for (const result of history) {
    categories.add(result.take.category)
    for (const score of result.scores) dimensions.set(score.label, (dimensions.get(score.label) || 0) + score.score)
  }
  const strongestDimension = [...dimensions.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '—'
  return {
    ...streak,
    debatesCompleted: history.length,
    sideSwitchCompleted: history.filter(result => result.mode === 'sideswitch').length,
    classicCompleted: history.filter(result => result.mode === 'classic').length,
    averageScore: (() => { const scored = history.filter(result => typeof result.score === 'number'); return scored.length ? Math.round(scored.reduce((sum, result) => sum + (result.score || 0), 0) / scored.length) : 0 })(),
    strongestDimension,
    challengeCreated: snapshot.challengeCreated,
    challengeResponses: snapshot.challengeResponses,
    categoriesExplored: categories.size,
  }
}
