import { describe, expect, it } from 'vitest'
import { translate } from '../../i18n'

describe('argument hint translations', () => {
  it('exposes static round hints in all locales', () => {
    for (const language of ['en', 'de', 'fr', 'es', 'it'] as const) {
      expect(translate(language, 'ai.argumentHint.title').length).toBeGreaterThan(3)
      expect(translate(language, 'ai.argumentHint.round1')).toContain(' ')
      expect(translate(language, 'ai.active.yourTurn').length).toBeGreaterThan(5)
    }
  })
})
