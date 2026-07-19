import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'BASIC_AI_PROVIDER', 'BASIC_AI_MODEL', 'BASIC_AI_API_URL', 'BASIC_AI_API_KEY', 'FEEDBACK_TO_EMAIL', 'FEEDBACK_FROM_EMAIL', 'FEEDBACK_EMAIL_PROVIDER', 'FEEDBACK_EMAIL_API_URL', 'FEEDBACK_EMAIL_API_KEY']
const missing = required.filter(key => !String(process.env[key] || '').trim())
if (missing.length) {
  console.error(`LIVE_PROVIDER_BLOCKED: missing ${missing.join(', ')}`)
  process.exit(2)
}

const root = process.cwd()
const apiPort = 8899
const apiBase = `http://127.0.0.1:${apiPort}`
const temporaryDir = await mkdtemp(join(tmpdir(), 'sideshift-live-provider-'))
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(apiPort), HOST: '127.0.0.1', APP_ENV: 'local', DATA_BACKEND: 'supabase', DATA_DIR: temporaryDir, MOCK_AI: 'false', AI_PROVIDER: 'puter' },
  stdio: ['ignore', 'ignore', 'ignore'],
})

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let accessToken = ''
let userId = ''
let feedbackId

async function waitForHealth() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${apiBase}/api/health`)
      if (response.ok) return
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('local API health endpoint did not respond')
}

async function api(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, { ...init, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...(init.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${payload.error?.code || 'request_error'}`)
  return payload
}

async function usageRow() {
  const { data, error } = await admin.from('basic_ai_daily_usage').select('debates_started,turns_generated,evaluations_generated').eq('user_id', userId).eq('usage_date', new Date().toISOString().slice(0, 10)).maybeSingle()
  if (error) throw new Error(`usage read failed: ${error.message}`)
  return data || { debates_started: 0, turns_generated: 0, evaluations_generated: 0 }
}

function wordCount(value) { return value.trim().split(/\s+/).filter(Boolean).length }

try {
  await waitForHealth()
  const auth = await supabase.auth.signInAnonymously()
  if (auth.error || !auth.data.session?.access_token || !auth.data.user?.id) throw new Error(`Supabase test authentication failed: ${auth.error?.message || 'no session'}`)
  accessToken = auth.data.session.access_token
  userId = auth.data.user.id

  const capabilityBefore = await api('/api/ai/basic/capability')
  assert.equal(capabilityBefore.available, true)
  assert.equal(capabilityBefore.provider, 'basic')
  assert.equal(capabilityBefore.entitlements.plan, 'free')
  const usageBefore = await usageRow()

  const debateId = randomUUID()
  const requestId = `live-turn-${randomUUID()}`
  const turnBody = {
    modelId: 'sideshift-basic',
    messages: [
      { role: 'system', content: 'Language: German. Selected take: Die Stadt sollte mehr Fahrradwege bauen, weil sie Sicherheit erhöhen und Staus reduzieren. Assigned side: Support the motion. Keep this side.' },
      { role: 'user', content: 'Ich unterstütze den Ausbau von Fahrradwegen, weil sichere Radwege den Verkehr entlasten und Menschen eine praktische Alternative zum Auto geben.' },
    ],
    maxTokens: 120,
    debateId,
    round: 1,
  }
  const firstTurn = await api('/api/ai/basic/opponent', { method: 'POST', headers: { 'x-request-id': requestId }, body: JSON.stringify(turnBody) })
  assert.equal(firstTurn.language, 'de')
  assert.ok(typeof firstTurn.response === 'string' && firstTurn.response.length > 0)
  assert.ok(firstTurn.response.length <= 700)
  assert.ok(wordCount(firstTurn.response) <= 160)
  assert.ok(['Fahrrad', 'Rad', 'Sicherheit', 'Stau', 'Verkehr'].some(keyword => firstTurn.response.includes(keyword)), 'Basic response did not address the supplied argument')

  const usageAfterTurn = await usageRow()
  assert.equal(usageAfterTurn.turns_generated, usageBefore.turns_generated + 1)
  assert.equal(usageAfterTurn.debates_started, usageBefore.debates_started + 1)

  const replayTurn = await api('/api/ai/basic/opponent', { method: 'POST', headers: { 'x-request-id': requestId }, body: JSON.stringify(turnBody) })
  assert.deepEqual(replayTurn, firstTurn)
  const usageAfterReplay = await usageRow()
  assert.deepEqual(usageAfterReplay, usageAfterTurn)

  const evaluationRequestId = `live-evaluation-${randomUUID()}`
  const evaluationBody = {
    modelId: 'sideshift-basic',
    debateId,
    messages: [
      { role: 'system', content: 'Language: German. Evaluate only debate technique. Return the requested structured evaluation.' },
      { role: 'user', content: JSON.stringify([{ role: 'user', round: 1, content: turnBody.messages[1].content }, { role: 'opponent', round: 1, content: firstTurn.response }]) },
    ],
  }
  const evaluationResult = await api('/api/ai/basic/evaluate', { method: 'POST', headers: { 'x-request-id': evaluationRequestId }, body: JSON.stringify(evaluationBody) })
  const evaluation = evaluationResult.evaluation
  for (const key of ['clarity', 'relevance', 'reasoning', 'rebuttal', 'fairness', 'strongestPoint', 'weakestAssumption', 'missedCounterargument', 'unansweredOpponentPoint', 'improvedExampleResponse', 'argumentDna', 'concession']) assert.ok(key in evaluation, `evaluation field missing: ${key}`)
  for (const key of ['clarity', 'relevance', 'reasoning', 'rebuttal', 'fairness']) assert.ok(Number.isInteger(evaluation[key]) && evaluation[key] >= 0 && evaluation[key] <= 20, `evaluation score invalid: ${key}`)
  const usageAfterEvaluation = await usageRow()
  assert.equal(usageAfterEvaluation.evaluations_generated, usageAfterTurn.evaluations_generated + 1)

  const replayEvaluation = await api('/api/ai/basic/evaluate', { method: 'POST', headers: { 'x-request-id': evaluationRequestId }, body: JSON.stringify(evaluationBody) })
  assert.deepEqual(replayEvaluation, evaluationResult)
  assert.deepEqual(await usageRow(), usageAfterEvaluation)

  const feedbackMessage = `LIVE PROVIDER SMOKE ${randomUUID()}`
  const feedbackInsert = await supabase.rpc('submit_beta_feedback', { p_category: 'suggestion', p_message: feedbackMessage, p_surface: 'settings', p_screen: 'settings', p_ai_model_id: 'sideshift-basic', p_app_version: 'live-provider-smoke' })
  if (feedbackInsert.error || !feedbackInsert.data) throw new Error(`feedback persistence failed: ${feedbackInsert.error?.message || 'no id returned'}`)
  feedbackId = feedbackInsert.data
  const stored = await supabase.from('beta_feedback').select('id,message,delivery_status').eq('id', feedbackId).eq('owner_id', userId).single()
  if (stored.error || stored.data?.message !== feedbackMessage) throw new Error(`feedback row was not stored first: ${stored.error?.message || 'row mismatch'}`)
  const notification = await api('/api/feedback/notify', { method: 'POST', body: JSON.stringify({ feedbackId, category: 'suggestion', message: feedbackMessage, screen: 'settings', aiModelId: 'sideshift-basic', appVersion: 'live-provider-smoke', language: 'de', platform: 'web' }) })
  assert.equal(notification.accepted, true)
  const delivered = await supabase.from('beta_feedback').select('delivery_status').eq('id', feedbackId).eq('owner_id', userId).single()
  if (delivered.error) throw new Error(`feedback delivery status read failed: ${delivered.error.message}`)
  assert.equal(delivered.data.delivery_status, 'sent')

  console.log(`LIVE_PROVIDER_OK provider=${process.env.BASIC_AI_PROVIDER} model=${process.env.BASIC_AI_MODEL} language=de argument_addressed=1 response_words=${wordCount(firstTurn.response)} basic_quota_debates_delta=1 turn_idempotent=1 evaluation_structured=1 evaluation_idempotent=1 feedback_stored_first=1 email_provider_accepted=1 delivery_status=sent`)
  console.log('Mailbox arrival still requires the configured recipient inbox check; this command verifies provider acceptance and stored delivery status.')
} finally {
  if (userId) {
    try {
      await supabase.rpc('delete_my_basic_ai_usage')
    } catch { /* cleanup is best-effort */ }
    try {
      await supabase.rpc('delete_my_beta_data')
    } catch { /* cleanup is best-effort */ }
  }
  server.kill()
  await rm(temporaryDir, { recursive: true, force: true })
}
