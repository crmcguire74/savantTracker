// 🔀 The storage proxy.
//
// This is the single object the rest of the app holds. It satisfies
// `StorageAdapter`, so callers use it exactly like a store, but underneath it
// forwards every call to whichever adapter is currently mounted and can
// exchange that adapter at runtime without anyone above it noticing.
//
// Why a real `Proxy` and not a plain wrapper class: the wrapper would have to
// re-declare every method, and every method added to the contract later
// becomes a second edit in a second file that is easy to forget. The trap
// forwards by default and only intercepts what it actually needs to manage:
// subscriptions (which must survive a swap) and the control surface.
//
//   const storage = createStorageProxy(new IndexedDbAdapter())
//   await storage.open()
//   await storage.put('tracker/state', state)          // -> IndexedDB
//
//   // Later, when the service exists:
//   await storage.swap(new RestAdapter({ baseUrl }), { migrate: true })
//   await storage.put('tracker/state', state)          // -> the service
//
// Live subscriptions are re-attached to the new adapter and replayed, so an
// open tab keeps updating across the swap.

import {
  type DocKey,
  type DocListener,
  type StorageAdapter,
  type Unsubscribe,
  type Versioned,
  type WriteOptions,
} from './contract'

export interface SwapOptions {
  /** Copy every document from the outgoing adapter into the incoming one. */
  migrate?: boolean
  /** Prefix limiting what `migrate` copies. Defaults to everything. */
  prefix?: DocKey
  /** Close the outgoing adapter once the swap succeeds. Default true. */
  closePrevious?: boolean
  /**
   * What to do when the incoming adapter already holds a document that the
   * outgoing one also has. `skip` protects server data; `overwrite` pushes
   * local data up. Default `skip`.
   */
  onCollision?: 'skip' | 'overwrite'
}

export interface SwapReport {
  from: string
  to: string
  copied: DocKey[]
  skipped: DocKey[]
  durationMs: number
}

export interface StorageStatus {
  driver: string
  multiUser: boolean
  realtime: boolean
  swapping: boolean
  lastError: string | null
}

export interface StorageControl {
  readonly current: StorageAdapter
  readonly status: StorageStatus
  swap(next: StorageAdapter, options?: SwapOptions): Promise<SwapReport>
  onStatusChange(listener: (status: StorageStatus) => void): Unsubscribe
}

export type StorageProxy = StorageAdapter & StorageControl

interface Registration {
  key: DocKey
  listener: DocListener<never>
  detach: Unsubscribe
}

class ProxyCore implements StorageAdapter, StorageControl {
  #adapter: StorageAdapter
  #registrations = new Set<Registration>()
  #statusListeners = new Set<(status: StorageStatus) => void>()
  #swapping = false
  #lastError: string | null = null

  constructor(adapter: StorageAdapter) {
    this.#adapter = adapter
  }

  get current(): StorageAdapter {
    return this.#adapter
  }

  get name(): string {
    return `proxy(${this.#adapter.name})`
  }

  get capabilities() {
    return this.#adapter.capabilities
  }

  get status(): StorageStatus {
    return {
      driver: this.#adapter.name,
      multiUser: this.#adapter.capabilities.multiUser,
      realtime: this.#adapter.capabilities.realtime,
      swapping: this.#swapping,
      lastError: this.#lastError,
    }
  }

  open(): Promise<void> {
    return this.#guard(() => this.#adapter.open())
  }

  close(): Promise<void> {
    this.#registrations.forEach((registration) => registration.detach())
    this.#registrations.clear()
    return this.#adapter.close()
  }

  get<T>(key: DocKey): Promise<Versioned<T> | null> {
    return this.#guard(() => this.#adapter.get<T>(key))
  }

  put<T>(key: DocKey, value: T, options?: WriteOptions): Promise<Versioned<T>> {
    return this.#guard(() => this.#adapter.put<T>(key, value, options))
  }

  remove(key: DocKey, options?: WriteOptions): Promise<void> {
    return this.#guard(() => this.#adapter.remove(key, options))
  }

  list(prefix?: DocKey): Promise<Versioned<unknown>[]> {
    return this.#guard(() => this.#adapter.list(prefix))
  }

  /**
   * Subscriptions are owned by the proxy, not by the adapter, so a swap does
   * not drop them. The caller's unsubscribe stays valid across any number of
   * swaps.
   */
  subscribe<T>(key: DocKey, listener: DocListener<T>): Unsubscribe {
    const registration: Registration = {
      key,
      listener: listener as DocListener<never>,
      detach: this.#adapter.subscribe(key, listener),
    }
    this.#registrations.add(registration)
    return () => {
      registration.detach()
      this.#registrations.delete(registration)
    }
  }

  async swap(next: StorageAdapter, options: SwapOptions = {}): Promise<SwapReport> {
    const { migrate = false, prefix = '', closePrevious = true, onCollision = 'skip' } = options
    const started = Date.now()
    const previous = this.#adapter
    this.#swapping = true
    this.#lastError = null
    this.#emit()

    const copied: DocKey[] = []
    const skipped: DocKey[] = []

    try {
      await next.open()

      if (migrate) {
        const documents = await previous.list(prefix)
        for (const document of documents) {
          const existing = await next.get(document.key)
          if (existing && onCollision === 'skip') {
            skipped.push(document.key)
            continue
          }
          await next.put(document.key, document.value)
          copied.push(document.key)
        }
      }

      // Re-point every live subscription before the old adapter goes away, so
      // there is no window where an open tab is listening to nothing.
      this.#registrations.forEach((registration) => {
        registration.detach()
        registration.detach = next.subscribe(registration.key, registration.listener)
      })

      this.#adapter = next
      if (closePrevious) await previous.close().catch(() => undefined)

      // Replay current values so mounted views repaint against the new store.
      for (const registration of this.#registrations) {
        const document = await next.get(registration.key).catch(() => null)
        try {
          ;(registration.listener as DocListener<unknown>)(document)
        } catch {
          /* listener errors are the listener's problem */
        }
      }

      return {
        from: previous.name,
        to: next.name,
        copied,
        skipped,
        durationMs: Date.now() - started,
      }
    } catch (error) {
      // A failed swap leaves the previous adapter mounted and working.
      this.#lastError = error instanceof Error ? error.message : String(error)
      await next.close().catch(() => undefined)
      throw error
    } finally {
      this.#swapping = false
      this.#emit()
    }
  }

  onStatusChange(listener: (status: StorageStatus) => void): Unsubscribe {
    this.#statusListeners.add(listener)
    listener(this.status)
    return () => {
      this.#statusListeners.delete(listener)
    }
  }

  #emit(): void {
    const status = this.status
    this.#statusListeners.forEach((listener) => {
      try {
        listener(status)
      } catch {
        /* ignore */
      }
    })
  }

  async #guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation()
      if (this.#lastError) {
        this.#lastError = null
        this.#emit()
      }
      return result
    } catch (error) {
      this.#lastError = error instanceof Error ? error.message : String(error)
      this.#emit()
      throw error
    }
  }
}

const CORE_HANDLED = new Set([
  'name',
  'capabilities',
  'current',
  'status',
  'open',
  'close',
  'get',
  'put',
  'remove',
  'list',
  'subscribe',
  'swap',
  'onStatusChange',
])

/**
 * Wraps an adapter in the proxy. Anything the core does not handle is
 * forwarded to the mounted adapter, so adapter-specific extras stay reachable
 * without widening the contract.
 */
export function createStorageProxy(adapter: StorageAdapter): StorageProxy {
  const core = new ProxyCore(adapter)

  return new Proxy(core, {
    get(target, property) {
      if (typeof property === 'string' && !CORE_HANDLED.has(property)) {
        const mounted = target.current as unknown as Record<string, unknown>
        const passthrough = mounted[property]
        if (typeof passthrough === 'function') return passthrough.bind(mounted)
        if (property in mounted) return passthrough
      }
      // `target` is passed as the receiver on purpose: the core uses private
      // (#) fields, and invoking its getters with the proxy as receiver would
      // throw. Bind methods to the core for the same reason.
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
    has(target, property) {
      return Reflect.has(target, property) || property in (target.current as object)
    },
  }) as unknown as StorageProxy
}
