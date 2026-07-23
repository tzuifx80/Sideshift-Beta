import { parseModelJson } from './schemas'
import { providerError } from './errors'
import type { ProviderKind, ProviderRawResult, ProviderRequest } from './types'

export interface WorkerAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

const TOTAL_TIMEOUT_MS = 30_000

export async function callCloudflare(
  ai: WorkerAiBinding,
  model: string,
  request: ProviderRequest,
): Promise<ProviderRawResult> {
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS)
  if (request.signal) {
    request.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    const result = await ai.run(model, {
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    })
    const parsed = parseModelJson(result)
    const content = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
    return {
      content,
      provider: 'cloudflare' as ProviderKind,
      model,
      latencyMs: Date.now() - started,
    }
  } catch (caught) {
    if ((caught as { name?: string }).name === 'AbortError') {
      throw providerError('timeout', 'Workers AI request timed out.', true)
    }
    if ((caught as { code?: string }).code) throw caught
    throw providerError('provider_unavailable', 'Workers AI request failed.', true)
  } finally {
    clearTimeout(timer)
  }
}
