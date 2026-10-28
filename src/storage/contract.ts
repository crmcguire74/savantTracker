// 📜 The storage contract.
//
// Everything above this file (repository, hooks, UI) talks documents. Nothing
// above this file knows whether a document lives in IndexedDB, in Postgres
// behind a REST call, or in memory during a test. Swapping the backend means
// writing one more implementation of `StorageAdapter` and handing it to the
// proxy. No component changes.
//
// The shape is deliberately document-oriented rather than relational: the
// tracker reads and writes three documents (state, log, settings), and a
// document store is the smallest contract that every candidate backend
// (IndexedDB, REST/JSON, Cosmos, Firestore, Supabase) can satisfy honestly.

/** A slash-separated document path, e.g. `tracker/state`. */
export type DocKey = string

export interface Versioned<T> {
  key: DocKey
  value: T
  /** Monotonic per-document counter. Starts at 1 on first write. */
  version: number
  updatedAt: string
}

export interface WriteOptions {
  /**
   * Optimistic concurrency. When supplied and the stored version differs, the
   * write is rejected with `VersionConflictError` and nothing is persisted.
   * This is what keeps the "someone else just edited this field" flow working
   * once a shared backend is plugged in.
   */
  ifVersion?: number
}

export type Unsubscribe = () => void

export type DocListener<T> = (doc: Versioned<T> | null) => void

export interface AdapterCapabilities {
  /** True when `subscribe` delivers changes made by OTHER clients. */
  realtime: boolean
  /** True when `ifVersion` is enforced by the store rather than best-effort. */
  optimisticLocking: boolean
  /** True when more than one person can write to the same document. */
  multiUser: boolean
}

export interface StorageAdapter {
  readonly name: string
  readonly capabilities: AdapterCapabilities

  open(): Promise<void>
  close(): Promise<void>

  get<T>(key: DocKey): Promise<Versioned<T> | null>
  put<T>(key: DocKey, value: T, options?: WriteOptions): Promise<Versioned<T>>
  remove(key: DocKey, options?: WriteOptions): Promise<void>

  /** Every document whose key starts with `prefix`. Used by export and by migration. */
  list(prefix?: DocKey): Promise<Versioned<unknown>[]>

  /**
   * Watch one document. Local adapters fire on local writes only; a networked
   * adapter fires on remote writes too. Callers must treat both the same.
   */
  subscribe<T>(key: DocKey, listener: DocListener<T>): Unsubscribe
}

export class VersionConflictError extends Error {
  readonly key: DocKey
  readonly expected: number
  readonly actual: number

  constructor(key: DocKey, expected: number, actual: number) {
    super(`Version conflict on "${key}": expected ${expected}, store holds ${actual}`)
    this.name = 'VersionConflictError'
    this.key = key
    this.expected = expected
    this.actual = actual
  }
}

export class StorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'StorageUnavailableError'
  }
}

export const isVersionConflict = (error: unknown): error is VersionConflictError =>
  error instanceof VersionConflictError

/** 🕒 Single clock for the whole storage layer, so tests can freeze it. */
export const nowISO = (): string => new Date().toISOString()
