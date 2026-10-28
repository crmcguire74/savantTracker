// 🌐 REST adapter. This is the file you finish when the tracker moves off the
// browser and onto a service. It is fully written against the contract; what
// it needs from you is a server that answers five routes and an auth hook.
//
//   GET    {baseUrl}/documents?prefix=tracker        -> Versioned<unknown>[]
//   GET    {baseUrl}/documents/{encodedKey}          -> Versioned<T> | 404
//   PUT    {baseUrl}/documents/{encodedKey}          -> Versioned<T>
//          body { value }, header `If-Match: "<version>"` when locking
//          409 on version mismatch, with { version } in the body
//   DELETE {baseUrl}/documents/{encodedKey}          -> 204
//   GET    {baseUrl}/stream?keys=a,b                 -> text/event-stream (optional)
//
// Nothing else in the app changes. Point `VITE_STORAGE_DRIVER=rest` at it, or
// call `storage.swap(new RestAdapter({...}), { migrate: true })` at runtime to
// push everything currently in IndexedDB up to the service in one move.

import {
  StorageUnavailableError,
  VersionConflictError,
  type AdapterCapabilities,
  type DocKey,
  type DocListener,
  type StorageAdapter,
  type Unsubscribe,
  type Versioned,
  type WriteOptions,
} from './contract'

export interface RestAdapterOptions {
  baseUrl: string
  /** Called before every request. Return headers, e.g. a bearer token. */
  authHeaders?: () => Promise<Record<string, string>> | Record<string, string>
  /** Set false when the service has no SSE endpoint; polling is used instead. */
  serverSentEvents?: boolean
  /** Poll interval when SSE is off. Set 0 to disable polling entirely. */
  pollMs?: number
  fetchImpl?: typeof fetch
}

export class RestAdapter implements StorageAdapter {
  readonly name = 'rest'
  readonly capabilities: AdapterCapabilities = {
    realtime: true,
    optimisticLocking: true,
    multiUser: true,
  }

  #options: Required<Pick<RestAdapterOptions, 'baseUrl' | 'serverSentEvents' | 'pollMs'>> &
    RestAdapterOptions
  #fetch: typeof fetch
  #streams = new Map<DocKey, { timer?: number; listeners: Set<DocListener<never>> }>()
  /**
   * One EventSource for every subscribed key, never one per key. Browsers
   * allow six HTTP/1.1 connections per host across all tabs, and a held-open
   * stream occupies one for as long as the page lives: three per tab starved
   * everything else, including the service worker's update check.
   */
  #shared: { source?: EventSource; keys: string } = { keys: '' }
  #reopenScheduled = false
  #sseFailed = false

  constructor(options: RestAdapterOptions) {
    this.#options = {
      serverSentEvents: true,
      pollMs: 15000,
      ...options,
      baseUrl: options.baseUrl.replace(/\/$/, ''),
    }
    const impl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined)
    if (!impl) throw new StorageUnavailableError('No fetch implementation available.')
    this.#fetch = impl
  }

  async open(): Promise<void> {
    // A cheap reachability probe keeps a misconfigured base URL from failing
    // later, mid-edit, where it looks like data loss to the user.
    const response = await this.#request('GET', '/documents?prefix=', undefined, { tolerate404: true })
    if (!response.ok && response.status !== 404) {
      throw new StorageUnavailableError(`Storage service returned ${response.status} on open().`)
    }
  }

  async close(): Promise<void> {
    this.#shared.source?.close()
    this.#shared = { keys: '' }
    this.#streams.forEach((stream) => {
      if (stream.timer) clearInterval(stream.timer)
    })
    this.#streams.clear()
  }

  async get<T>(key: DocKey): Promise<Versioned<T> | null> {
    const response = await this.#request('GET', `/documents/${encodeURIComponent(key)}`, undefined, {
      tolerate404: true,
    })
    if (response.status === 404) return null
    return (await response.json()) as Versioned<T>
  }

  async put<T>(key: DocKey, value: T, options: WriteOptions = {}): Promise<Versioned<T>> {
    const headers: Record<string, string> = {}
    if (options.ifVersion !== undefined) headers['If-Match'] = `"${options.ifVersion}"`
    const response = await this.#request(
      'PUT',
      `/documents/${encodeURIComponent(key)}`,
      { value },
      { headers, tolerate409: true },
    )
    if (response.status === 409) {
      const body = (await response.json().catch(() => ({}))) as { version?: number }
      throw new VersionConflictError(key, options.ifVersion ?? -1, body.version ?? -1)
    }
    return (await response.json()) as Versioned<T>
  }

  async remove(key: DocKey, options: WriteOptions = {}): Promise<void> {
    const headers: Record<string, string> = {}
    if (options.ifVersion !== undefined) headers['If-Match'] = `"${options.ifVersion}"`
    await this.#request('DELETE', `/documents/${encodeURIComponent(key)}`, undefined, { headers })
  }

  async list(prefix = ''): Promise<Versioned<unknown>[]> {
    const response = await this.#request('GET', `/documents?prefix=${encodeURIComponent(prefix)}`)
    return (await response.json()) as Versioned<unknown>[]
  }

  subscribe<T>(key: DocKey, listener: DocListener<T>): Unsubscribe {
    let stream = this.#streams.get(key)
    if (!stream) {
      stream = { listeners: new Set() }
      this.#streams.set(key, stream)
      if (this.#useSse()) this.#scheduleReopen()
      else this.#startPolling(key)
    }
    stream.listeners.add(listener as DocListener<never>)
    return () => {
      stream.listeners.delete(listener as DocListener<never>)
      if (stream.listeners.size === 0) {
        if (stream.timer) clearInterval(stream.timer)
        this.#streams.delete(key)
        if (this.#useSse()) this.#scheduleReopen()
      }
    }
  }

  #useSse(): boolean {
    return this.#options.serverSentEvents && !this.#sseFailed && typeof EventSource !== 'undefined'
  }

  async #push(key: DocKey): Promise<void> {
    const stream = this.#streams.get(key)
    if (!stream) return
    const doc = await this.get(key).catch(() => null)
    stream.listeners.forEach((listener) => (listener as DocListener<unknown>)(doc))
  }

  #startPolling(key: DocKey): void {
    const stream = this.#streams.get(key)
    if (!stream || stream.timer || this.#options.pollMs <= 0) return
    stream.timer = setInterval(() => void this.#push(key), this.#options.pollMs) as unknown as number
  }

  /** Subscriptions arrive in a burst at startup; open one stream after it. */
  #scheduleReopen(): void {
    if (this.#reopenScheduled) return
    this.#reopenScheduled = true
    setTimeout(() => {
      this.#reopenScheduled = false
      this.#reopenShared()
    }, 0)
  }

  #reopenShared(): void {
    const keys = [...this.#streams.keys()].sort().join(',')
    if (keys === this.#shared.keys && this.#shared.source) return
    this.#shared.source?.close()
    this.#shared = { keys }
    if (!keys || !this.#useSse()) return

    const source = new EventSource(`${this.#options.baseUrl}/stream?keys=${encodeURIComponent(keys)}`)
    source.onmessage = (event: MessageEvent) => {
      // The server names the changed key; anything unexpected refreshes all.
      let changed: DocKey | undefined
      try {
        changed = (JSON.parse(String(event.data)) as { key?: DocKey }).key
      } catch {
        changed = undefined
      }
      const targets = changed && this.#streams.has(changed) ? [changed] : [...this.#streams.keys()]
      targets.forEach((key) => void this.#push(key))
    }
    source.onerror = () => {
      // Fall back to polling rather than going silently stale.
      source.close()
      if (this.#shared.source === source) this.#shared = { keys: '' }
      this.#sseFailed = true
      this.#streams.forEach((_stream, key) => this.#startPolling(key))
    }
    this.#shared.source = source
  }

  async #request(
    method: string,
    path: string,
    body?: unknown,
    options: { headers?: Record<string, string>; tolerate404?: boolean; tolerate409?: boolean } = {},
  ): Promise<Response> {
    const auth = (await this.#options.authHeaders?.()) ?? {}
    const response = await this.#fetch(`${this.#options.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...auth,
        ...options.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const tolerated =
      (options.tolerate404 && response.status === 404) || (options.tolerate409 && response.status === 409)
    if (!response.ok && !tolerated) {
      throw new StorageUnavailableError(`${method} ${path} failed with ${response.status}.`)
    }
    // A signed-out session gets an HTML login page with status 200. Reload so
    // Azure can run the sign-in redirect instead of parsing HTML as JSON.
    const contentType = response.headers.get('content-type') ?? ''
    if (response.status !== 204 && contentType.includes('text/html')) {
      if (typeof location !== 'undefined') location.reload()
      throw new StorageUnavailableError('Your sign-in expired. Reloading.')
    }
    return response
  }
}
