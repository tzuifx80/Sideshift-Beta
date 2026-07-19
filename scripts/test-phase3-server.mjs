import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const port = 8799
const dataDir = join(process.cwd(), `.data-phase3-${process.pid}`)
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_ENV: 'local', DATA_BACKEND: 'local', DATA_DIR: dataDir, MOCK_AI: 'false', AI_PROVIDER: 'puter', BASIC_AI_PROVIDER: '', BASIC_AI_MODEL: '', BASIC_AI_API_KEY: '', FEEDBACK_TO_EMAIL: 'internal-test', FEEDBACK_FROM_EMAIL: 'internal-test', FEEDBACK_EMAIL_PROVIDER: 'test', FEEDBACK_EMAIL_API_URL: 'http://127.0.0.1:9/feedback', FEEDBACK_EMAIL_API_KEY: 'test-key' },
  stdio: ['ignore', 'pipe', 'pipe'],
})

try {
  const base = `http://127.0.0.1:${port}`
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try { if ((await fetch(`${base}/api/health`)).ok) break } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  const unauthorized = await fetch(`${base}/api/ai/basic/capability`)
  assert.equal(unauthorized.status, 401)
  const headers = { 'x-sideshift-user-id': 'phase3-server-test' }
  const capability = await fetch(`${base}/api/ai/basic/capability`, { headers })
  assert.equal(capability.status, 200)
  const capabilityBody = await capability.json()
  assert.equal(capabilityBody.available, false)
  assert.equal(capabilityBody.entitlements.plan, 'free')
  assert.equal(capabilityBody.usage.debatesRemaining, 3)
  const opponent = await fetch(`${base}/api/ai/basic/opponent`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'x-request-id': 'phase3-turn-1' }, body: JSON.stringify({ modelId: 'sideshift-basic', messages: [{ role: 'system', content: 'Language: English. Defend the assigned side.' }, { role: 'user', content: 'Make the strongest concise counterargument.' }], maxTokens: 120, debateId: '00000000-0000-0000-0000-000000000001', round: 1 }) })
  assert.equal(opponent.status, 502)
  assert.equal((await opponent.json()).error.code, 'provider_unavailable')
  const afterFailure = await (await fetch(`${base}/api/ai/basic/capability`, { headers })).json()
  assert.equal(afterFailure.usage.debatesRemaining, 3)
  const feedback = await fetch(`${base}/api/feedback/notify`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ feedbackId: 'feedback-local-1', category: 'suggestion', message: 'bounded feedback', screen: 'settings', appVersion: 'test', language: 'en', platform: 'web' }) })
  assert.equal(feedback.status, 202)
  const storedDelivery = JSON.parse(readFileSync(join(dataDir, 'sideshift.json'), 'utf8')).feedbackDelivery['feedback-local-1']
  assert.equal(storedDelivery.status, 'failed')
  console.log('PHASE3_SERVER_OK auth=required basic=unavailable-no-mock quota=authoritative feedback=accepted')
} finally {
  child.kill()
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true })
}
