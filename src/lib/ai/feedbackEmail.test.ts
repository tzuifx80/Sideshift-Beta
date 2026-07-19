import { describe, expect, it } from 'vitest'
import { buildFeedbackEmailPayload } from './feedbackEmail'

describe('feedback email redaction', () => {
  it('contains only bounded feedback metadata and no transcript or private debate data', () => {
    const payload = buildFeedbackEmailPayload({ id: 'feedback-1', category: 'ai_quality', message: 'Too long', appVersion: '0.1.0', language: 'de', platform: 'web', screen: 'aiResults', aiModelId: 'sideshift-basic', createdAt: '2026-07-19T12:00:00.000Z' })
    expect(payload.text).toContain('Feedback ID: feedback-1')
    expect(payload.text).toContain('Language: de')
    expect(payload.text).not.toContain('transcript')
    expect(payload.text).not.toContain('token')
    expect(payload.text).not.toContain('stance')
  })
})
