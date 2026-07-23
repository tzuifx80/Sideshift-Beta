export type BoundedTranscriptTurn = { role: 'user' | 'opponent'; round: number; content: string }

export type BoundedTranscriptInput = {
  motion: string
  userSide: string
  aiSide: string
  languageCode: string
  languageName: string
  newestArgument: string
  turns: BoundedTranscriptTurn[]
  tacticsUsed: string[]
  round: number
  roundLimit: number
  maxChars?: number
}

export function formatBoundedTranscript(input: BoundedTranscriptInput): string {
  const header = [
    `Motion: ${input.motion}`,
    `User side: ${input.userSide}`,
    `Opponent side: ${input.aiSide}`,
    `Language: ${input.languageName} (${input.languageCode})`,
    `Round: ${input.round}/${input.roundLimit}`,
    input.tacticsUsed.length ? `Tactics used: ${input.tacticsUsed.join(', ')}` : 'Tactics used: none',
  ].join('\n')

  const newest = `Latest user argument (round ${input.round}): ${input.newestArgument.slice(0, 900)}`
  const prior = input.turns
    .filter(turn => turn.content !== input.newestArgument)
    .slice(-6)
    .map(turn => `${turn.role === 'user' ? 'USER' : 'OPPONENT'} R${turn.round}: ${turn.content.slice(0, 900)}`)
    .join('\n')

  const body = [header, prior, newest].filter(Boolean).join('\n\n')
  const max = input.maxChars ?? 7800
  if (body.length <= max) return body

  const preserved = [header, newest].join('\n\n')
  const remaining = Math.max(800, max - preserved.length - 20)
  const recent = input.turns
    .filter(turn => turn.content !== input.newestArgument)
    .slice(-4)
    .map(turn => `${turn.role === 'user' ? 'USER' : 'OPPONENT'} R${turn.round}: ${turn.content.slice(0, Math.floor(remaining / 4))}`)
    .join('\n')
  return [header, recent, newest].filter(Boolean).join('\n\n').slice(0, max)
}
