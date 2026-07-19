import { mkdtemp, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const requiredBasic = ['BASIC_AI_PROVIDER', 'BASIC_AI_MODEL', 'BASIC_AI_API_URL', 'BASIC_AI_API_KEY']
const requiredFeedback = ['FEEDBACK_TO_EMAIL', 'FEEDBACK_FROM_EMAIL', 'FEEDBACK_EMAIL_PROVIDER', 'FEEDBACK_EMAIL_API_URL', 'FEEDBACK_EMAIL_API_KEY']
const missing = keys => keys.filter(key => !String(process.env[key] || '').trim())
const basicMissing = missing(requiredBasic)
const feedbackMissing = missing(requiredFeedback)
const forbiddenClientKeys = ['VITE_BASIC_AI_API_KEY', 'VITE_FEEDBACK_TO_EMAIL', 'VITE_FEEDBACK_EMAIL_API_KEY', 'VITE_OPENAI_API_KEY', 'VITE_AI_API_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY']
const clientEnvLeak = forbiddenClientKeys.filter(key => process.env[key])
const production = process.env.NODE_ENV === 'production' || ['private-beta', 'production'].includes(process.env.APP_ENV)
const mockEnabled = process.env.MOCK_AI !== 'false' && (process.env.AI_PROVIDER || 'mock') === 'mock'
const source = readFileSync(join(root, 'server.mjs'), 'utf8')
const mockGuardPresent = source.includes('serverProduction') && source.includes('VITE_BASIC_AI_API_KEY') && source.includes('basicAiConfigured')

function fail(message) {
  console.error(`PROVIDER_VERIFY_FAILED: ${message}`)
  process.exitCode = 2
}

function printState(label, values) {
  console.log(`${label}: ${values.length ? `missing (${values.join(', ')})` : 'available'}`)
}

printState('Basic AI configuration', basicMissing)
printState('Feedback email configuration', feedbackMissing)

const scan = spawnSync(process.execPath, ['scripts/scan-frontend-secrets.mjs'], { cwd: root, encoding: 'utf8', stdio: 'ignore' })
if (scan.status !== 0) fail('frontend secret scan failed')
else console.log('Client secret scan: passed')

if (clientEnvLeak.length) fail('forbidden VITE_* secret-like environment variables are set')
if (!mockGuardPresent) fail('production mock guard could not be confirmed')
else if (production && mockEnabled) fail('production mock configuration is active')
else console.log('Production mock fallback: blocked')

async function waitForHealth(base) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`)
      if (response.ok) return true
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function checkCapability() {
  const temporaryDir = await mkdtemp(join(tmpdir(), 'sideshift-provider-probe-'))
  const port = 8898
  const base = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', APP_ENV: 'local', DATA_BACKEND: 'local', DATA_DIR: temporaryDir, MOCK_AI: 'false', AI_PROVIDER: 'puter' },
    stdio: ['ignore', 'ignore', 'ignore'],
  })
  try {
    if (!await waitForHealth(base)) throw new Error('local API health endpoint did not respond')
    const response = await fetch(`${base}/api/ai/basic/capability`, { headers: { 'x-sideshift-user-id': 'provider-probe' } })
    const payload = await response.json()
    if (!response.ok) throw new Error(`capability endpoint returned ${response.status}`)
    if (payload.available !== (basicMissing.length === 0)) throw new Error('capability availability did not match server configuration')
    console.log(`Basic capability endpoint: ${payload.state}`)
  } finally {
    child.kill()
    await rm(temporaryDir, { recursive: true, force: true })
  }
}

try {
  await checkCapability()
} catch (error) {
  fail(error instanceof Error ? error.message : 'capability endpoint check failed')
}

console.log('Live generation: not yet tested')
console.log('Live email: not yet tested')
if (basicMissing.length || feedbackMissing.length || clientEnvLeak.length || (production && mockEnabled)) process.exitCode = 2
