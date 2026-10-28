// 🧪 In-memory adapter. Used by tests, by SSR, and as the fallback when
// IndexedDB is unavailable (private windows, blocked site data) so the app
// still runs instead of showing a dead screen.

import {
  VersionConflictError,
  nowISO,
  type AdapterCapabilities,
  type DocKey,
  type DocListener,
  type StorageAdapter,
  type Unsubscribe,
  type Versioned,
  type WriteOptions,
} from './contract'

export class MemoryAdapter implements StorageAdapter {
  readonly name = 'memory'
  readonly capabilities: AdapterCapabilities = {
    realtime: true,
    optimisticLocking: true,
    multiUser: false,
  }

  #docs = new Map<DocKey, Versioned<unknown>>()
  #listeners = new Map<DocKey, Set<DocListener<never>>>()

  constructor(seed: Versioned<unknown>[] = []) {
    seed.forEach((doc) => this.#docs.set(doc.key, doc))
  }

  async open(): Promise<void> {}

  async close(): Promise<void> {
    this.#listeners.clear()
  }

  async get<T>(key: DocKey): Promise<Versioned<T> | null> {
    const doc = this.#docs.get(key)
    return doc ? (structuredClone(doc) as Versioned<T>) : null
  }

  async put<T>(key: DocKey, value: T, options: WriteOptions = {}): Promise<Versioned<T>> {
    const currentVersion = this.#docs.get(key)?.version ?? 0
    if (options.ifVersion !== undefined && options.ifVersion !== currentVersion) {
      throw new VersionConflictError(key, options.ifVersion, currentVersion)
    }
    const record: Versioned<T> = {
      key,
      value: structuredClone(value),
      version: currentVersion + 1,
      updatedAt: nowISO(),
    }
    this.#docs.set(key, record as Versioned<unknown>)
    this.#notify(key)
    return structuredClone(record)
  }

  async remove(key: DocKey, options: WriteOptions = {}): Promise<void> {
    const currentVersion = this.#docs.get(key)?.version ?? 0
    if (options.ifVersion !== undefined && options.ifVersion !== currentVersion) {
      throw new VersionConflictError(key, options.ifVersion, currentVersion)
    }
    this.#docs.delete(key)
    this.#notify(key)
  }

  async list(prefix = ''): Promise<Versioned<unknown>[]> {
    return [...this.#docs.values()]
      .filter((doc) => doc.key.startsWith(prefix))
      .map((doc) => structuredClone(doc))
  }

  subscribe<T>(key: DocKey, listener: DocListener<T>): Unsubscribe {
    const set = this.#listeners.get(key) ?? new Set()
    set.add(listener as DocListener<never>)
    this.#listeners.set(key, set)
    return () => {
      set.delete(listener as DocListener<never>)
      if (set.size === 0) this.#listeners.delete(key)
    }
  }

  #notify(key: DocKey): void {
    const set = this.#listeners.get(key)
    if (!set) return
    const doc = this.#docs.get(key) ?? null
    set.forEach((listener) => {
      try {
        ;(listener as DocListener<unknown>)(doc ? structuredClone(doc) : null)
      } catch {
        /* listener errors are the listener's problem */
      }
    })
  }
}
