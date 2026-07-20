import { z } from 'zod'
import type { Take } from './domain'
import type { Language } from './domain'

export type WorldPulseStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'expired' | 'rejected' | 'archived'
export type WorldPulseSensitivity = 'standard' | 'sensitive' | 'high_sensitivity'
export type WorldPulseSource = { title: string; publisher: string; url: string; publishedAt: string | null; accessedAt: string; sourceType: string; language: Language }
export type WorldPulseTranslation = { headline: string; debateStatement: string; neutralContext: string; sideALabel: string; sideBLabel: string }
export type WorldPulseSnapshot = { id: string; slug: string; headline: string; debateStatement: string; neutralContext: string; sideALabel: string; sideBLabel: string; category: string; countryCode: string | null; region: string | null; eventDate: string | null; lastReviewedAt: string; sensitivity: WorldPulseSensitivity; sources: Array<Pick<WorldPulseSource, 'title' | 'publisher' | 'url'>>; translationFallback?: boolean }
export type WorldPulseItem = {
  id: string; slug: string; status: WorldPulseStatus; headline: string; debateStatement: string; neutralContext: string; sideALabel: string; sideBLabel: string; category: string; countryCode: string | null; region: string | null; languages: Language[]; originalLanguage: Language; eventDate: string | null; publishAt: string | null; expiresAt: string | null; lastReviewedAt: string; sensitivity: WorldPulseSensitivity; sourceCount: number; sources: WorldPulseSource[]; translations: Partial<Record<Language, WorldPulseTranslation>>; snapshot: WorldPulseSnapshot; createdAt: string; updatedAt: string; createdBy: string | null; reviewedBy: string | null
}

const sourceSchema = z.object({ title: z.string().trim().min(1).max(180), publisher: z.string().trim().min(1).max(120), url: z.string().url().refine(value => value.startsWith('https://'), 'Sources must use HTTPS'), publishedAt: z.string().datetime().nullable(), accessedAt: z.string().datetime(), sourceType: z.string().trim().min(1).max(40), language: z.enum(['en', 'de', 'fr', 'es', 'it']) })
const draftSchema = z.object({ status: z.enum(['draft', 'review', 'scheduled', 'published', 'expired', 'rejected', 'archived']), headline: z.string().trim().min(8).max(180), debateStatement: z.string().trim().min(8).max(240), neutralContext: z.string().trim().min(12).max(900), sideALabel: z.string().trim().min(1).max(48), sideBLabel: z.string().trim().min(1).max(48), category: z.string().trim().min(1).max(80), countryCode: z.string().trim().max(3).nullable(), region: z.string().trim().max(80).nullable(), languages: z.array(z.enum(['en', 'de', 'fr', 'es', 'it'])).min(1), originalLanguage: z.enum(['en', 'de', 'fr', 'es', 'it']), eventDate: z.string().datetime().nullable(), publishAt: z.string().datetime().nullable(), expiresAt: z.string().datetime().nullable(), lastReviewedAt: z.string().datetime(), sensitivity: z.enum(['standard', 'sensitive', 'high_sensitivity']), sources: z.array(sourceSchema).min(1) })

export function validateWorldPulseDraft(value: unknown) {
  const parsed = draftSchema.safeParse(value)
  if (!parsed.success) return parsed
  const uniqueUrls = new Set(parsed.data.sources.map(source => source.url.toLowerCase()))
  if (uniqueUrls.size !== parsed.data.sources.length) return { success: false as const, error: new z.ZodError([{ code: 'custom', path: ['sources'], message: 'Duplicate source URL' }]) }
  if (parsed.data.status === 'published' && parsed.data.sources.length < (parsed.data.sensitivity === 'standard' ? 1 : 2)) return { success: false as const, error: new z.ZodError([{ code: 'custom', path: ['sources'], message: 'Sensitive items require two sources' }]) }
  if (parsed.data.publishAt && parsed.data.expiresAt && Date.parse(parsed.data.expiresAt) <= Date.parse(parsed.data.publishAt)) return { success: false as const, error: new z.ZodError([{ code: 'custom', path: ['expiresAt'], message: 'Expiry must follow publication' }]) }
  return parsed
}

export function isWorldPulseVisible(item: WorldPulseItem, now = new Date()): boolean {
  if (item.status !== 'published') return false
  const timestamp = now.getTime()
  return (!item.publishAt || Date.parse(item.publishAt) <= timestamp) && (!item.expiresAt || Date.parse(item.expiresAt) > timestamp)
}

export function buildWorldPulseTake(item: WorldPulseItem, language: Language): Take {
  const translation = item.translations[language] || item.translations[item.originalLanguage] || item.translations.en
  const fallback = !item.translations[language]
  const copy = translation || { headline: item.headline, debateStatement: item.debateStatement, neutralContext: item.neutralContext, sideALabel: item.sideALabel, sideBLabel: item.sideBLabel }
  const snapshot = { ...item.snapshot, headline: copy.headline, debateStatement: copy.debateStatement, neutralContext: copy.neutralContext, sideALabel: copy.sideALabel, sideBLabel: copy.sideBLabel, translationFallback: fallback }
  return { id: `world-pulse:${item.id}`, category: item.category, categoryDe: item.category, categoryClass: 'category-coral', statement: copy.debateStatement, statementDe: copy.debateStatement, context: copy.neutralContext, contextDe: copy.neutralContext, difficulty: 'Medium', time: '5 min', type: 'World Pulse', color: 'coral', supportLabel: copy.sideALabel, opposeLabel: copy.sideBLabel, worldPulse: snapshot }
}

const seedSource = (title: string, publisher: string, url: string): WorldPulseSource => ({ title, publisher, url, publishedAt: null, accessedAt: '2026-07-20T00:00:00.000Z', sourceType: 'official', language: 'en' })
function seedItem(id: string, slug: string, status: WorldPulseStatus, headline: string, debateStatement: string, neutralContext: string, category: string, countryCode: string | null, region: string, sensitivity: WorldPulseSensitivity, expiresAt: string, sources: WorldPulseSource[], translations: Partial<Record<Language, WorldPulseTranslation>> = {}): WorldPulseItem {
  const snapshot = { id, slug, headline, debateStatement, neutralContext, sideALabel: 'Support the question', sideBLabel: 'Question the question', category, countryCode, region, eventDate: null, lastReviewedAt: '2026-07-20T00:00:00.000Z', sensitivity, sources: sources.map(source => ({ title: source.title, publisher: source.publisher, url: source.url })) }
  return { id, slug, status, headline, debateStatement, neutralContext, sideALabel: snapshot.sideALabel, sideBLabel: snapshot.sideBLabel, category, countryCode, region, languages: Object.keys(translations).length ? Object.keys(translations) as Language[] : ['en'], originalLanguage: 'en', eventDate: null, publishAt: '2026-07-01T00:00:00.000Z', expiresAt, lastReviewedAt: '2026-07-20T00:00:00.000Z', sensitivity, sourceCount: sources.length, sources, translations: { en: { headline, debateStatement, neutralContext, sideALabel: snapshot.sideALabel, sideBLabel: snapshot.sideBLabel }, ...translations }, snapshot, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', createdBy: null, reviewedBy: null }
}

export const worldPulseSeed: WorldPulseItem[] = [
  seedItem('seed-school-start-times', 'school-start-times', 'published', 'Schools should start later', 'Schools should start later in the morning.', 'Later starts may support sleep, while families and transport schedules need to adapt. This is a stable demonstration item, not a live news claim.', 'School and Education', 'DE', 'Europe', 'standard', '2026-12-31T00:00:00.000Z', [seedSource('About sleep and health', 'Centers for Disease Control and Prevention', 'https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html'), seedSource('Education policy and research', 'OECD', 'https://www.oecd.org/education/')], { de: { headline: 'Schulen sollten später beginnen', debateStatement: 'Schulen sollten morgens später beginnen.', neutralContext: 'Spätere Anfangszeiten können Schlaf unterstützen, während Familien und Fahrpläne angepasst werden müssen.', sideALabel: 'Später beginnen', sideBLabel: 'Aktuelle Zeiten beibehalten' } }),
  seedItem('seed-ai-school', 'ai-use-in-schools', 'published', 'Schools should teach responsible AI use', 'Schools should teach responsible AI use as part of digital literacy.', 'Digital literacy can reduce misuse, while schools also need to protect independent thinking. This beta seed is a demonstration topic.', 'AI and Technology', null, 'World', 'standard', '2027-01-01T00:00:00.000Z', [seedSource('Guidance on AI and education', 'UNESCO', 'https://www.unesco.org/en/digital-education/artificial-intelligence'), seedSource('Digital education action plan', 'European Commission', 'https://education.ec.europa.eu/focus-topics/digital-education/action-plan')]),
  seedItem('seed-sensitive-disaster', 'disaster-coverage-and-care', 'expired', 'How should public attention respond after a disaster?', 'Public communication after a disaster should prioritize practical help over continuous coverage.', 'People need useful, respectful information after harm. This sensitive demonstration item uses neutral, non-graphic wording.', 'Society and safety', null, 'World', 'sensitive', '2026-06-01T00:00:00.000Z', [seedSource('Disaster risk reduction', 'United Nations', 'https://www.un.org/en/climatechange/climate-solutions/disaster-risk-reduction'), seedSource('Global charter of ethics for journalists', 'International Federation of Journalists', 'https://www.ifj.org/who/rules-and-policy/global-charter-of-ethics-for-journalists')]),
]
