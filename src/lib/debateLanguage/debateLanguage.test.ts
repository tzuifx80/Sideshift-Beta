import { describe, expect, it } from 'vitest'
import { detectDebateLanguageFromText, isSubstantiveArgument } from './detect'
import { listCoreDebateLanguages, resolveDebateLanguageOption } from './catalog'
import { lockDebateLanguage, normalizeDebateLanguageCode, resolveDebateLanguage } from './resolve'
import { isReliableCoreLanguage, isRtlLanguage } from './types'

describe('debate language model', () => {
  it('locks explicit language from setup', () => {
    const state = resolveDebateLanguage({
      mode: 'explicit',
      explicitCode: 'de',
      interfaceLocale: 'en',
    })
    expect(state.code).toBe('de')
    expect(state.locked).toBe(false)
    expect(lockDebateLanguage(state).locked).toBe(true)
  })

  it('auto-detects and locks from first substantive argument', () => {
    const state = resolveDebateLanguage({
      mode: 'auto',
      interfaceLocale: 'en',
      firstSubstantiveArgument: 'Weil Bildung wichtig ist, sollten Schulen später beginnen.',
    })
    expect(state.code).toBe('de')
    expect(state.locked).toBe(true)
  })

  it('detects Arabic script and RTL languages', () => {
    expect(detectDebateLanguageFromText('هذا قرار مهم للتعليم')).toBe('ar')
    expect(isRtlLanguage('ar')).toBe(true)
    expect(isRtlLanguage('ur')).toBe(true)
    expect(isRtlLanguage('fa')).toBe(true)
  })

  it('handles latin transliteration hints for Urdu/Hindi', () => {
    expect(detectDebateLanguageFromText('yeh faisla sahi nahin kyunki taleem zaroori hai', 'en')).toBe('ur')
  })

  it('normalizes persisted codes on restore', () => {
    expect(normalizeDebateLanguageCode('DE', 'en')).toBe('de')
    const restored = resolveDebateLanguage({
      mode: 'explicit',
      explicitCode: 'fr',
      lockedCode: 'fr',
      locked: true,
      interfaceLocale: 'en',
    })
    expect(restored.code).toBe('fr')
    expect(restored.locked).toBe(true)
  })

  it('documents reliable core support honestly', () => {
    expect(isReliableCoreLanguage('it')).toBe(true)
    expect(isReliableCoreLanguage('ar')).toBe(false)
    expect(resolveDebateLanguageOption('ar').reliableCore).toBe(false)
    expect(resolveDebateLanguageOption('ar').hostedOnline).toBe(true)
    expect(listCoreDebateLanguages()).toHaveLength(5)
  })

  it('does not treat one-word messages as substantive', () => {
    expect(isSubstantiveArgument('maybe')).toBe(false)
    expect(isSubstantiveArgument('This is long enough to count.')).toBe(true)
  })
})
