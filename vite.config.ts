import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  if (mode === 'production') {
    const missing = []
    if (env.VITE_DATA_BACKEND !== 'supabase') missing.push('VITE_DATA_BACKEND=supabase')
    if (!env.VITE_SUPABASE_URL) missing.push('VITE_SUPABASE_URL')
    if (!env.VITE_SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY')
    for (const key of ['VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_OPENAI_API_KEY', 'VITE_AI_API_KEY']) if (env[key]) missing.push(`${key} must not be exposed`)
    if (env.VITE_API_BASE_URL && !/^https:\/\//.test(env.VITE_API_BASE_URL)) missing.push('VITE_API_BASE_URL must use HTTPS')
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
