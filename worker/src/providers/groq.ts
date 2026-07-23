import { mapHttpToProviderError, providerError } from './errors'
import type { ProviderError, ProviderKind, ProviderRawResult, ProviderRequest } from './types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CONNECT_TIMEOUT_MS = 8_000
const TOTAL_TIMEOUT_MS = 25_000

export async function callGroq(
  apiKey: string,
  model: string,
  request: ProviderRequest,
): Promise<ProviderRawResult> {
  if (!apiKey) throw providerError('auth_failed', 'Groq API key is not configured.', false)
  const started = Date.now()
  const controller = new AbortController()
  const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS)
  const totalTimer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)
  if (request.signal) {
    request.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        response_format: { type: 'json_object' },
      }),
    })
    const bodyText = await response.text()
    if (!response.ok) throw mapHttpToProviderError(response.status, bodyText)
    let payload: { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> }
    try {
      payload = JSON.parse(bodyText) as typeof payload
    } catch {
      throw providerError('invalid_response', 'Groq returned non-JSON.', true)
    }
    const content = payload.choices?.[0]?.message?.content?.trim()
    if (!content) throw providerError('invalid_response', 'Groq returned empty content.', true)
    return {
      content,
      provider: 'groq' as ProviderKind,
      model,
      finishReason: payload.choices?.[0]?.finish_reason,
      latencyMs: Date.now() - started,
    }
  } catch (caught) {
    if ((caught as { name?: string }).name === 'AbortError') {
      throw providerError('timeout', 'Groq request timed out.', true)
    }
    if ((caught as ProviderError).code) throw caught
    throw providerError('provider_unavailable', 'Groq request failed.', true)
  } finally {
    clearTimeout(connectTimer)
    clearTimeout(totalTimer)
  }
}
