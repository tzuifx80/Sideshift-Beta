import type { Language } from '../domain'
import type { LocaleMessages, TranslationKey } from './types'

type ResponseMessages = Partial<Record<TranslationKey, string>>

export const responseMessages: Record<Language, ResponseMessages> = {
  en: { 'ai.responseConcise': 'Concise', 'ai.responseConciseBody': 'Short, direct replies', 'ai.responseStandard': 'Standard', 'ai.responseStandardBody': 'A focused argument with a counterpoint', 'ai.responseDetailed': 'Detailed', 'ai.responseDetailedBody': 'More context and examples' },
  de: { 'ai.responseConcise': 'Kurz', 'ai.responseConciseBody': 'Kurze, direkte Antworten', 'ai.responseStandard': 'Standard', 'ai.responseStandardBody': 'Ein fokussiertes Argument mit Gegenpunkt', 'ai.responseDetailed': 'Detailliert', 'ai.responseDetailedBody': 'Mehr Kontext und Beispiele' },
  fr: { 'ai.responseConcise': 'Concis', 'ai.responseConciseBody': 'Réponses courtes et directes', 'ai.responseStandard': 'Standard', 'ai.responseStandardBody': 'Un argument ciblé avec un contrepoint', 'ai.responseDetailed': 'Détaillé', 'ai.responseDetailedBody': 'Plus de contexte et d’exemples' },
  es: { 'ai.responseConcise': 'Concisa', 'ai.responseConciseBody': 'Respuestas breves y directas', 'ai.responseStandard': 'Estándar', 'ai.responseStandardBody': 'Un argumento centrado con una réplica', 'ai.responseDetailed': 'Detallada', 'ai.responseDetailedBody': 'Más contexto y ejemplos' },
  it: { 'ai.responseConcise': 'Concisa', 'ai.responseConciseBody': 'Risposte brevi e dirette', 'ai.responseStandard': 'Standard', 'ai.responseStandardBody': 'Un argomento focalizzato con un controargomento', 'ai.responseDetailed': 'Dettagliata', 'ai.responseDetailedBody': 'Più contesto ed esempi' },
}
