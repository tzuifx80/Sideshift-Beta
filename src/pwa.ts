import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const INSTALL_DISMISSED_KEY = 'sideshift-install-dismissed-v1'
const SERVICE_WORKER_UPDATE_EVENT = 'sideshift-sw-update'

type ServiceWorkerUpdateDetail = { registration: ServiceWorkerRegistration }

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return
  void navigator.serviceWorker.register('/sw.js').then(registration => {
    const announce = () => {
      if (registration.waiting && navigator.serviceWorker.controller) window.dispatchEvent(new CustomEvent<ServiceWorkerUpdateDetail>(SERVICE_WORKER_UPDATE_EVENT, { detail: { registration } }))
    }
    announce()
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      if (!worker) return
      worker.addEventListener('statechange', () => { if (worker.state === 'installed') announce() })
    })
  }).catch(() => undefined)
}

export function useServiceWorkerUpdate(): { available: boolean; apply: () => void } {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  useEffect(() => {
    const handleUpdate = (event: Event) => setRegistration((event as CustomEvent<ServiceWorkerUpdateDetail>).detail.registration)
    window.addEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate)
    return () => window.removeEventListener(SERVICE_WORKER_UPDATE_EVENT, handleUpdate)
  }, [])
  function apply() {
    const waiting = registration?.waiting
    if (!waiting) return
    const reload = () => window.location.reload()
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true })
    waiting.postMessage({ type: 'SKIP_WAITING' })
  }
  return { available: Boolean(registration?.waiting), apply }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])
  return online
}

export function useInstallPrompt(): { available: boolean; install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>; dismiss: () => void } {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const timestamp = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY) || 0)
    return timestamp > Date.now() - 30 * 86400_000
  })
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as InstallPromptEvent)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [])
  async function install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!promptEvent) return 'unavailable'
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setPromptEvent(null)
    if (choice.outcome === 'dismissed') dismiss()
    return choice.outcome
  }
  function dismiss() {
    window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(Date.now()))
    setDismissed(true)
    setPromptEvent(null)
  }
  return { available: Boolean(promptEvent) && !dismissed, install, dismiss }
}
