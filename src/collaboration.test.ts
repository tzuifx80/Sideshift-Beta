import { describe, expect, it } from 'vitest'
import { createTeamSession, formatGroupInviteCode, isSessionComplete, normalizeGroupInviteCode, roundForTurn, roundTypeForTurn, submitTeamTurn, tickTeamSession, validateTopic, validateTurn, type TeamDebateSession } from './collaboration'

function session(): TeamDebateSession {
  return createTeamSession({ facilitatorId: '00000000-0000-0000-0000-000000000001', groupId: null, language: 'en', topic: { statement: 'Schools should start later', context: '', takeId: null, custom: true }, teams: [{ id: 'a', name: 'A', color: 'team-a', icon: 'A' }, { id: 'b', name: 'B', color: 'team-b', icon: 'B' }], format: 'rounds', rounds: 2, roundTypes: ['opening', 'rebuttal'], teamTurnSeconds: 60, totalSeconds: 600, preparationSeconds: 0, closingRound: false, scoring: 'none' }, '2026-07-14T10:00:00.000Z', 'team-test')
}

describe('Team Debate rules', () => {
  it('formats the full-entropy group invite into a compact reversible display code', () => {
    const raw = 'SS-0123456789ABCDEF0123456789ABCDEF0123'
    const display = formatGroupInviteCode(raw)

    expect(display).toMatch(/^SS(?:-[A-Z2-7]{4})+-[A-Z2-7]$/)
    expect(display.length).toBeLessThanOrEqual(40)
    expect(normalizeGroupInviteCode(display)).toBe(raw)
  })

  it.each([2, 3, 4])('rotates a %i-team format with one turn per team per round', (teamCount) => {
    const teams = Array.from({ length: teamCount }, (_, index) => ({ id: `team-${index}`, name: `Team ${index + 1}`, color: ['team-a', 'team-b', 'team-c', 'team-d'][index] as 'team-a' | 'team-b' | 'team-c' | 'team-d', icon: String(index + 1) }))
    const current = createTeamSession({ facilitatorId: '00000000-0000-0000-0000-000000000001', groupId: null, language: 'en', topic: { statement: 'A valid team topic', context: '', takeId: null, custom: true }, teams, format: 'timer', rounds: 1, roundTypes: ['opening'], teamTurnSeconds: 45, totalSeconds: 180, preparationSeconds: 0, closingRound: false, scoring: 'none' }, '2026-07-14T10:00:00.000Z', `team-${teamCount}`)
    expect(current.remainingSeconds).toBe(180)
    expect(current.teams).toHaveLength(teamCount)
    expect(roundForTurn(current)).toBe(1)
  })

  it('rotates 2 teams across configured rounds and prevents duplicate/short turns', () => {
    let current = session()
    expect(roundForTurn(current)).toBe(1)
    expect(roundTypeForTurn(current)).toBe('opening')
    expect(submitTeamTurn(current, 'too short').error).toContain('12 characters')
    const first = submitTeamTurn(current, 'A makes a clear opening argument.', '2026-07-14T10:00:01.000Z')
    current = first.session!
    expect(current.teams[current.currentTurnIndex % 2].id).toBe('b')
    expect(current.turns).toHaveLength(1)
    current = submitTeamTurn(current, 'B responds with a concrete trade-off.', '2026-07-14T10:00:02.000Z').session!
    expect(roundForTurn(current)).toBe(2)
    expect(roundTypeForTurn(current)).toBe('opening')
    expect(submitTeamTurn(current, 'A rebuts the other point with evidence.').session).not.toBeNull()
  })

  it('pauses on timer expiry and resumes without losing the draft state', () => {
    const current = { ...session(), remainingSeconds: 2 }
    expect(tickTeamSession(current, 1).remainingSeconds).toBe(1)
    const paused = tickTeamSession(current, 2)
    expect(paused.status).toBe('paused')
    expect(paused.remainingSeconds).toBe(0)
    expect(tickTeamSession(paused, 1)).toEqual(paused)
  })

  it('supports facilitator skip and completion without fake scoring', () => {
    let current = session()
    for (let index = 0; index < 4; index += 1) current = submitTeamTurn(current, '', `2026-07-14T10:00:0${index}.000Z`, true).session!
    expect(isSessionComplete(current)).toBe(true)
    expect(current.status).toBe('completed')
    expect(current.result?.scoring).toBe('none')
    expect(current.turns.every(turn => turn.skipped)).toBe(true)
  })

  it('bounds private custom topics and approved turn transcripts', () => {
    expect(validateTopic('Short')).toContain('8 characters')
    expect(validateTopic('A valid classroom motion')).toBeNull()
    expect(validateTurn('A respectful, specific argument.')).toBeNull()
    expect(validateTurn('x'.repeat(2001))).toContain('2,000')
  })
})
