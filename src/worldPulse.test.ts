import { describe, expect, it } from 'vitest'
import { buildWorldPulseTake, isWorldPulseVisible, validateWorldPulseDraft, type WorldPulseItem } from './worldPulse'

const item: WorldPulseItem = {
  id: 'pulse-1', slug: 'school-start-times', status: 'published', headline: 'Schools should start later', debateStatement: 'Schools should start later in the morning.', neutralContext: 'Later starts may support sleep, while families and transport schedules need to adapt.', sideALabel: 'Start later', sideBLabel: 'Keep current times', category: 'School and Education', countryCode: 'DE', region: 'Europe', languages: ['en', 'de'], originalLanguage: 'en', eventDate: '2026-08-01T00:00:00.000Z', publishAt: '2026-07-01T00:00:00.000Z', expiresAt: '2026-12-31T00:00:00.000Z', lastReviewedAt: '2026-07-20T00:00:00.000Z', sensitivity: 'standard', sourceCount: 2, sources: [{ title: 'Sleep and health', publisher: 'CDC', url: 'https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html', publishedAt: null, accessedAt: '2026-07-20T00:00:00.000Z', sourceType: 'official', language: 'en' }, { title: 'Education context', publisher: 'OECD', url: 'https://www.oecd.org/education/', publishedAt: null, accessedAt: '2026-07-20T00:00:00.000Z', sourceType: 'institutional', language: 'en' }], translations: { en: { headline: 'Schools should start later', debateStatement: 'Schools should start later in the morning.', neutralContext: 'Later starts may support sleep, while families and transport schedules need to adapt.', sideALabel: 'Start later', sideBLabel: 'Keep current times' } }, snapshot: { id: 'pulse-1', slug: 'school-start-times', headline: 'Schools should start later', debateStatement: 'Schools should start later in the morning.', neutralContext: 'Later starts may support sleep, while families and transport schedules need to adapt.', sideALabel: 'Start later', sideBLabel: 'Keep current times', category: 'School and Education', countryCode: 'DE', region: 'Europe', eventDate: '2026-08-01T00:00:00.000Z', lastReviewedAt: '2026-07-20T00:00:00.000Z', sensitivity: 'standard', sources: [{ title: 'Sleep and health', publisher: 'CDC', url: 'https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html' }, { title: 'Education context', publisher: 'OECD', url: 'https://www.oecd.org/education/' }] }, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', createdBy: null, reviewedBy: null,
}

describe('World Pulse', () => {
  it('only exposes published items during their scheduled window', () => {
    expect(isWorldPulseVisible(item, new Date('2026-07-20T12:00:00.000Z'))).toBe(true)
    expect(isWorldPulseVisible({ ...item, status: 'scheduled' }, new Date('2026-07-20T12:00:00.000Z'))).toBe(false)
    expect(isWorldPulseVisible(item, new Date('2027-01-01T00:00:00.000Z'))).toBe(false)
  })

  it('falls back to reviewed English copy and marks the fallback', () => {
    const take = buildWorldPulseTake(item, 'fr')
    expect(take.statement).toBe(item.debateStatement)
    expect(take.worldPulse?.translationFallback).toBe(true)
  })

  it('rejects publication without reviewed context and sources', () => {
    expect(validateWorldPulseDraft({ ...item, neutralContext: '', sources: [] }).success).toBe(false)
    expect(validateWorldPulseDraft({ ...item, sensitivity: 'high_sensitivity', sources: [item.sources[0]] }).success).toBe(false)
  })
})
