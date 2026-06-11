const CACHE = 'schemini-v1.7'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return     // lascia passare Supabase, API esterne, font CDN
  if (url.pathname.startsWith('/api/')) return         // le chiamate API vanno sempre in rete
  e.respondWith((async () => {
    try {
      const fresh = await fetch(req)
      const cache = await caches.open(CACHE)
      cache.put(req, fresh.clone())
      return fresh
    } catch {
      const cached = await caches.match(req)
      if (cached) return cached
      if (req.mode === 'navigate') {
        const shell = await caches.match('/')
        if (shell) return shell
      }
      throw new Error('offline')
    }
  })())
})
