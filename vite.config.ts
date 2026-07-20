import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function unsafeProductionApiUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    return parsed.protocol !== 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0' || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  } catch { return true }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  if (mode === 'production') {
    const missing = []
    if (env.VITE_DATA_BACKEND !== 'supabase') missing.push('VITE_DATA_BACKEND=supabase')
    if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
    if (!env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
    if (env.VITE_AI_MOCK === 'true') missing.push('VITE_AI_MOCK must not be enabled in production')
    for (const key of ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY', 'VITE_AI_API_KEY', 'VITE_BASIC_AI_API_KEY', 'VITE_FEEDBACK_TO_EMAIL', 'VITE_FEEDBACK_EMAIL_API_KEY']) if (env[key]) missing.push(`${key} must not be exposed`)
    if (!env.VITE_API_BASE_URL) missing.push('VITE_API_BASE_URL (HTTPS production API URL)')
    else if (unsafeProductionApiUrl(env.VITE_API_BASE_URL)) missing.push('VITE_API_BASE_URL must be public HTTPS (no localhost/private LAN)')
    if (env.VITE_APP_BASE_URL && !/^https:\/\//.test(env.VITE_APP_BASE_URL)) missing.push('VITE_APP_BASE_URL must use HTTPS')
    if (missing.length) throw new Error(`Production frontend configuration is invalid: ${missing.join(', ')}`)
  }
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': 'http://127.0.0.1:8787',
      },
    },
  }
})
