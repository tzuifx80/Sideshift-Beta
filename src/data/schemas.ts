import { z } from 'zod'
import type { DebateSnapshot, ResultData, Stance } from '../domain'
import type { TeamDebateSession } from '../collaboration'

const takeSchema = z.object({
  id: z.string(),
  category: z.string(),
  categoryDe: z.string(),
  categoryClass: z.string(),
  statement: z.string(),
  statementDe: z.string(),
  context: z.string(),
  contextDe: z.string(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  time: z.string(),
  type: z.string(),
  color: z.string(),
  supportLabel: z.string(),
  opposeLabel: z.string(),
})

const transcriptTurnSchema = z.object({
  role: z.enum(['user', 'opponent']),
  round: z.number().int(),
  content: z.string().min(1).max(700),
})

export const debateSnapshotSchema: z.ZodType<DebateSnapshot> = z.object({
  id: z.string().uuid(),
  takeId: z.string(),
  mode: z.enum(['classic', 'sideswitch', 'blindside', 'commonground']),
  step: z.number().int().min(0).max(6),
  stance: z.number().int().min(-2).max(2).transform(value => value as Stance),
  postStance: z.number().int().min(-2).max(2).transform(value => value as Stance),
  confidence: z.number().int().min(1).max(5),
  understanding: z.string().max(40),
  responses: z.record(z.string(), z.string().max(350)),
  opponentMessages: z.record(z.string(), z.string().max(700)),
  assignedSide: z.string().max(120),
  language: z.enum(['en', 'de', 'fr', 'es', 'it']),
  status: z.enum(['active', 'completed']),
  updatedAt: z.string(),
  ai: z.object({
    opponentId: z.string(), family: z.string(), modelId: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    roundLength: z.enum(['quick', 'standard', 'deep']), quality: z.enum(['fast', 'balanced', 'maximum']).default('balanced'), responseLength: z.enum(['concise', 'standard', 'detailed']).default('standard'), modelSelection: z.enum(['automatic', 'exact']).default('exact'), roundLimit: z.number().int().min(3).max(6),
    userSide: z.string().max(120), aiSide: z.string().max(120), customMotion: z.string().max(240).nullable(),
    transcript: z.array(z.object({ role: z.enum(['user', 'opponent']), round: z.number().int().min(1).max(6), content: z.string().max(700), interrupted: z.boolean().optional() })).max(20),
    partialResponse: z.string().max(1200), interrupted: z.boolean(), completionReason: z.enum(['completed', 'abandoned', 'interrupted']).nullable(),
  }).optional(),
})

export const resultDataSchema: z.ZodType<ResultData> = z.object({
  id: z.string().uuid(),
  debateId: z.string().uuid().optional(),
  score: z.number().int().min(0).max(100).nullable(),
  movement: z.number().int().min(-4).max(4),
  understanding: z.string(),
  mode: z.enum(['classic', 'sideswitch', 'blindside', 'commonground']),
  take: takeSchema,
  assignedSide: z.string(),
  transcript: z.array(transcriptTurnSchema),
  scores: z.array(z.object({ label: z.string(), score: z.number().int().min(0).max(20), explanation: z.string() })),
  coaching: z.string(),
  completedAt: z.string(),
  ai: z.object({
    opponentId: z.string(), family: z.string(), modelId: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    roundLength: z.enum(['quick', 'standard', 'deep']), quality: z.enum(['fast', 'balanced', 'maximum']).default('balanced'), responseLength: z.enum(['concise', 'standard', 'detailed']).default('standard'), modelSelection: z.enum(['automatic', 'exact']).default('exact'), roundLimit: z.number().int().min(3).max(6), customMotion: z.string().max(240).nullable().optional(), evaluationAvailable: z.boolean(),
    evaluation: z.object({ clarity: z.number().int().min(0).max(20), relevance: z.number().int().min(0).max(20), reasoning: z.number().int().min(0).max(20), rebuttal: z.number().int().min(0).max(20), fairness: z.number().int().min(0).max(20), strongestPoint: z.string(), weakestAssumption: z.string(), missedCounterargument: z.string(), unansweredOpponentPoint: z.string().optional(), improvedExampleResponse: z.string(), argumentDna: z.string(), concession: z.enum(['user', 'opponent', 'both', 'none']).optional() }).optional(),
  }).optional(),
})

export const challengeRecordSchema = z.object({
  id: z.string(),
  // Challenge history intentionally redacts the reusable token.
  token: z.string(),
  url: z.string(),
  expiresAt: z.string(),
  takeId: z.string(),
  argument: z.string(),
  mode: z.string(),
  creatorSide: z.string(),
  status: z.enum(['open', 'completed', 'expired', 'revoked']),
  response: z.string().nullable(),
  result: z.object({ total: z.number().int().min(0).max(100) }).nullable(),
  creator: z.unknown().nullable().optional(),
})

export const teamDebateSessionSchema: z.ZodType<TeamDebateSession> = z.object({
  id: z.string().min(1), facilitatorId: z.string().uuid(), groupId: z.string().uuid().nullable(), language: z.enum(['en', 'de', 'fr', 'es', 'it']),
  topic: z.object({ statement: z.string().min(8).max(240), context: z.string().max(600), takeId: z.string().nullable(), custom: z.boolean() }),
  teams: z.array(z.object({ id: z.string().min(1), name: z.string().min(1).max(32), color: z.enum(['team-a', 'team-b', 'team-c', 'team-d']), icon: z.string().max(8) })).min(2).max(4),
  format: z.enum(['rounds', 'timer']), rounds: z.number().int().min(1).max(8), roundTypes: z.array(z.enum(['opening', 'argument', 'rebuttal', 'question', 'answer', 'closing'])).min(1), teamTurnSeconds: z.number().int().min(20).max(600), totalSeconds: z.number().int().min(60).max(7200), preparationSeconds: z.number().int().min(0).max(300), closingRound: z.boolean(), scoring: z.enum(['none', 'facilitator', 'ai']), status: z.enum(['active', 'paused', 'completed', 'ended']), currentTurnIndex: z.number().int().min(0), remainingSeconds: z.number().int().min(0).max(7200),
  turns: z.array(z.object({ id: z.string().min(1), teamId: z.string().min(1), round: z.number().int().min(1).max(8), roundType: z.enum(['opening', 'argument', 'rebuttal', 'question', 'answer', 'closing']), content: z.string().max(2000), submittedAt: z.string(), skipped: z.boolean().optional() })).max(40),
  result: z.object({ scoring: z.enum(['none', 'facilitator', 'ai']), facilitatorScores: z.record(z.string(), z.object({ clarity: z.number().int().min(0).max(5), relevance: z.number().int().min(0).max(5), rebuttal: z.number().int().min(0).max(5), teamwork: z.number().int().min(0).max(5), fairness: z.number().int().min(0).max(5) })), commonGround: z.string().max(600), completedAt: z.string(), aiReview: z.object({ summary: z.string().max(800), commonGround: z.string().max(600), teams: z.record(z.string(), z.object({ clarity: z.number().int().min(0).max(20), relevance: z.number().int().min(0).max(20), rebuttal: z.number().int().min(0).max(20), teamwork: z.number().int().min(0).max(20), fairness: z.number().int().min(0).max(20), strongestPoint: z.string().max(500), unansweredQuestion: z.string().max(500), evidence: z.array(z.string().max(240)).max(2) })) }).optional() }).nullable(), updatedAt: z.string(),
})
