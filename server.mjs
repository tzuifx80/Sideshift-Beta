import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT || 8787)
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const dataDir = process.env.DATA_DIR || join(root, '.data')
const dataFile = join(dataDir, 'sideshift.json')
const dataBackend = (process.env.DATA_BACKEND || 'local').toLowerCase()
const aiProvider = process.env.AI_PROVIDER || 'mock'
const mockAi = process.env.MOCK_AI !== 'false' && aiProvider === 'mock'
const appEnvironment = process.env.APP_ENV || (process.env.NODE_ENV === 'production' ? 'private-beta' : 'local')
const appBaseUrl = process.env.APP_BASE_URL || ''
const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : '*')).split(',').map(value => value.trim()).filter(Boolean))
const aiApiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ''
const aiModel = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini'
const serverAiMode = mockAi ? 'mock' : aiApiKey ? 'basic_server_available' : 'basic_server_unavailable'
const rateWindowMs = 60_000
const rateLimits = new Map()
const analyticsEvents = ['landing_viewed', 'onboarding_started', 'onboarding_completed', 'take_viewed', 'debate_started', 'debate_round_submitted', 'debate_completed', 'result_viewed', 'share_attempted', 'challenge_created', 'challenge_opened', 'challenge_completed', 'second_debate_started', 'report_submitted', 'installation_action_used', 'recoverable_error_encountered']
const analyticsInput = z.object({
  event: z.enum(analyticsEvents),
  properties: z.record(z.string(), z.union([z.string().max(100), z.number(), z.boolean(), z.null()])).optional().default({}),
})
let supabaseAdmin = null

function validateStartup() {
  const missing = []
  if (!['local', 'supabase'].includes(dataBackend)) throw new Error(`Unsupported DATA_BACKEND: ${dataBackend}`)
  if (process.env.NODE_ENV === 'production' && dataBackend !== 'supabase') throw new Error('Production server must use DATA_BACKEND=supabase.')
  for (const key of ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY', 'VITE_AI_API_KEY']) if (process.env[key]) throw new Error(`${key} must never be exposed to the browser.`)
  if (dataBackend === 'supabase') {
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL')
    if (!process.env.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    if (missing.length) {
      throw new Error(`Missing required Supabase environment variables: ${missing.join(', ')}`)
    }
  }
  if (process.env.NODE_ENV === 'production') {
    if (!['private-beta', 'production'].includes(appEnvironment)) throw new Error('APP_ENV must be private-beta or production in production.')
    if (!appBaseUrl || !appBaseUrl.startsWith('https://')) missing.push('APP_BASE_URL (https://...)')
    if (!allowedOrigins.size || allowedOrigins.has('*')) missing.push('ALLOWED_ORIGINS (explicit HTTPS origin)')
    if (mockAi) missing.push('MOCK_AI=false with a configured AI provider')
    else if (!aiApiKey) missing.push('AI_API_KEY')
    if (missing.length) throw new Error(`Missing or unsafe production configuration: ${missing.join(', ')}`)
  }
}

validateStartup()
if (dataBackend === 'supabase') supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

const opponentInput = z.object({
  take: z.object({ statement: z.string().min(1).max(400), context: z.string().min(1).max(500) }),
  assignedSide: z.string().min(1).max(120),
  round: z.number().int().min(1).max(5),
  latestArgument: z.string().min(1).max(350),
  language: z.enum(['en', 'de']).default('en'),
})
const opponentOutput = z.object({
  response: z.string().min(1).max(700),
  question: z.string().min(1).max(260),
  round: z.number().int().min(1).max(5),
  language: z.enum(['en', 'de']),
})
const judgeInput = z.object({
  transcript: z.array(z.object({ role: z.enum(['user', 'opponent']), round: z.number().int(), content: z.string().min(1).max(700) })).min(1).max(12),
  language: z.enum(['en', 'de']).default('en'),
})
const judgeOutput = z.object({
  total: z.number().int().min(0).max(100),
  confidence: z.number().min(0).max(1),
  scores: z.array(z.object({
    label: z.enum(['Clarity', 'Relevance', 'Reasoning', 'Rebuttal', 'Fairness']),
    score: z.number().int().min(0).max(20),
    explanation: z.string().min(1).max(260),
  })).length(5),
  strongestPoints: z.array(z.string().min(1).max(260)).max(3),
  coaching: z.string().min(1).max(400),
})
const teamReviewInput = z.object({
  topic: z.string().trim().min(8).max(240),
  teams: z.array(z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(32) })).min(2).max(4),
  transcript: z.array(z.object({ teamId: z.string().min(1).max(40), teamName: z.string().min(1).max(32), round: z.number().int().min(1).max(8), roundType: z.enum(['opening', 'argument', 'rebuttal', 'question', 'answer', 'closing']), content: z.string().min(1).max(2000), skipped: z.boolean().optional() })).min(1).max(32),
  language: z.enum(['en', 'de']).default('en'),
})
const teamReviewOutput = z.object({
  summary: z.string().trim().min(1).max(800),
  commonGround: z.string().trim().min(1).max(600),
  teams: z.record(z.string(), z.object({ clarity: z.number().int().min(0).max(20), relevance: z.number().int().min(0).max(20), rebuttal: z.number().int().min(0).max(20), teamwork: z.number().int().min(0).max(20), fairness: z.number().int().min(0).max(20), strongestPoint: z.string().trim().min(1).max(500), unansweredQuestion: z.string().trim().min(1).max(500), evidence: z.array(z.string().trim().min(1).max(240)).max(2) })),
})
const challengeCreateInput = z.object({
  creatorId: z.string().min(1).max(100),
  take: z.object({ id: z.string().min(1).max(100), statement: z.string().min(1).max(400), context: z.string().min(1).max(500) }),
  argument: z.string().trim().min(12).max(350),
})
const challengeResponseInput = z.object({
  response: z.string().trim().min(12).max(350),
})

function loadStore() {
  try {
    return JSON.parse(readFileSync(dataFile, 'utf8'))
  } catch {
    return { challenges: {} }
  }
}

function saveStore(store) {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(dataFile, JSON.stringify(store, null, 2), 'utf8')
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

function error(res, status, message, code = 'request_error') {
  json(res, status, { error: { code, message } })
}

function requestId(req) {
  const provided = req.headers['x-request-id']?.toString()
  return provided && /^[A-Za-z0-9._-]{1,80}$/.test(provided) ? provided : randomUUID()
}

function logEvent(req, category, extra = {}) {
  console.warn(JSON.stringify({ timestamp: new Date().toISOString(), environment: appEnvironment, requestId: req.requestId, endpoint: new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname, category, ...extra }))
}

function applyCors(req, res) {
  const origin = req.headers.origin?.toString()
  if (!origin) return true
  if (!allowedOrigins.has('*') && !allowedOrigins.has(origin)) return false
  res.setHeader('access-control-allow-origin', origin)
  res.setHeader('access-control-allow-headers', 'authorization, apikey, content-type, x-request-id')
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS')
  res.setHeader('vary', 'Origin')
  return true
}

function rateLimit(req, key, max) {
  const now = Date.now()
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket.remoteAddress || 'unknown'
  const bucketKey = `${ip}:${key}`
  const bucket = rateLimits.get(bucketKey)
  if (!bucket || now - bucket.startedAt > rateWindowMs) {
    rateLimits.set(bucketKey, { startedAt: now, count: 1 })
    return false
  }
  bucket.count += 1
  return bucket.count > max
}

async function body(req) {
  let data = ''
  for await (const chunk of req) {
    data += chunk
    if (data.length > 40_000) throw new Error('Request body is too large.')
  }
  try {
    return JSON.parse(data || '{}')
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

function mockOpponent(input) {
  const excerpt = input.latestArgument.trim().replace(/\s+/g, ' ').slice(0, 100)
  if (input.language === 'de') {
    return { response: `Du sagst „${excerpt}“. Für die Seite „${input.assignedSide}“ bleibt die offene Frage, ob dieser Vorteil auch dann gilt, wenn der wichtigste Zielkonflikt eintritt.`, question: input.round === 3 ? 'Welche Beobachtung würde dich bei diesem Punkt umstimmen?' : `Wie würdest du „${excerpt.slice(0, 60)}“ gegen das stärkste Gegenbeispiel verteidigen?`, round: input.round, language: 'de' }
  }
  return { response: `You argue “${excerpt}”. From the side “${input.assignedSide}”, the open question is whether that benefit still holds when the strongest trade-off appears.`, question: input.round === 3 ? 'What observation would change your mind on this point?' : `How would you defend “${excerpt.slice(0, 60)}” against the strongest counterexample?`, round: input.round, language: 'en' }
}

function mockJudge(input) {
  const userTurns = input.transcript.filter(turn => turn.role === 'user')
  const average = userTurns.reduce((sum, turn) => sum + turn.content.length, 0) / Math.max(1, userTurns.length)
  const base = Math.max(8, Math.min(18, Math.round(10 + average / 65)))
  const scores = [
    { label: 'Clarity', score: base, explanation: 'Your strongest point was readable and concrete.' },
    { label: 'Relevance', score: Math.min(20, base + 1), explanation: 'You stayed close to the take and the opposing points.' },
    { label: 'Reasoning', score: Math.max(8, base - 1), explanation: 'Your claims had a visible chain, with room for a sharper assumption.' },
    { label: 'Rebuttal', score: userTurns.length > 1 ? base : Math.max(8, base - 2), explanation: 'You responded to the exchange instead of repeating the opening.' },
    { label: 'Fairness', score: Math.min(20, base + 1), explanation: 'You treated the other side as a position to understand.' },
  ]
  return { total: scores.reduce((sum, item) => sum + item.score, 0), confidence: 0.68, scores, strongestPoints: ['You kept the exchange specific.', 'You acknowledged a real trade-off.'], coaching: 'Keep the same care while making your key claim one sentence sharper.' }
}

function parseTeamReview(input, value) {
  const parsed = teamReviewOutput.parse(value)
  if (input.teams.some(team => !parsed.teams[team.id])) throw new Error('The AI review did not score every team.')
  return parsed
}

function mockTeamReview(input) {
  const teams = Object.fromEntries(input.teams.map(team => {
    const turns = input.transcript.filter(turn => turn.teamId === team.id && !turn.skipped)
    const evidence = turns.slice(0, 2).map(turn => turn.content.replace(/\s+/g, ' ').trim().slice(0, 240)).filter(Boolean)
    const base = Math.max(8, Math.min(18, 10 + Math.min(6, Math.round(evidence.join(' ').length / 90))))
    return [team.id, { clarity: base, relevance: Math.min(20, base + 1), rebuttal: turns.length > 1 ? base : Math.max(7, base - 2), teamwork: turns.length > 1 ? base : Math.max(7, base - 1), fairness: Math.min(20, base + 1), strongestPoint: evidence[0] || 'No submitted argument was available for review.', unansweredQuestion: turns.length ? 'Which trade-off would most change this team’s position?' : 'No answer was recorded for this team.', evidence }]
  }))
  return parseTeamReview(input, { summary: 'This development review compares argument technique across the same five-part rubric. It does not determine which position is true.', commonGround: 'Each team engaged with the shared motion; the transcript shows where their reasoning still needs a direct response.', teams })
}

async function callProvider(kind, input) {
  if (mockAi) return kind === 'opponent' ? mockOpponent(input) : kind === 'judge' ? mockJudge(input) : mockTeamReview(input)
  if (!aiApiKey) throw new Error('AI provider is not configured on the server.')

  const prompt = kind === 'opponent'
    ? `You are a respectful debate opponent. Stay on the assigned side, respond to the actual argument, do not invent facts or citations, and write concise valid JSON with response, question, round and language.\nTake: ${input.take.statement}\nContext: ${input.take.context}\nAssigned side: ${input.assignedSide}\nRound: ${input.round}\nLatest argument: ${input.latestArgument}`
    : kind === 'judge'
      ? `You are a debate judge. Score argument technique, not political agreement. Reference the transcript, avoid false precision, and return valid JSON matching total, confidence, scores, strongestPoints and coaching.\nTranscript: ${JSON.stringify(input.transcript)}`
      : `You are a neutral debate facilitator. Evaluate argument technique, not ideology or factual certainty. Apply the same clarity, relevance, rebuttal, teamwork and fairness rubric to every team. Return only valid JSON matching summary, commonGround and teams keyed by the exact team IDs. strongestPoint and evidence must quote or closely reference only the supplied transcript; do not invent facts, citations or arguments.\nMotion: ${input.topic}\nTeams: ${JSON.stringify(input.teams)}\nTranscript: ${JSON.stringify(input.transcript)}`
  let lastError
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${aiApiKey}` },
        signal: controller.signal,
        body: JSON.stringify({ model: aiModel, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: prompt }] }),
      })
      if (response.status === 429) throw new Error('AI provider rate limit reached.')
      if (!response.ok) throw new Error(`AI provider returned ${response.status}.`)
      const payload = await response.json()
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('AI provider returned no content.')
      const parsed = JSON.parse(content)
      return kind === 'opponent' ? opponentOutput.parse(parsed) : kind === 'judge' ? judgeOutput.parse(parsed) : parseTeamReview(input, parsed)
    } catch (caught) {
      lastError = caught
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 300))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError || new Error('AI provider failed.')
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') return json(res, 204, {})
  if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, status: 'ok', environment: appEnvironment, backend: dataBackend, persistence: dataBackend, aiMode: serverAiMode, ai: { provider: mockAi ? 'mock' : 'server', basicServerAvailable: serverAiMode === 'basic_server_available' } })
  if (url.pathname === '/api/ai/opponent' && req.method === 'POST') {
    if (rateLimit(req, 'opponent', 20)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Too many opponent requests. Wait a minute and try again.', 'rate_limited') }
    try { return json(res, 200, await callProvider('opponent', opponentInput.parse(await body(req)))) } catch (caught) { logEvent(req, 'ai_opponent_failed', { provider: aiProvider }); return error(res, caught?.name === 'ZodError' ? 400 : 502, caught?.name === 'ZodError' ? caught.message : 'Opponent service is temporarily unavailable.', 'ai_unavailable') }
  }
  if (url.pathname === '/api/ai/judge' && req.method === 'POST') {
    if (rateLimit(req, 'judge', 10)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Too many scoring requests. Wait a minute and try again.', 'rate_limited') }
    try { return json(res, 200, await callProvider('judge', judgeInput.parse(await body(req)))) } catch (caught) { logEvent(req, 'ai_judge_failed', { provider: aiProvider }); return error(res, caught?.name === 'ZodError' ? 400 : 502, caught?.name === 'ZodError' ? caught.message : 'Scoring service is temporarily unavailable.', 'ai_unavailable') }
  }
  if (url.pathname === '/api/ai/team-review' && req.method === 'POST') {
    if (rateLimit(req, 'team-review', 5)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Too many team reviews. Try again later.', 'rate_limited') }
    try { const input = teamReviewInput.parse(await body(req)); return json(res, 200, { review: await callProvider('teamReview', input), aiMode: serverAiMode }) } catch (caught) { logEvent(req, 'ai_team_review_failed', { provider: aiProvider }); return error(res, caught?.name === 'ZodError' ? 400 : 502, caught?.name === 'ZodError' ? caught.message : 'Team review is temporarily unavailable. No score was saved.', 'ai_unavailable') }
  }
  if (url.pathname === '/api/analytics' && req.method === 'POST') {
    if (rateLimit(req, 'analytics', 60)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Analytics is receiving too many events. Try again later.', 'rate_limited') }
    const input = analyticsInput.parse(await body(req))
    if (dataBackend !== 'supabase') { logEvent(req, 'analytics_event', { event: input.event }); return json(res, 202, { accepted: true }) }
    const authorization = req.headers.authorization?.toString() || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
    if (!token || !supabaseAdmin) return error(res, 401, 'An authenticated beta session is required.', 'auth_required')
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData.user) return error(res, 401, 'The beta session has expired. Reconnect and try again.', 'auth_required')
    const { error: insertError } = await supabaseAdmin.from('analytics_events').insert({ user_id: userData.user.id, event_name: input.event, properties: input.properties })
    if (insertError) { logEvent(req, 'analytics_insert_failed', { event: input.event }); return error(res, 503, 'Analytics is temporarily unavailable.', 'analytics_unavailable') }
    return json(res, 202, { accepted: true })
  }
  if (url.pathname === '/api/challenges' && req.method === 'POST') {
    if (dataBackend === 'supabase') return error(res, 501, 'Challenge persistence is handled by the authenticated Supabase repository.', 'supabase_repository_required')
    if (rateLimit(req, 'challenge-create', 10)) return error(res, 429, 'Too many challenges. Try again later.', 'rate_limited')
    try {
      const input = challengeCreateInput.parse(await body(req))
      const token = randomBytes(24).toString('base64url')
      const store = loadStore()
      store.challenges[token] = { token, creatorId: input.creatorId, take: input.take, argument: input.argument, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), response: null, completedAt: null }
      saveStore(store)
      return json(res, 201, { token, url: `/challenge/${token}`, expiresAt: store.challenges[token].expiresAt })
    } catch (caught) { return error(res, 400, caught?.message || 'Challenge could not be created.', 'invalid_challenge') }
  }
  const challengeMatch = url.pathname.match(/^\/api\/challenges\/([A-Za-z0-9_-]+)(\/respond)?$/)
  if (challengeMatch) {
    if (dataBackend === 'supabase') return error(res, 501, 'Challenge persistence is handled by the authenticated Supabase repository.', 'supabase_repository_required')
    const token = challengeMatch[1]
    const store = loadStore()
    const challenge = store.challenges[token]
    if (!challenge) return error(res, 404, 'This challenge does not exist or has expired.', 'challenge_not_found')
    if (Date.parse(challenge.expiresAt) < Date.now()) return error(res, 410, 'This challenge has expired.', 'challenge_expired')
    if (!challengeMatch[2] && req.method === 'GET') {
      if (rateLimit(req, 'challenge-resolve', 30)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Too many challenge checks. Wait a minute and try again.', 'rate_limited') }
      return json(res, 200, { token, take: challenge.take, argument: challenge.argument, expiresAt: challenge.expiresAt, response: challenge.response, completedAt: challenge.completedAt })
    }
    if (challengeMatch[2] && req.method === 'POST') {
      if (rateLimit(req, 'challenge-response', 10)) { res.setHeader('retry-after', '60'); return error(res, 429, 'Too many challenge responses. Wait a minute and try again.', 'rate_limited') }
      if (challenge.response) return error(res, 409, 'This challenge already has a response.', 'challenge_completed')
      try {
        const input = challengeResponseInput.parse(await body(req))
        challenge.response = input.response
        challenge.completedAt = new Date().toISOString()
        const judge = await callProvider('judge', { transcript: [{ role: 'user', round: 1, content: challenge.argument }, { role: 'opponent', round: 1, content: input.response }], language: 'en' })
        challenge.result = judge
        saveStore(store)
        return json(res, 201, { response: challenge.response, completedAt: challenge.completedAt, result: judge })
      } catch (caught) { return error(res, 400, caught?.message || 'Response could not be submitted.', 'invalid_response') }
    }
  }
  return error(res, 404, 'API route not found.', 'not_found')
}

function serveStatic(res, url) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname
  let publicPath = url.pathname.startsWith('/challenge/') ? join(root, 'dist', 'index.html') : normalize(join(root, 'dist', requested))
  const distRoot = normalize(join(root, 'dist'))
  if (!publicPath.startsWith(distRoot)) return error(res, 404, 'Resource not found.', 'not_found')
  if (!existsSync(publicPath) && !extname(publicPath)) publicPath = join(root, 'dist', 'index.html')
  if (!existsSync(publicPath)) return error(res, 404, 'Build the app before starting the production server.', 'not_built')
  const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' }
  const isHtml = extname(publicPath) === '.html'
  res.writeHead(200, {
    'content-type': contentTypes[extname(publicPath)] || 'application/octet-stream',
    'cache-control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    'content-security-policy': "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://*.supabase.co https://*.supabase.in; manifest-src 'self'; worker-src 'self'",
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()'
  })
  res.end(readFileSync(publicPath))
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  req.requestId = requestId(req)
  res.setHeader('x-request-id', req.requestId)
  try {
    if (url.pathname.startsWith('/api/')) {
      if (!applyCors(req, res)) return error(res, 403, 'This origin is not allowed.', 'cors_denied')
      await handleApi(req, res, url)
    }
    else serveStatic(res, url)
  } catch (caught) {
    logEvent(req, 'server_error', { errorName: caught?.name || 'Error' })
    error(res, caught?.name === 'ZodError' ? 400 : 500, caught?.name === 'ZodError' ? 'The request could not be validated.' : 'Unexpected server error.', caught?.name === 'ZodError' ? 'invalid_request' : 'server_error')
  }
})

server.listen(port, host, () => console.log(`SideShift API listening on http://${host}:${port} (${serverAiMode})`))
