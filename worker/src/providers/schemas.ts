import { z } from 'zod'

export const opponentOutputSchema = z.object({
  response: z.string().trim().min(1).max(700),
  question: z.string().trim().max(260).optional(),
  round: z.number().int().min(1).max(6).optional(),
  language: z.string().trim().min(2).max(12).optional(),
})

export const normalizedEvaluationSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  reasoningScore: z.number().int().min(0).max(20),
  evidenceScore: z.number().int().min(0).max(20),
  responsivenessScore: z.number().int().min(0).max(20),
  clarityScore: z.number().int().min(0).max(20),
  strongestPoint: z.string().trim().min(1).max(800),
  improvementArea: z.string().trim().min(1).max(800),
  conciseSummary: z.string().trim().min(1).max(800),
  confidence: z.number().min(0).max(1),
  disclaimer: z.string().trim().min(1).max(400),
  concession: z.enum(['user', 'opponent', 'both', 'none']).default('none'),
})

/** Legacy API contract consumed by the React app. */
export const legacyEvaluationSchema = z.object({
  clarity: z.number().int().min(0).max(20),
  relevance: z.number().int().min(0).max(20),
  reasoning: z.number().int().min(0).max(20),
  rebuttal: z.number().int().min(0).max(20),
  fairness: z.number().int().min(0).max(20),
  strongestPoint: z.string().trim().min(1).max(800),
  weakestAssumption: z.string().trim().min(1).max(800),
  missedCounterargument: z.string().trim().min(1).max(800),
  unansweredOpponentPoint: z.string().trim().min(1).max(800),
  improvedExampleResponse: z.string().trim().min(1).max(800),
  argumentDna: z.string().trim().min(1).max(800),
  concession: z.enum(['user', 'opponent', 'both', 'none']),
})

export type NormalizedEvaluation = z.infer<typeof normalizedEvaluationSchema>
export type LegacyEvaluation = z.infer<typeof legacyEvaluationSchema>

export function mapNormalizedToLegacyEvaluation(value: NormalizedEvaluation): LegacyEvaluation {
  const responsiveness = value.responsivenessScore
  const reasoning = value.reasoningScore
  const evidence = value.evidenceScore
  const clarity = value.clarityScore
  const overallFairness = Math.round((reasoning + evidence + responsiveness) / 3)
  return {
    clarity,
    relevance: responsiveness,
    reasoning,
    rebuttal: Math.round((reasoning + responsiveness) / 2),
    fairness: Math.min(20, Math.max(0, overallFairness)),
    strongestPoint: value.strongestPoint,
    weakestAssumption: value.improvementArea,
    missedCounterargument: value.improvementArea,
    unansweredOpponentPoint: value.improvementArea,
    improvedExampleResponse: value.conciseSummary,
    argumentDna: value.conciseSummary,
    concession: value.concession ?? 'none',
  }
}

export function parseModelJson(value: unknown): unknown {
  const response = value && typeof value === 'object' && 'response' in value
    ? (value as { response?: unknown }).response
    : value
  if (typeof response !== 'string' || !response.trim()) {
    throw Object.assign(new Error('Model returned no content.'), { code: 'ai_unavailable' })
  }
  const cleaned = response.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as unknown
  } catch {
    throw Object.assign(new Error('Model returned invalid JSON.'), { code: 'ai_unavailable' })
  }
}
