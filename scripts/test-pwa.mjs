import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const required = ['index.html', 'manifest.webmanifest', 'sw.js', 'offline.html', 'icons/sideshift.svg', 'icons/maskable.svg']
const missing = required.filter(path => !existsSync(join(root, path)))
if (missing.length) {
  console.error(`PWA_TEST_FAILED: missing ${missing.join(', ')}`)
  process.exit(1)
}
const html = readFileSync(join(root, 'index.html'), 'utf8')
const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'))
if (!html.includes('manifest.webmanifest') || !html.includes('apple-mobile-web-app-capable')) throw new Error('installability metadata is incomplete')
if (manifest.name !== 'SideShift' || manifest.short_name !== 'SideShift' || manifest.display !== 'standalone' || manifest.scope !== '/' || manifest.start_url !== '/') throw new Error('manifest identity or scope is invalid')
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2 || !manifest.icons.some(icon => icon.purpose?.includes('maskable'))) throw new Error('maskable icon is missing')
const serviceWorker = readFileSync(join(root, 'sw.js'), 'utf8')
if (!serviceWorker.includes('/offline.html') || !serviceWorker.includes("url.pathname.startsWith('/api/')") || /cache\.put\([^)]*\/api\//i.test(serviceWorker) || /supabase/i.test(serviceWorker)) throw new Error('service worker has unsafe private-data caching rules')
console.log(`PWA_TEST_OK assets=${required.length} icons=${manifest.icons.length} offline_fallback=true`)
