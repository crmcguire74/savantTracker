// 📲 Installable app and updates.
//
// startPwa() runs once from main.tsx. It registers dist/sw.js in production
// builds (never under the Vite dev server, where a worker would cache
// modules mid-edit), captures the browser's install prompt, and watches for
// a newer worker. A new deploy produces a new sw.js; the browser finds it on
// load, when the window regains focus, or on the half-hourly check. When it
// has installed, `updateReady` turns on and the UI offers a reload. The page
// is never reloaded without the user's say-so, except when they asked for it.

import { useSyncExternalStore } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface PwaState {
  /** A service worker is registered and controlling (or about to control) this page. */
  active: boolean
  /** A newer version has been downloaded and is waiting for a reload. */
  updateReady: boolean
  /** The browser offered an install prompt that has not been used yet. */
  installable: boolean
  /** Running as an installed app window. */
  standalone: boolean
  /** Short build id of the running service worker, when known. */
  version: string | null
  checking: boolean
  lastChecked: number | null
}

const UPDATE_INTERVAL_MS = 30 * 60 * 1000
const FOCUS_CHECK_MIN_GAP_MS = 60 * 1000

let state: PwaState = {
  active: false,
  updateReady: false,
  installable: false,
  standalone: false,
  version: null,
  checking: false,
  lastChecked: null,
}
const listeners = new Set<() => void>()
let registration: ServiceWorkerRegistration | null = null
let deferredPrompt: BeforeInstallPromptEvent | null = null
let applying = false
let started = false

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

function readVersion(worker: ServiceWorker | null) {
  if (!worker) return
  const channel = new MessageChannel()
  channel.port1.onmessage = (event) => typeof event.data === 'string' && set({ version: event.data })
  worker.postMessage({ type: 'GET_VERSION' }, [channel.port2])
}

const noticeWaiting = (reg: ServiceWorkerRegistration) => {
  // A waiting worker next to an existing controller means: new version ready.
  // Without a controller it is the very first install; nothing to offer.
  if (reg.waiting && navigator.serviceWorker.controller) set({ updateReady: true })
}

function trackInstalling(reg: ServiceWorkerRegistration) {
  const incoming = reg.installing
  incoming?.addEventListener('statechange', () => {
    if (incoming.state === 'installed') noticeWaiting(reg)
  })
}

function watch(reg: ServiceWorkerRegistration) {
  noticeWaiting(reg)
  // The browser checks for a new sw.js on every page load, often before this
  // code runs, so an install may already be in flight with its
  // `updatefound` long gone. Follow it too, or the update goes unnoticed.
  trackInstalling(reg)
  reg.addEventListener('updatefound', () => trackInstalling(reg))
}

const UPDATE_TIMEOUT_MS = 15 * 1000

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<'timeout'>((resolve) => window.setTimeout(() => resolve('timeout'), ms))])

/** Hashed asset files a page references, e.g. "assets/index-7PA_BeWL.js". */
export function assetFingerprint(html: string): string {
  return [...new Set(html.match(/assets\/[\w.-]+\.(?:js|css)/g) ?? [])].sort().join(' ')
}

const runningFingerprint = () =>
  assetFingerprint(
    [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[rel="stylesheet"][href]')]
      .map((element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '')
      .join(' '),
  )

/**
 * Asks the server which build it is serving, independent of the service
 * worker: hashed file names change exactly when the code does. "./" rather
 * than "./index.html" so the request is not answered from the precache.
 */
async function serverHasNewerBuild(): Promise<boolean> {
  const running = runningFingerprint()
  if (!running) return false
  const response = await fetch('./', { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok || !(response.headers.get('content-type') ?? '').includes('text/html')) return false
  const served = assetFingerprint(await response.text())
  return served !== '' && served !== running
}

export async function checkForUpdate(): Promise<void> {
  if (!registration) return
  set({ checking: true })
  try {
    // The browser's own update can stall (a crashed session, a busy worker),
    // so it is bounded, and the build comparison below decides on its own.
    await withTimeout(registration.update(), UPDATE_TIMEOUT_MS)
    noticeWaiting(registration)
    if (!state.updateReady && (await serverHasNewerBuild())) set({ updateReady: true })
  } catch {
    // Offline, or an expired sign-in answered with a redirect. Try later.
  } finally {
    set({ checking: false, lastChecked: Date.now() })
  }
}

/**
 * Moves to the newest version. With a waiting worker, activate it and reload
 * when it takes over. Without one, a plain reload is enough: pages are
 * fetched network first, so the reload runs the new build, and the worker
 * catches up in the background.
 */
export function applyUpdate() {
  const waiting = registration?.waiting
  if (!waiting) {
    window.location.reload()
    return
  }
  applying = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
  // Should the handover not happen promptly, reload anyway.
  window.setTimeout(() => window.location.reload(), 4000)
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  const event = deferredPrompt
  deferredPrompt = null
  set({ installable: false })
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome
}

export function startPwa() {
  if (started || typeof window === 'undefined') return
  started = true
  set({ standalone: isStandalone() })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => set({ standalone: isStandalone() }))

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's mini-infobar quiet; the app offers install itself.
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    set({ installable: true })
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    set({ installable: false })
  })

  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext) return

  // On a first visit there is no controller until the new worker claims the
  // page. That handover is not an update and must not prompt.
  const startedControlled = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) {
      window.location.reload()
      return
    }
    readVersion(navigator.serviceWorker.controller)
    // Another window applied an update; this one still runs the old code.
    if (startedControlled) set({ updateReady: true })
  })

  const register = async () => {
    try {
      registration = await navigator.serviceWorker.register('./sw.js', { scope: './' })
      set({ active: true })
      watch(registration)
      readVersion(navigator.serviceWorker.controller ?? registration.active)
      window.setInterval(() => void checkForUpdate(), UPDATE_INTERVAL_MS)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        if (state.lastChecked && Date.now() - state.lastChecked < FOCUS_CHECK_MIN_GAP_MS) return
        void checkForUpdate()
      })
    } catch (error) {
      console.warn('Service worker registration failed; the app still works without offline support.', error)
    }
  }

  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register(), { once: true })
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}
