import { describe, expect, it } from 'vitest'
import { greetingKey, localeLabels, localeMessages, localizeTake, translate } from './index'
import { takes } from '../domain'
import { supportedLanguages } from './types'

describe('typed localization', () => {
  it('keeps all locale keys populated and in parity', () => {
    const keys = Object.keys(localeMessages.en).sort()
    for (const language of supportedLanguages) {
      expect(Object.keys(localeMessages[language]).sort()).toEqual(keys)
      for (const key of keys) expect(localeMessages[language][key as keyof typeof localeMessages.en].trim()).not.toBe('')
    }
  })

  it('localizes time-aware greetings', () => {
    expect(translate('de', greetingKey(new Date(2026, 6, 15, 8)), { name: 'Ada' })).toContain('Guten Morgen')
    expect(translate('fr', greetingKey(new Date(2026, 6, 15, 19)), { name: 'Ada' })).toContain('Bonsoir')
    expect(translate('es', greetingKey(new Date(2026, 6, 15, 14)), { name: 'Ada' })).toContain('Buenas tardes')
  })

  it('keeps built-in fallback content explicit', () => {
    const take = takes.find(item => item.id === 'politics-voting-age') || takes[0]
    expect(localizeTake(take, 'it').sourceLanguage).toBe('en')
    expect(localizeTake(take, 'de').sourceLanguage).toBeUndefined()
  })

  it('preserves accented punctuation without mojibake markers', () => {
    const allText = JSON.stringify(localeMessages)
    expect(allText).not.toMatch(/[\u00C2\u00C3\uFFFD]|\u00E2(?:\u20AC\u2122|\u20AC\u0153|\u20AC)/)
    expect(Object.values(localeLabels)).toEqual(expect.arrayContaining(['Français', 'Español', 'Italiano']))
  })
})
