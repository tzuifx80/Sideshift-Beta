import { createLocalRepository } from './localRepository'
import { createSupabaseRepository } from './supabaseRepository'
import type { AppRepository } from './repository'
import { createSupabaseBrowserClient, readSupabaseConfig } from './supabaseClient'
import type { SupabaseClient } from '@supabase/supabase-js'

export function selectRepository(env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>, client?: SupabaseClient): AppRepository {
  const isProduction = String(env.PROD) === 'true'
  const backend = (env.VITE_DATA_BACKEND || (isProduction ? 'supabase' : 'local')).toLowerCase()
  if (backend !== 'local' && backend !== 'supabase') throw new Error(`Unsupported data backend: ${backend}`)
  if (isProduction && backend !== 'supabase') throw new Error('Production builds must use the Supabase backend.')
  if (backend === 'supabase') {
    const config = readSupabaseConfig(env)
    return createSupabaseRepository(client || createSupabaseBrowserClient(config))
  }
  return createLocalRepository()
}
