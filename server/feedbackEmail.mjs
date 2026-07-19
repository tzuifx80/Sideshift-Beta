export function buildFeedbackEmailPayload(feedback, now = new Date()) {
  return {
    subject: `[SideShift feedback] ${feedback.category}`,
    text: [
      `Feedback ID: ${feedback.id}`,
      `Category: ${feedback.category}`,
      `Message: ${feedback.message || '(none)'}`,
      `App version: ${feedback.appVersion}`,
      `Language: ${feedback.language || 'unknown'}`,
      `Platform: ${feedback.platform || 'unknown'}`,
      `Screen: ${feedback.screen}`,
      `AI provider/model: ${feedback.aiModelId || 'not applicable'}`,
      `Timestamp: ${feedback.createdAt || now.toISOString()}`,
    ].join('\n'),
  }
}

export async function sendFeedbackEmail(feedback, env = process.env, fetcher = fetch) {
  const payload = buildFeedbackEmailPayload(feedback)
  const endpoint = env.FEEDBACK_EMAIL_API_URL
  if (!env.FEEDBACK_TO_EMAIL || !env.FEEDBACK_FROM_EMAIL || !env.FEEDBACK_EMAIL_PROVIDER || !env.FEEDBACK_EMAIL_API_KEY || !endpoint) return { status: 'pending', payload }
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.FEEDBACK_EMAIL_API_KEY}` },
    body: JSON.stringify({ from: env.FEEDBACK_FROM_EMAIL, to: env.FEEDBACK_TO_EMAIL, subject: payload.subject, text: payload.text }),
  })
  if (!response.ok) throw new Error(`Feedback delivery failed (${response.status}).`)
  return { status: 'sent', payload }
}
