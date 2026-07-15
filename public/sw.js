const CACHE_NAME = 'sideshift-static-v2'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([OFFLINE_URL, '/manifest.webmanifest', '/icons/sideshift.svg', '/icons/maskable.svg'])))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/challenge/') || url.pathname.startsWith('/rest/')) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
      return response
    }).catch(async () => {
      if (url.pathname.startsWith('/challenge/')) return caches.match(OFFLINE_URL)
      return (await caches.match(request)) || (await caches.match('/')) || caches.match(OFFLINE_URL)
    }))
    return
  }

  const isStaticAsset = ['script', 'style', 'image', 'font'].includes(request.destination) || url.pathname === '/manifest.webmanifest'
  if (!isStaticAsset) return
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()))
    return response
  })))
})
