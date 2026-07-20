import { apiRequest } from './data/api'

export type AnalyticsEvent =
  | 'landing_viewed'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'take_viewed'
  | 'debate_started'
  | 'debate_round_submitted'
  | 'debate_completed'
  | 'result_viewed'
  | 'share_attempted'
  | 'challenge_created'
  | 'challenge_opened'
  | 'challenge_completed'
  | 'second_debate_started'
  | 'report_submitted'
  | 'installation_action_used'
  | 'recoverable_error_encountered'

let accessToken: string | null = null

export function setAnalyticsAccessToken(token: string | null): void {
  accessToken = token
}

export function trackEvent(event: AnalyticsEvent, properties: Record<string, string | number | boolean | null> = {}): void {
  if (import.meta.env.DEV) console.debug(`[analytics] ${event}`, properties)
  if (!import.meta.env.PROD) return
  void apiRequest('/api/analytics', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify({ event, properties }),
    keepalive: true,
  }).catch(() => undefined)
}
