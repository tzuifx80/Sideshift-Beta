import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { loadState } from '../storage'
import { selectRepository } from '../data/selectRepository'
import { createSupabaseBrowserClient, getOrCreateAnonymousSession, readSupabaseConfig } from '../data/supabaseClient'
import type { AppRepository } from '../data/repository'
import { defaultProfileFieldVisibility } from '../profile'

export type AuthState = {
  user: User | null
  userId: string | null
  accessToken: string | null
  loading: boolean
  error: string | null
  backend: 'local' | 'supabase'
  repository: AppRepository | null
  retry: () => void
  resetSession: () => Promise<void>
}

const AuthContext = createContext<AuthState>({ user: null, userId: null, accessToken: null, loading: true, error: null, backend: 'local', repository: null, retry: () => undefined, resetSession: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = (import.meta.env.VITE_DATA_BACKEND || (import.meta.env.PROD ? 'supabase' : 'local')) as AuthState['backend']
  const [state, setState] = useState<Omit<AuthState, 'retry' | 'resetSession'>>({ user: null, userId: null, accessToken: null, loading: true, error: null, backend, repository: null })
  const [attempt, setAttempt] = useState(0)

  const connect = useCallback(async (signal?: { cancelled: boolean }): Promise<() => void> => {
    if (backend === 'local') {
      const local = loadState()
      const repository = selectRepository({ VITE_DATA_BACKEND: 'local' })
      setState({ user: null, userId: local.userId, accessToken: null, loading: false, error: null, backend, repository })
      return () => undefined
    }
    const config = readSupabaseConfig(import.meta.env as Record<string, string | undefined>)
    const client = createSupabaseBrowserClient(config)
    const setSession = (session: Session | null, repository: AppRepository | null, error: string | null = null) => {
      if (signal?.cancelled) return
      setState({ user: session?.user || null, userId: session?.user.id || null, accessToken: session?.access_token || null, loading: false, error, backend, repository })
    }
    try {
      const session = await getOrCreateAnonymousSession(client)
      const repository = selectRepository({ VITE_DATA_BACKEND: 'supabase', VITE_SUPABASE_URL: config.url, VITE_SUPABASE_ANON_KEY: config.anonKey }, client)
      const existingProfile = await repository.loadProfile(session.user.id)
      if (!existingProfile) await repository.saveProfile({ id: session.user.id, displayName: null, bio: null, avatarPreset: 'orbit', interfaceLanguage: 'en', challengeShowName: false, shareRealStance: false, publicProfileKey: null, handle: null, friendCode: null, avatarPath: null, profileAccent: 'coral', profileVisibility: 'friends', avatarVisibility: 'private', fieldVisibility: { ...defaultProfileFieldVisibility }, visibleStats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false }, socialLinks: [] })
      const existingPreferences = await repository.loadPreferences(session.user.id)
      if (!existingPreferences) await repository.savePreferences({ userId: session.user.id, topicPreferences: [], debateLanguages: ['en'], intensity: 'balanced', preferredMode: 'sideswitch', preferredAiStyle: 'sharp-skeptic', preferredOpponentType: 'ask', preferredAiFamily: 'GPT', preferredOpponentId: 'gpt-logician', preferredAiModelId: null, aiDifficulty: 'intermediate', aiRoundLength: 'standard', aiQuality: 'balanced', aiResponseLength: 'standard', showModelDetails: false, theme: 'system', accent: 'coral', reducedMotion: false, textSize: 'comfortable', shareRealStance: false, onboardingCompleted: false, onboardingStage: 0, onboardingGoal: 'reasoning', onboardingDismissed: false })
      setSession(session, repository)
      const subscription = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession, repository))
      return () => subscription.data.subscription.unsubscribe()
    } catch (caught) {
      setSession(null, null, caught instanceof Error ? caught.message : 'Authentication failed. Try again.')
      return () => undefined
    }
  }, [backend])

  useEffect(() => {
    const signal = { cancelled: false }
    setState(current => ({ ...current, loading: true, error: null }))
    let cleanup: () => void = () => undefined
    void connect(signal).then(value => {
      if (signal.cancelled) value()
      else cleanup = value
    })
    return () => { signal.cancelled = true; cleanup() }
  }, [attempt, connect])

  const retry = useCallback(() => setAttempt(value => value + 1), [])
  const resetSession = useCallback(async () => {
    if (backend !== 'supabase') return
    try {
      const config = readSupabaseConfig(import.meta.env as Record<string, string | undefined>)
      await createSupabaseBrowserClient(config).auth.signOut({ scope: 'local' })
    } finally {
      retry()
    }
  }, [backend, retry])

  const value = useMemo(() => ({ ...state, retry, resetSession }), [resetSession, retry, state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
