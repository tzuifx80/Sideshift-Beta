import type { AiDebateData } from '../../domain'

export type PreparedBasicTurn = {
  transcript: AiDebateData['transcript']
  round: number
  argument: string
  requestId: string
}

/**
 * The request identity is the debate turn, not the network attempt. This lets
 * a retry replay a completed server request without consuming another turn.
 */
export function basicTurnRequestId(debateId: string, round: number): string {
  const safeDebateId = debateId.replace(/[^A-Za-z0-9._-]/g, '-')
  return `${safeDebateId.slice(0, 70)}-turn-${round}`
}

export function prepareBasicTurn(snapshot: AiDebateData, debateId: string, argument: string): PreparedBasicTurn | null {
  const latest = snapshot.transcript.at(-1)
  if (latest?.role === 'user') {
    if (latest.round < 1 || latest.round > snapshot.roundLimit) return null
    return { transcript: snapshot.transcript, round: latest.round, argument: latest.content, requestId: basicTurnRequestId(debateId, latest.round) }
  }
  const trimmed = argument.trim()
  const round = Math.max(0, ...snapshot.transcript.map(turn => turn.round)) + 1
  if (trimmed.length < 12 || round > snapshot.roundLimit) return null
  return {
    transcript: [...snapshot.transcript, { role: 'user', round, content: trimmed }],
    round,
    argument: trimmed,
    requestId: basicTurnRequestId(debateId, round),
  }
}

export function shouldAcceptBasicTurnResponse(input: { expectedRequestId: string; requestId: string }): boolean {
  return input.expectedRequestId === input.requestId
}

export function diagnoseBasicTurn(event: { round: number; requestId: string; phase: string; outcome?: string; status?: number }): void {
  if (!import.meta.env.DEV) return
  console.debug('[sideshift-basic-turn]', {
    round: event.round,
    request: event.requestId.slice(-8),
    phase: event.phase,
    ...(event.outcome ? { outcome: event.outcome } : {}),
    ...(event.status === undefined ? {} : { status: event.status }),
  })
}
