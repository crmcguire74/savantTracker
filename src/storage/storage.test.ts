import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbAdapter, destroyLocalDatabase } from './indexeddb'
import { MemoryAdapter } from './memory'
import { createStorageProxy } from './proxy'
import { VersionConflictError, type StorageAdapter } from './contract'

const DB = 'savant-tracker-vitest'

describe('IndexedDbAdapter', () => {
  beforeEach(async () => {
    await destroyLocalDatabase(DB)
  })

  it('round-trips a document and starts versions at 1', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: DB })
    await adapter.open()

    const written = await adapter.put('tracker/state', { quarter: 'Q1' })
    expect(written.version).toBe(1)

    const read = await adapter.get<{ quarter: string }>('tracker/state')
    expect(read?.value.quarter).toBe('Q1')
    await adapter.close()
  })

  it('keeps data across a close and reopen', async () => {
    const first = new IndexedDbAdapter({ databaseName: DB })
    await first.open()
    await first.put('tracker/persist', { marker: 'still-here' })
    await first.close()

    const second = new IndexedDbAdapter({ databaseName: DB })
    await second.open()
    const read = await second.get<{ marker: string }>('tracker/persist')
    expect(read?.value.marker).toBe('still-here')
    await second.close()
  })

  it('rejects a write pinned to a stale version', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: DB })
    await adapter.open()

    const first = await adapter.put('tracker/lock', { n: 1 })
    await adapter.put('tracker/lock', { n: 2 }, { ifVersion: first.version })

    await expect(adapter.put('tracker/lock', { n: 3 }, { ifVersion: first.version })).rejects.toBeInstanceOf(
      VersionConflictError,
    )

    const current = await adapter.get<{ n: number }>('tracker/lock')
    expect(current?.value.n).toBe(2)
    await adapter.close()
  })

  it('notifies subscribers until they unsubscribe', async () => {
    const adapter = new IndexedDbAdapter({ databaseName: DB })
    await adapter.open()

    const seen: unknown[] = []
    const off = adapter.subscribe<{ tick: number }>('tracker/watch', (doc) => seen.push(doc?.value.tick))
    await adapter.put('tracker/watch', { tick: 1 })
    await adapter.put('tracker/watch', { tick: 2 })
    off()
    await adapter.put('tracker/watch', { tick: 3 })

    expect(seen).toEqual([1, 2])
    await adapter.close()
  })
})

describe('storage proxy', () => {
  it('moves the data when the backend is swapped', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    await proxy.put('tracker/payload', { value: 'abc' })

    const report = await proxy.swap(new MemoryAdapter(), { migrate: true, prefix: 'tracker/' })
    expect(report.copied).toContain('tracker/payload')

    const after = await proxy.get<{ value: string }>('tracker/payload')
    expect(after?.value.value).toBe('abc')
    await proxy.close()
  })

  it('keeps live subscriptions attached across a swap', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    await proxy.put('tracker/live', { tick: 0 })

    const seen: unknown[] = []
    proxy.subscribe<{ tick: number }>('tracker/live', (doc) => seen.push(doc?.value.tick))

    await proxy.put('tracker/live', { tick: 1 })
    await proxy.swap(new MemoryAdapter(), { migrate: true })
    await proxy.put('tracker/live', { tick: 2 })

    expect(seen).toContain(1)
    expect(seen).toContain(2)
    await proxy.close()
  })

  it('leaves the previous backend mounted when a swap fails', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    await proxy.put('tracker/keep', { safe: true })

    const broken: StorageAdapter = {
      name: 'broken',
      capabilities: { realtime: false, optimisticLocking: false, multiUser: false },
      open: async () => {
        throw new Error('service unreachable')
      },
      close: async () => {},
      get: async () => null,
      put: async () => {
        throw new Error('nope')
      },
      remove: async () => {},
      list: async () => [],
      subscribe: () => () => {},
    }

    await expect(proxy.swap(broken, { migrate: true })).rejects.toThrow('service unreachable')
    expect(proxy.status.driver).toBe('memory')

    const kept = await proxy.get<{ safe: boolean }>('tracker/keep')
    expect(kept?.value.safe).toBe(true)
    await proxy.close()
  })

  it('reports capabilities of whichever adapter is mounted', async () => {
    const proxy = createStorageProxy(new MemoryAdapter())
    await proxy.open()
    expect(proxy.status.multiUser).toBe(false)
    await proxy.close()
  })
})
