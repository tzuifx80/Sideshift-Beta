import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { loadState } from '../storage'
import { selectRepository } from '../data/selectRepository'
import { createSupabaseBrowserClient, getOrCreateAnonymousSession, readSupabaseConfig } from '../data/supabaseClient'
import type { AppRepository } from '../data/repository'
import { defaultProfileFieldVisibility } from '../profile'
import { clearSignedOutPreference, hasSignedOutPreference, logoutDiagnostic, shouldIgnoreAuthStateChange, signOutAndClear } from '../logout'

export type AuthState = {
  user: User | null
  userId: string | null
  accessToken: string | null
  loading: boolean
  error: string | null
  backend: 'local' | 'supabase'
  repository: AppRepository | null
  signedOut: boolean
  retry: () => void
  continueAsGuest: () => Promise<void>
  resetSession: () => Promise<void>
}

const AuthContext = createContext<AuthState>({ user: null, userId: null, accessToken: null, loading: true, error: null, backend: 'local', repository: null, signedOut: false, retry: () => undefined, continueAsGuest: async () => undefined, resetSession: async () => undefined })

export function AuthProvider({ children }: { children: ReactNode }) {
  const backend = (import.meta.env.VITE_DATA_BACKEND || (import.meta.env.PROD ? 'supabase' : 'local')) as AuthState['backend']
  const [state, setState] = useState<Omit<AuthState, 'retry' | 'continueAsGuest' | 'resetSession'>>({ user: null, userId: null, accessToken: null, loading: true, error: null, backend, repository: null, signedOut: false })
  const [attempt, setAttempt] = useState(0)
  const signingOutRef = useRef(false)
  const allowAnonymousCreationRef = useRef(false)

  const connect = useCallback(async (signal?: { cancelled: boolean }): Promise<() => void> => {
    if (backend === 'local') {
      const local = loadState()
      const repository = selectRepository({ VITE_DATA_BACKEND: 'local' })
      setState({ user: null, userId: local.userId, accessToken: null, loading: false, error: null, backend, repository, signedOut: false })
      return () => undefined
    }
    const config = readSupabaseConfig(import.meta.env as Record<string, string | undefined>)
    const client = createSupabaseBrowserClient(config)
    if (hasSignedOutPreference()) {
      setState({ user: null, userId: null, accessToken: null, loading: false, error: null, backend, repository: null, signedOut: true })
      return () => undefined
    }
    const setSession = (session: Session | null, repository: AppRepository | null, error: string | null = null) => {
      if (signal?.cancelled || shouldIgnoreAuthStateChange(signingOutRef.current, hasSignedOutPreference())) return
      setState({ user: session?.user || null, userId: session?.user.id || null, accessToken: session?.access_token || null, loading: false, error, backend, repository: session ? repository : null, signedOut: !session })
    }
    try {
      const session = await getOrCreateAnonymousSession(client, { allowAnonymousCreation: allowAnonymousCreationRef.current })
      if (!session) {
        setState({ user: null, userId: null, accessToken: null, loading: false, error: null, backend, repository: null, signedOut: true })
        return () => undefined
      }
      const repository = selectRepository({ VITE_DATA_BACKEND: 'supabase', VITE_SUPABASE_URL: config.url, VITE_SUPABASE_ANON_KEY: config.anonKey }, client)
      const existingProfile = await repository.loadProfile(session.user.id)
      if (!existingProfile) await repository.saveProfile({ id: session.user.id, displayName: null, bio: null, avatarPreset: 'orbit', interfaceLanguage: 'en', challengeShowName: false, shareRealStance: false, publicProfileKey: null, handle: null, friendCode: null, avatarPath: null, profileAccent: 'coral', profileVisibility: 'friends', avatarVisibility: 'private', fieldVisibility: { ...defaultProfileFieldVisibility }, visibleStats: { debates: true, sideSwitches: true, constructive: true, argumentDna: false }, socialLinks: [] })
      const existingPreferences = await repository.loadPreferences(session.user.id)
      if (!existingPreferences) await repository.savePreferences({ userId: session.user.id, topicPreferences: [], debateLanguages: ['en'], intensity: 'balanced', preferredMode: 'sideswitch', preferredAiStyle: 'sharp-skeptic', preferredOpponentType: 'ask', preferredAiFamily: 'GPT', preferredOpponentId: 'gpt-logician', preferredAiModelId: null, aiDifficulty: 'intermediate', aiRoundLength: 'standard', aiQuality: 'balanced', aiResponseLength: 'standard', showModelDetails: false, theme: 'system', accent: 'coral', reducedMotion: false, textSize: 'comfortable', shareRealStance: false, onboardingCompleted: false, onboardingStage: 0, onboardingGoal: 'reasoning', onboardingDismissed: false, hideSensitiveWorldPulse: false })
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

  useEffect(() => {
    const handleLifecycle = () => {
      if (!hasSignedOutPreference()) return
      signingOutRef.current = true
      setState(current => ({ ...current, user: null, userId: null, accessToken: null, loading: false, error: null, repository: null, signedOut: true }))
    }
    window.addEventListener('sideshift-lifecycle', handleLifecycle)
    return () => window.removeEventListener('sideshift-lifecycle', handleLifecycle)
  }, [])

  const retry = useCallback(() => {
    if (hasSignedOutPreference()) {
      signingOutRef.current = true
      setState(current => ({ ...current, user: null, userId: null, accessToken: null, loading: false, error: null, repository: null, signedOut: true }))
      return
    }
    signingOutRef.current = false
    setState(current => ({ ...current, signedOut: false, loading: true, error: null }))
    setAttempt(value => value + 1)
  }, [])
  const continueAsGuest = useCallback(async () => {
    try {
      clearSignedOutPreference()
    } catch {
      setState(current => ({ ...current, loading: false, error: 'Guest mode could not start. Please try again.', signedOut: true }))
      return
    }
    allowAnonymousCreationRef.current = true
    signingOutRef.current = false
    setState(current => ({ ...current, user: null, userId: null, accessToken: null, loading: true, error: null, repository: null, signedOut: false }))
    setAttempt(value => value + 1)
  }, [])
  const resetSession = useCallback(async () => {
    if (backend !== 'supabase') return
    signingOutRef.current = true
    allowAnonymousCreationRef.current = false
    const config = readSupabaseConfig(import.meta.env as Record<string, string | undefined>)
    const client = createSupabaseBrowserClient(config)
    setState(current => ({ ...current, loading: true, error: null }))
    logoutDiagnostic('sign_out_request_started')
    try {
      await signOutAndClear(client)
      logoutDiagnostic('sign_out_result=success')
      logoutDiagnostic('cache_cleanup_completed')
      setState({ user: null, userId: null, accessToken: null, loading: false, error: null, backend, repository: null, signedOut: true })
      logoutDiagnostic('route_reset_completed')
    } catch (caught) {
      logoutDiagnostic('sign_out_result=failure')
      signingOutRef.current = false
      setState(current => ({ ...current, loading: false, error: null, signedOut: hasSignedOutPreference() }))
      throw caught
    }
  }, [backend])

  const value = useMemo(() => ({ ...state, retry, continueAsGuest, resetSession }), [continueAsGuest, resetSession, retry, state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
