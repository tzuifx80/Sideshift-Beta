import { Capacitor } from '@capacitor/core'

let initialized = false

export async function initializeCapacitorBridge(): Promise<void> {
  if (initialized || !Capacitor.isNativePlatform()) return
  initialized = true
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', () => window.dispatchEvent(new Event('sideshift-native-back')))
  await App.addListener('appStateChange', state => window.dispatchEvent(new CustomEvent('sideshift-lifecycle', { detail: state })))
  await App.addListener('appUrlOpen', event => {
    try {
      const url = new URL(event.url)
      const deepPath = url.pathname.startsWith('/challenge/') || url.pathname.startsWith('/group/')
        ? url.pathname
        : url.host === 'challenge' ? `/challenge${url.pathname}` : url.host === 'group' ? `/group${url.pathname}` : ''
      if (deepPath) {
        window.history.pushState({}, '', `${deepPath}${url.search}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch {
      // Ignore malformed deep links from another app.
    }
  })
}

export async function shareWithNative(data: { title: string; text: string; url?: string }): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  const { Share } = await import('@capacitor/share')
  await Share.share(data)
  return true
}

export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
