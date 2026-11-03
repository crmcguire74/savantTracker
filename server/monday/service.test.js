// @vitest-environment node
// 🧪 Capture, replay and the sync service. No network, no token.
import { describe, expect, it } from 'vitest'
import { describeCapture, validateCapture } from './capture.js'
import { MondayError } from './client.js'
import { captureWorkspace, discoverFromCapture, discoverProjects, fetchBoardStamps } from './discover.js'
import { FIELD_COLUMNS, SYNCED_FIELDS } from './mapping.js'
import { approvalCode } from './retire.js'
import { createSyncService, readConfig, SYNC_CONFIG_KEY, SYNC_STATUS_KEY } from './service.js'
import { startScheduler } from './scheduler.js'
import { LOG_KEY, STATE_KEY } from './sync.js'
import { createMemoryStore } from '../memory-store.js'

const NOW = '2026-11-03T14:30:00.000Z'
const COLUMNS = SYNCED_FIELDS.map((field) => ({ id: `c_${field}`, title: FIELD_COLUMNS[field][0], type: 'text' }))
const cells = (values) => Object.entries(values).map(([field, text]) => ({ id: `c_${field}`, type: 'text', text }))
const ROW = (id, name) => ({
  id,
  name,
  updated_at: '2026-10-30T15:00:00Z',
  group: { id: 'g', title: 'Projects' },
  column_values: cells({ rag: 'At risk', progress: '50', businessOwner: 'Pat' }),
})

const fakeMonday = (rows = [ROW(9001, 'Project Owl 2.0'), ROW(9002, 'Rename')], stamp = { at: '2026-10-30T15:00:00Z' }) => ({
  async query(gql, variables) {
    if (gql.includes('updated_at }') && !gql.includes('items_page')) return { boards: variables.ids.map((id) => ({ id, updated_at: stamp.at })) }
    if (gql.includes('me {')) return { me: { name: 'Sync Bot' }, workspaces: variables.ids[0] === '7' ? [{ id: '7', name: 'Strategy' }] : [] }
    if (gql.includes('folders(')) {
      return {
        folders: [
          { id: 1, name: 'Pillar', parent: null, sub_folders: [{ id: 2 }], children: [] },
          { id: 2, name: 'Initiative', parent: { id: 1 }, sub_folders: [], children: [{ id: 101, name: 'Initiative' }, { id: 102, name: 'Tasks' }] },
        ],
      }
    }
    if (gql.includes('columns { id title type }')) {
      return {
        boards: variables.ids.map((id) => ({
          id,
          name: `b${id}`,
          columns: id === '102' ? [{ id: 'x', title: 'Owner', type: 'text' }] : COLUMNS,
        })),
      }
    }
    if (gql.includes('next_items_page')) return { next_items_page: { cursor: null, items: [] } }
    if (gql.includes('items_page')) return { boards: [{ items_page: { cursor: null, items: rows } }] }
    throw new Error('unexpected query')
  },
})

const seed = () =>
  createMemoryStore([
    { key: STATE_KEY, value: { quarter: 'Q', pillars: [], initiatives: [], projects: [] }, version: 1, updatedAt: '' },
    { key: LOG_KEY, value: { entries: [] }, version: 1, updatedAt: '' },
  ])

const LIVE_ENV = { MONDAY_API_TOKEN: 't', MONDAY_WORKSPACE_ID: '7' }
const service = (env, client = fakeMonday(), store = seed()) =>
  createSyncService({ store, env, makeClient: () => client, clock: () => NOW })

describe('capture file', () => {
  it('replays to the same result as a live read', async () => {
    const live = await discoverProjects(fakeMonday(), { workspaceId: '7' })
    const capture = await captureWorkspace(fakeMonday(), { workspaceId: '7', now: NOW })
    expect(discoverFromCapture(JSON.parse(JSON.stringify(capture)))).toEqual(live)
  })

  it('keeps items only for project registers', async () => {
    const capture = await captureWorkspace(fakeMonday(), { workspaceId: '7', now: NOW })
    expect(capture.boards.find((board) => board.id === '101').items).toHaveLength(2)
    expect(capture.boards.find((board) => board.id === '102').items).toHaveLength(0)
    expect(describeCapture(capture)).toEqual({ capturedAt: NOW, workspaceId: '7', folders: 2, boards: 2, items: 2 })
  })

  it('rejects files that are not captures, with a reason', () => {
    expect(() => validateCapture(null)).toThrow(/not a monday capture/)
    expect(() => validateCapture({ format: 'other' })).toThrow(/monday-capture/)
    expect(() => validateCapture({ format: 'monday-capture', version: 9, folders: [], boards: [] })).toThrow(/version/)
    expect(() => validateCapture({ format: 'monday-capture', version: 1, folders: [], boards: [{ id: 1, name: 'b', columns: [] }] })).toThrow(/items/)
  })
})

describe('sync service', () => {
  it('reports test mode with no token and refuses a live pull', async () => {
    const svc = service({})
    expect((await svc.status()).mode).toBe('test')
    await expect(svc.run({})).rejects.toThrow(/not connected/)
    await expect(svc.testConnection()).rejects.toThrow(/not connected/)
  })

  it('runs an uploaded capture without a token and writes on apply', async () => {
    const store = seed()
    const capture = await captureWorkspace(fakeMonday(), { workspaceId: '7', now: NOW })
    const svc = service({}, fakeMonday(), store)
    const dry = await svc.run({ capture })
    expect(dry.written).toBe(false)
    expect(dry.source).toBe('upload')
    const done = await svc.run({ capture, apply: true })
    expect(done.written).toBe(true)
    expect((await store.readDocument(STATE_KEY)).doc.value.projects).toHaveLength(1)
    expect((await svc.status()).last).toMatchObject({ source: 'upload', ok: true, written: true })
  })

  it('live pull gives the same report as the capture of it', async () => {
    const live = await service(LIVE_ENV).run({})
    const capture = await captureWorkspace(fakeMonday(), { workspaceId: '7', now: NOW })
    const replay = await service({}).run({ capture })
    const { source: _a, capture: _b, ...liveRest } = live
    const { source: _c, capture: _d, ...replayRest } = replay
    expect(replayRest).toEqual(liveRest)
  })

  it('does not record dry runs, records applied failures', async () => {
    const store = seed()
    const svc = service({}, fakeMonday(), store)
    await expect(svc.run({ capture: { format: 'nope' }, apply: true })).rejects.toThrow(/monday-capture/)
    expect((await svc.status()).last).toMatchObject({ ok: false })
    const quiet = seed()
    await service({}, fakeMonday(), quiet).run({ capture: await captureWorkspace(fakeMonday(), { workspaceId: '7' }) })
    expect(await quiet.readDocument(SYNC_STATUS_KEY)).toBeNull()
  })

  it('classifies connection failures', async () => {
    const failing = (error) => ({ query: async () => { throw error } })
    expect(await service(LIVE_ENV).testConnection()).toEqual({ ok: true, account: 'Sync Bot', workspace: 'Strategy' })
    expect(await service({ ...LIVE_ENV, MONDAY_WORKSPACE_ID: '8' }).testConnection()).toMatchObject({ ok: false, kind: 'workspace' })
    expect(await service(LIVE_ENV, failing(new MondayError('x', { status: 401 }))).testConnection()).toMatchObject({ kind: 'auth' })
    expect(await service(LIVE_ENV, failing(new MondayError('Cannot reach monday.com: boom'))).testConnection()).toMatchObject({ kind: 'network' })
  })

  it('reports reachability in status and caches the probe for a minute', async () => {
    let calls = 0
    const counting = { query: async (...args) => (calls += 1, fakeMonday().query(...args)) }
    const svc = service(LIVE_ENV, counting)
    expect((await svc.status()).reachable).toMatchObject({ ok: true })
    await svc.status()
    expect(calls).toBe(1)
    const down = service(LIVE_ENV, { query: async () => { throw new MondayError('Cannot reach monday.com: x') } })
    expect((await down.status()).reachable).toMatchObject({ ok: false, kind: 'network' })
    expect((await service({}).status()).reachable).toBeNull()
  })

  it('treats an unresolved Key Vault reference as not live and says why', async () => {
    const svc = service({ MONDAY_API_TOKEN: '@Microsoft.KeyVault(VaultName=kv;SecretName=t)', MONDAY_WORKSPACE_ID: '7' })
    expect(svc.live).toBe(false)
    expect((await svc.status()).problem).toMatch(/Key Vault/)
    expect(await svc.testConnection()).toMatchObject({ ok: false, kind: 'keyvault' })
  })

  it('reads the environment', () => {
    expect(readConfig({}).ignoreTitles).toEqual(['Rename', 'test'])
    expect(readConfig({ MONDAY_IGNORE_TITLES: 'a, b' }).ignoreTitles).toEqual(['a', 'b'])
    expect(readConfig({ MONDAY_SYNC_INTERVAL_MINUTES: '2' }).intervalMinutes).toBe(0)
    expect(readConfig({ MONDAY_SYNC_INTERVAL_MINUTES: '60' }).intervalMinutes).toBe(60)
    expect(() => readConfig({ MONDAY_PILLAR_MAP: '{bad' })).toThrow()
  })
})

describe('approval code', () => {
  it('is 12 hex characters and depends on the ids', () => {
    const code = approvalCode([{ id: 'a' }], [], [])
    expect(code).toMatch(/^[0-9a-f]{12}$/)
    expect(approvalCode([{ id: 'a' }], [], [])).toBe(code)
    expect(approvalCode([{ id: 'b' }], [], [])).not.toBe(code)
    expect(approvalCode([{ id: 'b' }, { id: 'a' }], [], [])).toBe(approvalCode([{ id: 'a' }, { id: 'b' }], [], []))
  })
})

describe('schedule setting', () => {
  it('uses the env default until an admin sets one, then the app setting wins', async () => {
    const store = seed()
    const svc = service({ ...LIVE_ENV, MONDAY_SYNC_INTERVAL_MINUTES: '60' }, fakeMonday(), store)
    expect(await svc.currentInterval()).toBe(60)
    expect(await svc.status()).toMatchObject({ intervalMinutes: 60, intervalSource: 'env' })
    await svc.setSchedule(15)
    expect(await svc.currentInterval()).toBe(15)
    expect(await svc.status()).toMatchObject({ intervalMinutes: 15, intervalSource: 'app' })
    await svc.setSchedule(0)
    expect(await svc.currentInterval()).toBe(0)
    expect((await store.readDocument(SYNC_CONFIG_KEY)).doc.value.intervalMinutes).toBe(0)
  })

  it('accepts 0 or 5 to 1440 whole minutes only', async () => {
    const svc = service(LIVE_ENV)
    for (const bad of [1, 4, 1441, 7.5, -5, '30', null, undefined, NaN]) {
      await expect(svc.setSchedule(bad)).rejects.toThrow(/Interval must be/)
    }
    for (const good of [0, 5, 1440]) await svc.setSchedule(good)
  })
})

describe('skip when monday has not changed', () => {
  const clockable = (stamp, rows) => {
    const time = { now: NOW }
    const store = seed()
    const queries = { items: 0 }
    const monday = fakeMonday(rows, stamp)
    const counting = { query: async (gql, variables) => { if (gql.includes('items_page')) queries.items += 1; return monday.query(gql, variables) } }
    const svc = createSyncService({ store, env: LIVE_ENV, makeClient: () => counting, clock: () => time.now })
    return { svc, store, time, queries }
  }
  const minutesLater = (iso, minutes) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()
  const scheduled = { apply: true, trigger: 'schedule', skipIfUnchanged: true }

  it('fingerprint changes with a board stamp or a folder rename', async () => {
    const stamp = { at: 'a' }
    const first = await fetchBoardStamps(fakeMonday(undefined, stamp), '7')
    expect(await fetchBoardStamps(fakeMonday(undefined, stamp), '7')).toBe(first)
    stamp.at = 'b'
    expect(await fetchBoardStamps(fakeMonday(undefined, stamp), '7')).not.toBe(first)
  })

  it('reads items once, then skips while nothing changes and moves only the check time', async () => {
    const stamp = { at: 'a' }
    const { svc, time, queries } = clockable(stamp)
    const first = await svc.run(scheduled)
    expect(first.unchanged).toBeUndefined()
    expect(queries.items).toBe(1)
    time.now = minutesLater(NOW, 10)
    const second = await svc.run(scheduled)
    expect(second).toMatchObject({ unchanged: true, written: false })
    expect(queries.items).toBe(1)
    const last = (await svc.status()).last
    expect(last).toMatchObject({ ok: true, checkedUnchanged: true, at: time.now, fullAt: NOW })
  })

  it('pulls again when a board changed', async () => {
    const stamp = { at: 'a' }
    const { svc, time, queries } = clockable(stamp)
    await svc.run(scheduled)
    stamp.at = 'b'
    time.now = minutesLater(NOW, 10)
    await svc.run(scheduled)
    expect(queries.items).toBe(2)
    expect((await svc.status()).last).toMatchObject({ checkedUnchanged: false, fullAt: time.now })
  })

  it('does a full pull after an hour even with no change, and after a failed run', async () => {
    const stamp = { at: 'a' }
    const { svc, time, queries } = clockable(stamp)
    await svc.run(scheduled)
    time.now = minutesLater(NOW, 61)
    await svc.run(scheduled)
    expect(queries.items).toBe(2)
    await svc.run({ capture: { format: 'nope' }, apply: true }).catch(() => {})
    time.now = minutesLater(NOW, 62)
    await svc.run(scheduled)
    expect(queries.items).toBe(3)
  })

  it('never skips a manual pull', async () => {
    const { svc, queries } = clockable({ at: 'a' })
    await svc.run({ apply: true, trigger: 'manual' })
    await svc.run({ apply: true, trigger: 'manual' })
    expect(queries.items).toBe(2)
  })

  it('still pulls when the fingerprint cannot be read', async () => {
    const monday = fakeMonday()
    const flaky = { query: async (gql, variables) => { if (gql.includes('updated_at }') && !gql.includes('items_page')) throw new Error('nope'); return monday.query(gql, variables) } }
    const svc = createSyncService({ store: seed(), env: LIVE_ENV, makeClient: () => flaky, clock: () => NOW })
    expect((await svc.run(scheduled)).written).toBe(true)
  })
})

describe('scheduler', () => {
  const setup = (interval, lastAt) => {
    const calls = []
    const timers = []
    const sync = {
      live: true,
      currentInterval: async () => interval,
      lastRun: async () => (lastAt ? { at: lastAt } : null),
      run: async (request) => (calls.push(request), { unchanged: false, summary: {}, written: true }),
    }
    const clock = { ms: Date.parse(NOW) }
    const log = { log() {}, error() {} }
    const handle = startScheduler({ sync, log, now: () => clock.ms, setIntervalImpl: (fn, ms) => (timers.push(ms), { unref() {} }), clearIntervalImpl() {} })
    return { handle, calls, timers, clock }
  }

  it('does nothing when monday is not live', () => {
    expect(startScheduler({ sync: { live: false }, log: console })).toBeNull()
  })

  it('ticks every minute and does nothing while the interval is off', async () => {
    const { handle, calls, timers } = setup(0, null)
    expect(timers).toEqual([60_000])
    await handle.tick()
    expect(calls).toHaveLength(0)
  })

  it('pulls when due, with skip on and retire off, and waits otherwise', async () => {
    const recent = new Date(Date.parse(NOW) - 10 * 60_000).toISOString()
    const { handle, calls, clock } = setup(30, recent)
    await handle.tick()
    expect(calls).toHaveLength(0)
    clock.ms += 21 * 60_000
    await handle.tick()
    expect(calls).toEqual([{ apply: true, retire: false, trigger: 'schedule', skipIfUnchanged: true }])
    expect((setup(30, null)).calls).toHaveLength(0)
    const first = setup(30, null)
    await first.handle.tick()
    expect(first.calls).toHaveLength(1)
  })
})
