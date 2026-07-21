const baseUrl = (process.argv[2] || '').replace(/\/$/, '')
if (!baseUrl || !/^https:\/\//i.test(baseUrl)) {
  console.error('Usage: npm run api:worker:verify -- https://your-worker.example.workers.dev')
  process.exit(1)
}

const response = await fetch(`${baseUrl}/api/health`)
if (!response.ok) throw new Error(`Worker health failed with ${response.status}.`)
const health = await response.json()
if (health?.ai?.provider !== 'cloudflare-workers-ai') throw new Error('Worker health did not report Workers AI.')
const unauthenticated = await fetch(`${baseUrl}/api/ai/basic/capability`)
if (unauthenticated.status !== 401) throw new Error(`Worker accepted an unauthenticated capability request (${unauthenticated.status}).`)
console.log(JSON.stringify({ health, unauthenticated: unauthenticated.status }, null, 2))
