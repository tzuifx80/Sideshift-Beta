import { describe, expect, it } from 'vitest'
import { validateResponseLanguage } from './languageValidator'
import { validateDebateResponse } from './responseValidator'
import { formatBoundedTranscript } from './boundedTranscript'

describe('debate quality validation', () => {
  it('detects wrong-language English during German debate', () => {
    const result = validateResponseLanguage('The schedule should stay the same because students need routine and parents rely on it.', 'de')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('wrong_language')
  })

  it('accepts German response for German debate', () => {
    const result = validateResponseLanguage('Der Stundenplan sollte gleich bleiben, weil Routinen wichtig sind und Eltern darauf angewiesen sind.', 'de')
    expect(result.ok).toBe(true)
  })

  it('flags locale keys and empty output', () => {
    expect(validateResponseLanguage('ai.active.responseStopped', 'en').ok).toBe(false)
    expect(validateResponseLanguage('!!!', 'en').ok).toBe(false)
  })

  it('requires engagement with newest argument', () => {
    const result = validateDebateResponse({
      text: 'Climate policy is complicated and many countries disagree about priorities over decades.',
      expectedLanguage: 'en',
      motion: 'Schools should start later',
      newestArgument: 'Later starts improve teen sleep and attendance.',
      previousOpponentTexts: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failures).toContain('no_engagement')
  })

  it('preserves newest argument in bounded transcript', () => {
    const newest = 'This is the newest claim about sleep research.'
    const body = formatBoundedTranscript({
      motion: 'Schools should start later',
      userSide: 'Later',
      aiSide: 'Earlier',
      languageCode: 'en',
      languageName: 'English',
      newestArgument: newest,
      turns: [
        { role: 'user', round: 1, content: 'Older point one' },
        { role: 'opponent', round: 1, content: 'Older reply one' },
      ],
      tacticsUsed: ['trade-off'],
      round: 2,
      roundLimit: 3,
      maxChars: 1200,
    })
    expect(body).toContain(newest)
    expect(body.indexOf(newest)).toBeGreaterThan(body.indexOf('Older point one'))
  })

  it('detects near-duplicate opponent responses', () => {
    const previous = 'Later starts harm working parents and bus schedules across districts.'
    const result = validateDebateResponse({
      text: 'Later starts harm working parents and bus schedules across many districts.',
      expectedLanguage: 'en',
      motion: 'Schools should start later',
      newestArgument: 'Sleep matters for learning.',
      previousOpponentTexts: [previous],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.failures).toContain('repetition')
  })
})
