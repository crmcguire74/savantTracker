/* 📦 Service worker template. `npm run build` copies this to dist/sw.js and
   replaces the two placeholders: the build version and the list of files to
   precache (see the `serviceWorker` plugin in vite.config.ts). A new build
   therefore produces a byte-different sw.js, which is how the browser knows
   an update exists.

   Strategy, chosen to coexist with App Service Easy Auth:
   - /api/* and /.auth/*      never touched; always the network
   - page navigations         network first, so a deploy shows on the next
                              load and an expired session still reaches the
                              Microsoft sign-in redirect; the cached shell is
                              used only when the network is unreachable
   - hashed build assets      cache first (their names change when they do)
   - Google Fonts             cache first after the first successful load

   The new worker does not take over on its own. The page shows "Update
   available" and posts SKIP_WAITING when the user accepts, so a half-typed
   edit is never reloaded away. Closing every window also applies it. */

const VERSION = '__SW_VERSION__'
const PRECACHE = __SW_PRECACHE__
const PREFIX = 'savant-tracker-'
const SHELL_CACHE = `${PREFIX}shell-${VERSION}`
const FONT_CACHE = `${PREFIX}fonts`

const scopeUrl = new URL(self.registration.scope)
const toUrl = (path) => new URL(path, scopeUrl).href
const SHELL_URL = toUrl('index.html')
const PRECACHE_URLS = new Set(PRECACHE.map(toUrl))

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // cache: 'reload' skips the HTTP cache so the shell matches this build.
      cache.addAll(PRECACHE.map((path) => new Request(toUrl(path), { cache: 'reload', credentials: 'same-origin' }))),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names.filter((name) => name.startsWith(`${PREFIX}shell-`) && name !== SHELL_CACHE).map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
  if (event.data?.type === 'GET_VERSION') event.ports[0]?.postMessage(VERSION)
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(cacheFirst(request, FONT_CACHE))
    return
  }
  if (url.origin !== self.location.origin) return
  if (!url.href.startsWith(scopeUrl.href)) return

  const path = url.pathname.slice(scopeUrl.pathname.length)
  if (path.startsWith('api/') || url.pathname.startsWith('/.auth/')) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }
  if (PRECACHE_URLS.has(url.origin + url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
  }
})

async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    // Only a real page refreshes the offline shell. A sign-in redirect or
    // an error page must never be cached as the app.
    if (response.ok && response.type === 'basic' && (response.headers.get('content-type') ?? '').includes('text/html')) {
      const cache = await caches.open(SHELL_CACHE)
      await cache.put(SHELL_URL, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(SHELL_URL)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request, { ignoreSearch: cacheName === SHELL_CACHE })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
    await cache.put(request, response.clone())
  }
  return response
}
