const frontendUrl = (process.env.DEPLOYED_FRONTEND_URL || '').replace(/\/$/, '')
const apiUrl = (process.env.DEPLOYED_API_URL || frontendUrl).replace(/\/$/, '')
if (!frontendUrl || !apiUrl) {
  console.error('PRODUCTION_SMOKE_BLOCKED: set DEPLOYED_FRONTEND_URL and optionally DEPLOYED_API_URL')
  process.exit(2)
}
if (![frontendUrl, apiUrl].every(value => value.startsWith('https://') && !/localhost|127\.0\.0\.1/i.test(value))) {
  console.error('PRODUCTION_SMOKE_BLOCKED: deployed URLs must be public HTTPS URLs, not localhost')
  process.exit(2)
}

async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json,text/html' } })
  const text = await response.text()
  let body = null
  try { body = JSON.parse(text) } catch { /* HTML */ }
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`)
  return { body, text }
}

const frontend = await get(`${frontendUrl}/`)
if (!frontend.text.includes('SideShift') || frontend.text.includes('SUPABASE_SERVICE_ROLE_KEY') || frontend.text.includes('OPENAI_API_KEY')) throw new Error('frontend smoke response is invalid or contains a server secret name')
const manifest = await get(`${frontendUrl}/manifest.webmanifest`)
if (manifest.body?.name !== 'SideShift' || manifest.body?.display !== 'standalone') throw new Error('deployed manifest is invalid')
await get(`${frontendUrl}/sw.js`)
const health = await get(`${apiUrl}/api/health`)
if (health.body?.status !== 'ok' || health.body?.backend !== 'supabase' || health.body?.environment !== 'private-beta') throw new Error('deployed health endpoint does not report private-beta Supabase status')
console.log(`PRODUCTION_SMOKE_OK frontend=${frontendUrl} api=${apiUrl} backend=${health.body.backend} environment=${health.body.environment}`)
