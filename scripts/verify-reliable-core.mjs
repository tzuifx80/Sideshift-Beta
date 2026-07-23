#!/usr/bin/env node
import { generateDebateTurn, evaluateDebate } from '../src/reliableCore/engine.ts'

const supportedLanguages = ['en', 'de', 'fr', 'es', 'it']
const motion = 'Social media does more harm than good for teenagers'
const takeId = 'society-media-age'

let failures = 0

function assert(condition, message) {
  if (!condition) {
    failures += 1
    console.error(`FAIL: ${message}`)
  }
}

const debateId = 'verify-reliable-core'
const transcript = []

for (let round = 1; round <= 3; round += 1) {
  const userArgument = `Round ${round}: I defend my side on ${motion} with a clear trade-off and a direct reason.`
  const turn = generateDebateTurn({
    debateId,
    takeId,
    motion,
    userSide: 'Pro',
    aiSide: 'Con',
    language: 'en',
    round,
    roundLimit: 3,
    userArgument,
    previousTactics: transcript.filter(item => item.role === 'opponent').map(item => item.tactic || ''),
    transcript: transcript.map(item => ({ role: item.role, round: item.round, content: item.content })),
    requestId: `${debateId}-turn-${round}`,
  })
  assert(turn.text.trim().length > 0, `round ${round} produced blank text`)
  assert(turn.engineMode === 'reliable', `round ${round} missing reliable mode`)
  transcript.push({ role: 'user', round, content: userArgument })
  transcript.push({ role: 'opponent', round, content: turn.text, tactic: turn.tactic })
}

const evaluation = evaluateDebate({
  debateId,
  takeId,
  motion,
  userSide: 'Pro',
  aiSide: 'Con',
  language: 'en',
  transcript: transcript.map(item => ({ role: item.role, round: item.round, content: item.content })),
  requestId: `${debateId}-evaluation`,
})

assert(evaluation.overallScore > 0, 'evaluation score missing')
assert(evaluation.disclaimer.length > 20, 'evaluation disclaimer missing')

for (const language of supportedLanguages) {
  const localized = generateDebateTurn({
    debateId: `${debateId}-${language}`,
    takeId,
    motion,
    userSide: 'Pro',
    aiSide: 'Con',
    language,
    round: 1,
    roundLimit: 3,
    userArgument: 'This is a structured argument with a trade-off and a question about scope.',
    previousTactics: [],
    transcript: [],
    requestId: `${debateId}-${language}-1`,
  })
  assert(localized.text.length > 0, `${language} output blank`)
  assert(!localized.text.includes('ai.'), `${language} leaked translation key`)
}

if (failures) {
  console.error(`verify:reliable-core failed with ${failures} issue(s).`)
  process.exit(1)
}

console.log('verify:reliable-core passed — local three-round path completed without hosted AI.')
