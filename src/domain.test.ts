import { describe, expect, it } from 'vitest'
import { assignSide, calculateMockScore, createMockOpponent, getTake, interestOptions, movementBetween, personalizeTakes, opponentSchema, selectPersonalizedTakes, takes } from './domain'

describe('SideShift domain rules', () => {
  const take = getTake('society-media-age')

  it('assigns the opposite side in SideSwitch and the selected side in Classic', () => {
    expect(assignSide(2, 'classic', take)).toBe(take.supportLabel)
    expect(assignSide(2, 'sideswitch', take)).toBe(take.opposeLabel)
    expect(assignSide(-2, 'sideswitch', take)).toBe(take.supportLabel)
  })

  it('calculates bounded stance movement', () => {
    expect(movementBetween(-2, 2)).toBe(4)
    expect(movementBetween(2, -2)).toBe(-4)
    expect(movementBetween(1, 1)).toBe(0)
  })

  it('personalizes the library without removing the full catalog', () => {
    const personalized = personalizeTakes(['Football'])
    expect(personalized).toHaveLength(takes.length)
    expect(personalized[0].category).toBe('Football')
  })

  it('covers the expanded private interest taxonomy and excludes recent takes', () => {
    expect(interestOptions).toEqual(expect.arrayContaining(['Politics and Democracy', 'Civil Rights and Equality', 'LGBTQ+ Rights', 'Women\'s Rights and Gender Equality', 'Climate and Environment', 'Football', 'Gaming', 'AI and Technology', 'Movies and Series', 'Music and Culture', 'Relationships and Everyday Life', 'Ethics and Philosophy', 'School and Education', 'Internet and Social Media', 'Economics and Inequality', 'Wildcards']))
    const selected = selectPersonalizedTakes(['Politics and Democracy'], ['politics-voting-age'], 3)
    expect(selected).toHaveLength(3)
    expect(selected.every(take => take.id !== 'politics-voting-age')).toBe(true)
    expect(selected[0].category).toBe('Politics and Democracy')
  })

  it('scores argument technique within bounds and responds to transcript length', () => {
    const short = calculateMockScore({ 1: 'A short point that is still long enough.', 2: 'A direct rebuttal with a concrete trade-off.' }, 'yes', 1)
    const long = calculateMockScore({ 1: 'A'.repeat(250), 2: 'B'.repeat(250), 3: 'C'.repeat(220), 4: 'D'.repeat(180), 5: 'E'.repeat(180) }, 'yes', 1)
    expect(short.total).toBeGreaterThanOrEqual(0)
    expect(short.total).toBeLessThanOrEqual(100)
    expect(long.total).toBeGreaterThan(short.total)
  })

  it('builds a relevant opponent response from the latest argument', () => {
    const output = createMockOpponent(take, take.opposeLabel, 2, 'Safety matters, but autonomy also matters for teenagers.', 'en')
    expect(output.response).toContain('Safety matters')
    expect(output.question).toContain('defend')
    expect(() => opponentSchema.parse({ ...output, response: '' })).toThrow()
  })
})
