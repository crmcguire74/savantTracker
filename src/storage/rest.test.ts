import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RestAdapter } from './rest'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(readonly url: string) {
    FakeEventSource.instances.push(this)
  }
  close() {
    this.closed = true
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('RestAdapter subscriptions', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    fetchImpl = vi.fn(async (url: string) => {
      const key = decodeURIComponent(url.split('/documents/')[1] ?? '')
      return new Response(JSON.stringify({ key, value: `value of ${key}`, version: 2, updatedAt: '' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shares one event stream across every subscribed key', async () => {
    const adapter = new RestAdapter({ baseUrl: '/api', fetchImpl: fetchImpl as unknown as typeof fetch })
    adapter.subscribe('tracker/state', () => undefined)
    adapter.subscribe('tracker/log', () => undefined)
    adapter.subscribe('tracker/settings', () => undefined)
    await tick()

    const open = FakeEventSource.instances.filter((source) => !source.closed)
    expect(open).toHaveLength(1)
    expect(decodeURIComponent(open[0].url)).toBe('/api/stream?keys=tracker/log,tracker/settings,tracker/state')
  })

  it('refreshes only the key the server says changed', async () => {
    const adapter = new RestAdapter({ baseUrl: '/api', fetchImpl: fetchImpl as unknown as typeof fetch })
    const state = vi.fn()
    const log = vi.fn()
    adapter.subscribe('tracker/state', state)
    adapter.subscribe('tracker/log', log)
    await tick()

    FakeEventSource.instances.at(-1)!.emit({ key: 'tracker/log', version: 3 })
    await vi.waitFor(() => expect(log).toHaveBeenCalledTimes(1))
    expect(log.mock.calls[0][0]).toMatchObject({ value: 'value of tracker/log' })
    expect(state).not.toHaveBeenCalled()
  })

  it('narrows the stream when a key is dropped and closes it when none remain', async () => {
    const adapter = new RestAdapter({ baseUrl: '/api', fetchImpl: fetchImpl as unknown as typeof fetch })
    const offState = adapter.subscribe('tracker/state', () => undefined)
    const offLog = adapter.subscribe('tracker/log', () => undefined)
    await tick()
    offState()
    await tick()
    const open = FakeEventSource.instances.filter((source) => !source.closed)
    expect(open).toHaveLength(1)
    expect(decodeURIComponent(open[0].url)).toBe('/api/stream?keys=tracker/log')
    offLog()
    await tick()
    expect(FakeEventSource.instances.every((source) => source.closed)).toBe(true)
  })

  it('falls back to polling every key when the stream fails', async () => {
    vi.useFakeTimers()
    try {
      const adapter = new RestAdapter({ baseUrl: '/api', pollMs: 1000, fetchImpl: fetchImpl as unknown as typeof fetch })
      const state = vi.fn()
      adapter.subscribe('tracker/state', state)
      await vi.advanceTimersByTimeAsync(0)
      FakeEventSource.instances.at(-1)!.onerror?.()
      await vi.advanceTimersByTimeAsync(1000)
      expect(state).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
