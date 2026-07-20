import type { Language, Take } from '../domain'
import { de } from './locales/de'
import { en } from './locales/en'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { it } from './locales/it'
import { phase2Messages } from './phase2'
import { debateMessages, stanceMessages } from './debate'
import { resultsMessages } from './results'
import { activeAiMessages } from './aiActive'
import { teamMessages } from './team'
import { responseMessages } from './response'
import { groupMessages } from './groups'
import { phase3Messages, phase3OnboardingMessages } from './phase3'
import { phase4OnboardingMessages } from './phase4Onboarding'
import { phase5ProfileMessages } from './phase5Profile'
import type { LocaleMessages, TranslationKey, Translator } from './types'

export { supportedLanguages } from './types'
export type { TranslationKey, Translator } from './types'

export const LOCALE_STORAGE_KEY = 'sideshift-locale-v1'
export const localeLabels: Record<Language, string> = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano' }
const locales: Record<Language, LocaleMessages> = {
  en: Object.assign({}, en, phase2Messages.en, phase3Messages.en, phase3OnboardingMessages.en, phase4OnboardingMessages.en, phase5ProfileMessages.en, debateMessages.en, stanceMessages.en, resultsMessages.en, activeAiMessages.en, teamMessages.en, responseMessages.en, groupMessages.en) as LocaleMessages,
  de: Object.assign({}, de, phase2Messages.de, phase3Messages.de, phase3OnboardingMessages.de, phase4OnboardingMessages.de, phase5ProfileMessages.de, debateMessages.de, stanceMessages.de, resultsMessages.de, activeAiMessages.de, teamMessages.de, responseMessages.de, groupMessages.de) as LocaleMessages,
  fr: Object.assign({}, fr, phase2Messages.fr, phase3Messages.fr, phase3OnboardingMessages.fr, phase4OnboardingMessages.fr, phase5ProfileMessages.fr, debateMessages.fr, stanceMessages.fr, resultsMessages.fr, activeAiMessages.fr, teamMessages.fr, responseMessages.fr, groupMessages.fr) as LocaleMessages,
  es: Object.assign({}, es, phase2Messages.es, phase3Messages.es, phase3OnboardingMessages.es, phase4OnboardingMessages.es, phase5ProfileMessages.es, debateMessages.es, stanceMessages.es, resultsMessages.es, activeAiMessages.es, teamMessages.es, responseMessages.es, groupMessages.es) as LocaleMessages,
  it: Object.assign({}, it, phase2Messages.it, phase3Messages.it, phase3OnboardingMessages.it, phase4OnboardingMessages.it, phase5ProfileMessages.it, debateMessages.it, stanceMessages.it, resultsMessages.it, activeAiMessages.it, teamMessages.it, responseMessages.it, groupMessages.it) as LocaleMessages,
}
export const localeMessages = locales

export function isLanguage(value: unknown): value is Language { return value === 'en' || value === 'de' || value === 'fr' || value === 'es' || value === 'it' }

export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'
  const code = navigator.language.toLowerCase().slice(0, 2)
  return isLanguage(code) ? code : 'en'
}

export function readStoredLanguage(): Language | null {
  if (typeof window === 'undefined') return null
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return isLanguage(value) ? value : null
}

export function getInitialLanguage(): Language { return readStoredLanguage() || detectLanguage() }

export function persistLanguage(language: Language): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(LOCALE_STORAGE_KEY, language)
}

export function translate(language: Language, key: TranslationKey, values: Record<string, string | number> = {}): string {
  const template = locales[language][key] || en[key]
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
}

export function useTranslations(language: Language): Translator { return (key, values) => translate(language, key, values) }

const categoryNames: Record<string, Record<Language, string>> = {
  'Politics and Democracy': { en: 'Politics and Democracy', de: 'Politik und Demokratie', fr: 'Politique et démocratie', es: 'Política y democracia', it: 'Politica e democrazia' },
  'Civil Rights and Equality': { en: 'Civil Rights and Equality', de: 'Bürgerrechte und Gleichheit', fr: 'Droits civiques et égalité', es: 'Derechos civiles e igualdad', it: 'Diritti civili e uguaglianza' },
  'LGBTQ+ Rights': { en: 'LGBTQ+ Rights', de: 'LGBTQ+-Rechte', fr: 'Droits LGBTQ+', es: 'Derechos LGBTQ+', it: 'Diritti LGBTQ+' },
  "Women's Rights and Gender Equality": { en: "Women's Rights and Gender Equality", de: 'Frauenrechte und Geschlechtergerechtigkeit', fr: 'Droits des femmes et égalité', es: 'Derechos de las mujeres e igualdad', it: 'Diritti delle donne e parità' },
  'Climate and Environment': { en: 'Climate and Environment', de: 'Klima und Umwelt', fr: 'Climat et environnement', es: 'Clima y medioambiente', it: 'Clima e ambiente' },
  Football: { en: 'Football', de: 'Fußball', fr: 'Football', es: 'Fútbol', it: 'Calcio' }, Gaming: { en: 'Gaming', de: 'Gaming', fr: 'Jeux vidéo', es: 'Videojuegos', it: 'Gaming' },
  'AI and Technology': { en: 'AI and Technology', de: 'KI und Technologie', fr: 'IA et technologie', es: 'IA y tecnología', it: 'IA e tecnologia' },
  'Movies and Series': { en: 'Movies and Series', de: 'Filme und Serien', fr: 'Films et séries', es: 'Películas y series', it: 'Film e serie' },
  'Music and Culture': { en: 'Music and Culture', de: 'Musik und Kultur', fr: 'Musique et culture', es: 'Música y cultura', it: 'Musica e cultura' },
  'Relationships and Everyday Life': { en: 'Relationships and Everyday Life', de: 'Alltag und Beziehungen', fr: 'Relations et vie quotidienne', es: 'Relaciones y vida cotidiana', it: 'Relazioni e vita quotidiana' },
  'Ethics and Philosophy': { en: 'Ethics and Philosophy', de: 'Ethik und Philosophie', fr: 'Éthique et philosophie', es: 'Ética y filosofía', it: 'Etica e filosofia' },
  'School and Education': { en: 'School and Education', de: 'Schule und Bildung', fr: 'École et éducation', es: 'Escuela y educación', it: 'Scuola e istruzione' },
  'Internet and Social Media': { en: 'Internet and Social Media', de: 'Internet und soziale Medien', fr: 'Internet et réseaux sociaux', es: 'Internet y redes sociales', it: 'Internet e social media' },
  'Economics and Inequality': { en: 'Economics and Inequality', de: 'Wirtschaft und Ungleichheit', fr: 'Économie et inégalités', es: 'Economía y desigualdad', it: 'Economia e disuguaglianza' },
  Wildcards: { en: 'Wildcards', de: 'Wildcard', fr: 'Inattendus', es: 'Imprevistos', it: 'Jolly' },
  'Society & technology': { en: 'Society & technology', de: 'Gesellschaft & Technologie', fr: 'Société et technologie', es: 'Sociedad y tecnología', it: 'Società e tecnologia' },
}

const takeTranslations: Record<string, Partial<Record<Language, { statement: string; context: string }>>> = {
  'society-media-age': {
    fr: { statement: 'Les réseaux sociaux devraient être réservés aux personnes de 16 ans et plus.', context: 'Les partisans insistent sur la sécurité et le bien-être. Les opposants parlent d’accès, d’autonomie et d’application.' },
    es: { statement: 'Las redes sociales deberían limitarse a usuarios de 16 años o más.', context: 'Quienes apoyan la idea priorizan la seguridad y el bienestar. Quienes se oponen señalan el acceso, la autonomía y la aplicación.' },
    it: { statement: 'I social network dovrebbero essere riservati agli utenti dai 16 anni in su.', context: 'I sostenitori puntano su sicurezza e benessere. Gli oppositori su accesso, autonomia e applicabilità.' },
  },
}

export function localizeTake(take: Take, language: Language): { statement: string; context: string; category: string; sourceLanguage?: Language } {
  if (language === 'de') return { statement: take.statementDe, context: take.contextDe, category: take.categoryDe }
  const translated = takeTranslations[take.id]?.[language]
  if (translated) return { ...translated, category: categoryNames[take.category]?.[language] || take.category }
  return { statement: take.statement, context: take.context, category: categoryNames[take.category]?.[language] || take.category, ...(language === 'en' ? {} : { sourceLanguage: 'en' as const }) }
}

export function localizeInterest(value: string, language: Language): string { return categoryNames[value]?.[language] || value }

export function formatDate(value: string, language: Language): string { return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(value)) }
export function formatNumber(value: number, language: Language): string { return new Intl.NumberFormat(language).format(value) }
export function greetingKey(date = new Date()): TranslationKey { const hour = date.getHours(); return hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening' }
