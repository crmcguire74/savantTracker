// 🎛️ Storage entry point. One module decides which adapter boots, everything
// else imports `storage` and never names a backend again.
//
// Driver selection, in order:
//   1. `VITE_STORAGE_DRIVER` in .env  ("indexeddb" | "memory" | "rest")
//   2. `?storage=` in the URL, useful for a quick demo without a rebuild
//   3. IndexedDB, with an automatic fall back to memory when the browser
//      refuses to open a database (private window, blocked site data)

import { authMode, DEV_ROLE_HEADER, readDevRole } from '../auth/session'
import { StorageUnavailableError, type StorageAdapter } from './contract'
import { IndexedDbAdapter } from './indexeddb'
import { MemoryAdapter } from './memory'
import { RestAdapter } from './rest'
import { createStorageProxy, type StorageProxy } from './proxy'

export type DriverName = 'indexeddb' | 'memory' | 'rest'

const readEnv = (key: string): string | undefined => {
  try {
    return (import.meta as unknown as { env?: Record<string, string> }).env?.[key]
  } catch {
    return undefined
  }
}

const readUrlDriver = (): DriverName | undefined => {
  if (typeof location === 'undefined') return undefined
  const value = new URLSearchParams(location.search).get('storage')
  return value === 'indexeddb' || value === 'memory' || value === 'rest' ? value : undefined
}

export function resolveDriver(): DriverName {
  const configured = readEnv('VITE_STORAGE_DRIVER') as DriverName | undefined
  return readUrlDriver() ?? configured ?? 'indexeddb'
}

export function createAdapter(driver: DriverName = resolveDriver()): StorageAdapter {
  switch (driver) {
    case 'memory':
      return new MemoryAdapter()
    case 'rest':
      return new RestAdapter({
        baseUrl: readEnv('VITE_API_BASE_URL') ?? '/api',
        authHeaders: (): Record<string, string> => {
          const token = readEnv('VITE_API_TOKEN')
          // The local server acts as the tester's picked role; a server with
          // real sign-in ignores this header and reads the Entra claims.
          const headers: Record<string, string> = authMode() === 'local' ? { [DEV_ROLE_HEADER]: readDevRole() } : {}
          if (token) headers.Authorization = `Bearer ${token}`
          return headers
        },
      })
    case 'indexeddb':
    default:
      return new IndexedDbAdapter()
  }
}

/** The single storage handle for the whole app. */
export const storage: StorageProxy = createStorageProxy(createAdapter())

/**
 * Opens storage, degrading to memory rather than dying when the browser will
 * not give us a database. Returns the driver actually running.
 */
export async function openStorage(): Promise<{ driver: string; degraded: boolean }> {
  try {
    await storage.open()
    return { driver: storage.status.driver, degraded: false }
  } catch (error) {
    if (!(error instanceof StorageUnavailableError)) throw error
    if (storage.status.driver === 'rest') throw error
    await storage.swap(new MemoryAdapter(), { migrate: false })
    return { driver: storage.status.driver, degraded: true }
  }
}

export * from './contract'
export { IndexedDbAdapter, destroyLocalDatabase } from './indexeddb'
export { MemoryAdapter } from './memory'
export { RestAdapter } from './rest'
export { createStorageProxy } from './proxy'
export type { StorageProxy, StorageControl, StorageStatus, SwapOptions, SwapReport } from './proxy'
