const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'private-beta' || process.argv.includes('--production')
const backend = (process.env.VITE_DATA_BACKEND || process.env.DATA_BACKEND || '').toLowerCase()
const missing = []
const forbidden = ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY', 'VITE_AI_API_KEY', 'VITE_BASIC_AI_API_KEY', 'VITE_FEEDBACK_TO_EMAIL', 'VITE_FEEDBACK_EMAIL_API_KEY']

for (const key of forbidden) if (process.env[key]) missing.push(`${key} must not be set`)
if (isProduction && backend !== 'supabase') missing.push('VITE_DATA_BACKEND/DATA_BACKEND=supabase')
if (backend === 'supabase' || isProduction) {
  for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) if (!process.env[key]) missing.push(key)
}
if (isProduction) {
  if (process.env.VITE_AI_MOCK === 'true') missing.push('VITE_AI_MOCK must not be enabled in production')
  if (!process.env.APP_BASE_URL?.startsWith('https://')) missing.push('APP_BASE_URL=https://...')
  if (!process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS.includes('*')) missing.push('ALLOWED_ORIGINS=explicit HTTPS origin')
  if (process.env.AI_PROVIDER && process.env.AI_PROVIDER !== 'mock' && !(process.env.AI_API_KEY || process.env.OPENAI_API_KEY)) missing.push('AI_API_KEY')
}
if (missing.length) {
  console.error(`ENV_VALIDATION_FAILED: ${[...new Set(missing)].join(', ')}`)
  process.exit(2)
}
console.log(`ENV_VALIDATION_OK environment=${process.env.APP_ENV || 'local'} backend=${backend || 'local'}`)
