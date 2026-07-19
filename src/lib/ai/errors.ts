export type AiErrorCode =
  | 'connection_required'
  | 'popup_blocked'
  | 'sign_in_cancelled'
  | 'allowance_exhausted'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'request_failed'
  | 'unavailable_model'
  | 'temporary_failure'
  | 'network_timeout'
  | 'interrupted'
  | 'empty_response'
  | 'invalid_response'
  | 'unsupported_browser'
  | 'unknown'

export class AiProviderError extends Error {
  constructor(public readonly code: AiErrorCode, message: string, public readonly retryable = false) {
    super(message)
    this.name = 'AiProviderError'
  }
}

export function normalizeAiError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const code = String(value.code || value.error || '').toLowerCase()
  const message = String(value.msg || value.message || error || 'Unknown AI provider failure.')
  if (code.includes('popup') || /popup.*block/i.test(message)) return new AiProviderError('popup_blocked', 'The Puter sign-in popup was blocked. Allow popups and try Connect AI opponents again.')
  if (code.includes('closed') || code.includes('cancel') || /cancel|closed/i.test(message)) return new AiProviderError('sign_in_cancelled', 'Puter sign-in was cancelled. Connect AI opponents when you are ready.')
  if (/allowance|quota|limit|exhausted|microcent/i.test(message)) return new AiProviderError('allowance_exhausted', 'Your Puter monthly AI allowance is unavailable or exhausted. Check Puter and try again later.')
  if (/rate.?limit/i.test(message)) return new AiProviderError('rate_limited', 'SideShift Basic is rate limited. Try again shortly.', true)
  if (/temporarily unavailable|provider unavailable/i.test(message)) return new AiProviderError('provider_unavailable', 'SideShift Basic is temporarily unavailable. Keep Connect Puter available.')
  if (/timeout|timed out/i.test(message)) return new AiProviderError('network_timeout', 'The AI response timed out. You can retry this round.', true)
  if (/network|fetch|offline|failed to load/i.test(message)) return new AiProviderError('temporary_failure', 'Puter could not reach the selected model. Check your connection and retry.', true)
  if (/not supported|unsupported|browser/i.test(message)) return new AiProviderError('unsupported_browser', 'This browser cannot run the Puter AI connection flow.')
  return new AiProviderError('unknown', 'Puter could not complete the AI request. You can retry without losing your debate.', true)
}
