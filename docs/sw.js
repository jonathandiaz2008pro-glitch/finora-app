// Pecunia Service Worker — network-first, auto-update
const CACHE = 'pecunia-v4'
const FONT_CACHE = 'pecunia-fonts-v1'

// Install: activate immediately, pre-cache fonts
self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(FONT_CACHE).then(c =>
      c.addAll([
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap'
      ]).catch(() => {})
    )
  )
})

// Activate: remove old caches, claim clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch strategy:
// - HTML navigation → always network (never stale)
// - Google Fonts → cache first (stable, never changes)
// - Supabase / puter / CDN APIs → network only (never intercept)
// - Anything else → network only
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // NEVER cache or intercept Firebase, puter, or API calls
  if(
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') && !url.hostname.includes('fonts') ||
    url.hostname.includes('puter.com') ||
    url.hostname.includes('paypal.com')
  ) return // pass through untouched

  // HTML — always fresh from network
  if(e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // Google Fonts CSS + font files — cache first (long-lived)
  if(
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if(cached) return cached
        return fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(FONT_CACHE).then(c => c.put(e.request, clone))
          return res
        })
      })
    )
    return
  }

  // Everything else: network only, no caching
})

// Message from app: force SW activation
self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
