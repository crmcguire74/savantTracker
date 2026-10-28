// 💾 IndexedDB adapter. Zero dependencies: a thin promise wrapper over the
// raw IDB API, because pulling in a library for ~120 lines of glue is a
// dependency you have to keep patching forever.
//
// Layout: one database, one object store keyed by document path. Each record
// is `{ key, value, version, updatedAt }`, which is exactly `Versioned<T>`,
// so nothing is reshaped on the way in or out.
//
// Cross-tab: writes broadcast on a BroadcastChannel, so two tabs in the same
// browser stay in sync. That is as far as "realtime" goes locally, and
// `capabilities.multiUser` says so honestly.

import {
  StorageUnavailableError,
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

const DB_NAME = 'savant-tracker'
const DB_VERSION = 1
const STORE = 'documents'
const CHANNEL = 'savant-tracker-writes'

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const settle = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })

export interface IndexedDbAdapterOptions {
  databaseName?: string
  /** Injectable for tests and for non-browser runtimes. */
  factory?: IDBFactory
}

export class IndexedDbAdapter implements StorageAdapter {
  readonly name = 'indexeddb'
  readonly capabilities: AdapterCapabilities = {
    realtime: true, // same-browser tabs only
    optimisticLocking: true,
    multiUser: false,
  }

  #db: IDBDatabase | null = null
  #databaseName: string
  #factory: IDBFactory | undefined
  #channel: BroadcastChannel | null = null
  #listeners = new Map<DocKey, Set<DocListener<never>>>()

  constructor(options: IndexedDbAdapterOptions = {}) {
    this.#databaseName = options.databaseName ?? DB_NAME
    this.#factory = options.factory ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined)
  }

  async open(): Promise<void> {
    if (this.#db) return
    if (!this.#factory) {
      throw new StorageUnavailableError(
        'IndexedDB is not available in this context (private window, disabled storage, or a non-browser runtime).',
      )
    }
    const request = this.#factory.open(this.#databaseName, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    this.#db = await promisify(request).catch((cause: unknown) => {
      throw new StorageUnavailableError('Could not open the local database.', { cause })
    })

    if (typeof BroadcastChannel !== 'undefined') {
      this.#channel = new BroadcastChannel(CHANNEL)
      this.#channel.onmessage = (event: MessageEvent<{ key: DocKey }>) => {
        const key = event.data?.key
        if (key) void this.#notify(key)
      }
    }
  }

  async close(): Promise<void> {
    this.#channel?.close()
    this.#channel = null
    this.#db?.close()
    this.#db = null
    this.#listeners.clear()
  }

  #require(): IDBDatabase {
    if (!this.#db) throw new StorageUnavailableError('Adapter used before open() resolved.')
    return this.#db
  }

  async get<T>(key: DocKey): Promise<Versioned<T> | null> {
    const tx = this.#require().transaction(STORE, 'readonly')
    const record = await promisify<Versioned<T> | undefined>(tx.objectStore(STORE).get(key))
    return record ?? null
  }

  async put<T>(key: DocKey, value: T, options: WriteOptions = {}): Promise<Versioned<T>> {
    const db = this.#require()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const existing = await promisify<Versioned<T> | undefined>(store.get(key))
    const currentVersion = existing?.version ?? 0

    if (options.ifVersion !== undefined && options.ifVersion !== currentVersion) {
      tx.abort()
      throw new VersionConflictError(key, options.ifVersion, currentVersion)
    }

    const record: Versioned<T> = {
      key,
      value,
      version: currentVersion + 1,
      updatedAt: nowISO(),
    }
    store.put(record)
    await settle(tx)
    this.#broadcast(key)
    await this.#notify(key)
    return record
  }

  async remove(key: DocKey, options: WriteOptions = {}): Promise<void> {
    const db = this.#require()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    if (options.ifVersion !== undefined) {
      const existing = await promisify<Versioned<unknown> | undefined>(store.get(key))
      const currentVersion = existing?.version ?? 0
      if (options.ifVersion !== currentVersion) {
        tx.abort()
        throw new VersionConflictError(key, options.ifVersion, currentVersion)
      }
    }
    store.delete(key)
    await settle(tx)
    this.#broadcast(key)
    await this.#notify(key)
  }

  async list(prefix = ''): Promise<Versioned<unknown>[]> {
    const tx = this.#require().transaction(STORE, 'readonly')
    const all = await promisify<Versioned<unknown>[]>(tx.objectStore(STORE).getAll())
    return all.filter((record) => record.key.startsWith(prefix))
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

  #broadcast(key: DocKey): void {
    try {
      this.#channel?.postMessage({ key })
    } catch {
      // A closed channel during teardown is not worth surfacing.
    }
  }

  async #notify(key: DocKey): Promise<void> {
    const set = this.#listeners.get(key)
    if (!set || set.size === 0) return
    const doc = await this.get(key)
    set.forEach((listener) => {
      try {
        ;(listener as DocListener<unknown>)(doc)
      } catch {
        // A throwing listener must not break the write that triggered it.
      }
    })
  }
}

/** 🧹 Drops the whole local database. Used by "reset local data". */
export async function destroyLocalDatabase(databaseName = DB_NAME): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}
