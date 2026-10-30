// 📦 Loads a module's bundle on first visit. Two failure modes are handled:
//
// - A stale chunk. After a deploy, a tab still running the old build asks for
//   a hashed file that no longer exists. One guarded full reload picks up the
//   new build; a second failure within the window is shown, not looped.
// - Anything else (a module whose entry throws on import, or exports nothing).
//   The error reaches the module's boundary, which offers a retry. Retrying
//   forgets the cached attempt, because React.lazy caches a rejection forever.

import { lazy, type LazyExoticComponent } from 'react'
import type { ModuleEntry, ModuleManifest } from './module'

const RELOAD_KEY = 'platform:chunk-reload-at'
const RELOAD_WINDOW_MS = 30_000

let reloadPage: () => void = () => window.location.reload()

/** Tests swap the reload so they can observe it without leaving the page. */
export function setReloadHandler(handler: () => void): void {
  reloadPage = handler
}

export class ModuleLoadError extends Error {
  constructor(readonly moduleId: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ModuleLoadError'
  }
}

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(message)
}

/** Reloads unless one already happened moments ago. True when a reload started. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_WINDOW_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // No session storage: reloading without a guard could loop, so don't.
    return false
  }
  reloadPage()
  return true
}

async function load(manifest: ModuleManifest): Promise<{ default: ModuleEntry }> {
  let loaded: { default?: unknown } | undefined
  try {
    loaded = await manifest.load()
  } catch (error) {
    // Never settles: the page is reloading, so keep the loading state up.
    if (isChunkLoadError(error) && reloadOnce()) return new Promise(() => undefined)
    throw new ModuleLoadError(manifest.id, `The ${manifest.title} module could not be loaded.`, { cause: error })
  }
  if (!loaded || loaded.default == null) {
    throw new ModuleLoadError(manifest.id, `The ${manifest.title} module has no default export.`)
  }
  return loaded as { default: ModuleEntry }
}

const cache = new Map<string, LazyExoticComponent<ModuleEntry>>()

export function lazyModule(manifest: ModuleManifest): LazyExoticComponent<ModuleEntry> {
  let component = cache.get(manifest.id)
  if (!component) {
    component = lazy(() => load(manifest))
    cache.set(manifest.id, component)
  }
  return component
}

/** Drops the cached bundle so the next render imports it afresh. */
export function forgetModule(id: string): void {
  cache.delete(id)
}
