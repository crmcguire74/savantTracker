// @vitest-environment node
// 🧪 The browser side of the monday sync: replay in the browser, or call the server.
import { describe, expect, it } from 'vitest'
import { FIELD_COLUMNS, SYNCED_FIELDS } from '../../server/monday/mapping'
import { createMondaySync, type MondaySyncDeps } from './mondaySync'
import type { AppFile } from './appfile'
import type { TrackerState } from '../types'

const NOW = '2026-11-03T14:30:00.000Z'
const COLUMNS = SYNCED_FIELDS.map((field) => ({ id: `c_${field}`, title: FIELD_COLUMNS[field][0], type: 'text' }))
const CAPTURE = {
  format: 'monday-capture' as const,
  version: 1 as const,
  capturedAt: NOW,
  workspaceId: '7',
  folders: [
    { id: '1', name: 'Pillar One', parent: null, children: [] },
    { id: '2', name: 'Initiative One', parent: { id: '1' }, children: [{ id: '101', name: 'Initiative One' }] },
  ],
  boards: [
    {
      id: '101',
      name: 'Initiative One',
      columns: COLUMNS,
      items: [
        {
          id: '9001',
          name: 'Project Owl',
          updated_at: '2026-10-30T15:00:00Z',
          group: { id: 'g', title: 'Projects' },
          column_values: [{ id: 'c_rag', type: 'text', text: 'At risk' }],
        },
      ],
    },
  ],
}

const emptyFile = (state: Partial<TrackerState> = {}): AppFile => ({
  app: 'savant-strategic-initiatives-tracker',
  formatVersion: 1,
  exportedAt: '2026-11-01T00:00:00.000Z',
  source: 'app-export',
  settings: { staleThresholdDays: 30 },
  state: { quarter: 'Q', pillars: [], initiatives: [], projects: [], ...state },
  log: [],
})

const memoryStorage = () => {
  const data = new Map<string, string>()
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) }
}

function harness(file = emptyFile(), over: Partial<MondaySyncDeps> = {}) {
  let current = file
  const downloads: string[] = []
  const deps: MondaySyncDeps = {
    repository: {
      exportAll: async () => structuredClone(current),
      replaceAll: async (next: AppFile) => {
        current = next
      },
    },
    driver: () => 'memory',
    isAdmin: () => true,
    download: (_file, tag) => {
      downloads.push(tag)
      return `backup-${tag}.json`
    },
    clock: () => NOW,
    storage: memoryStorage(),
    ...over,
  }
  return { api: createMondaySync(deps), read: () => current, downloads }
}

describe('browser sync', () => {
  it('previews without writing, then applies', async () => {
    const { api, read } = harness()
    const dry = await api.run({ capture: CAPTURE })
    expect(dry).toMatchObject({ mode: 'dry-run', written: false, source: 'upload' })
    expect(read().state.projects).toHaveLength(0)

    const done = await api.run({ capture: CAPTURE, apply: true })
    expect(done.written).toBe(true)
    expect(read().state.projects).toHaveLength(1)
    expect(read().source).toBe('monday-capture-upload')
    expect(read().log.length).toBeGreaterThan(0)
    expect((await api.status()).last).toMatchObject({ ok: true, written: true })
  })

  it('is idempotent', async () => {
    const { api } = harness()
    await api.run({ capture: CAPTURE, apply: true })
    const again = await api.run({ capture: CAPTURE, apply: true })
    expect(again.written).toBe(false)
  })

  it('needs the approval code to retire, and downloads a backup first', async () => {
    const stray = emptyFile({ pillars: [{ id: 'old', title: 'Old pillar', owner: '' }] })
    const { api, read, downloads } = harness(stray)
    const dry = await api.run({ capture: CAPTURE, retire: true })
    expect(dry.retire?.counts.pillars).toBe(1)

    const refused = await api.run({ capture: CAPTURE, retire: true, apply: true }).catch((error) => error)
    expect(refused.name).toBe('SyncRequestError')
    expect(refused).toMatchObject({ status: 409, approval: dry.retire?.approval })
    expect(downloads).toHaveLength(0)

    const done = await api.run({ capture: CAPTURE, retire: true, apply: true, approval: dry.retire?.approval })
    expect(downloads).toEqual(['backup-before-monday-retire'])
    expect(done.retire?.backupKey).toBe('backup-backup-before-monday-retire.json')
    expect(read().state.pillars.some((pillar) => pillar.id === 'old')).toBe(false)
  })

  it('refuses non-admins, missing captures and bad captures', async () => {
    expect(await harness(emptyFile(), { isAdmin: () => false }).api.run({ capture: CAPTURE }).catch((e) => e.status)).toBe(403)
    expect(await harness().api.run({}).catch((e) => e.message)).toMatch(/capture file/)
    expect(await harness().api.run({ capture: { format: 'x' } as never }).catch((e) => e.message)).toMatch(/monday-capture/)
  })

  it('has no live connection, backups or restore', async () => {
    const { api } = harness()
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'browser' })
    expect(await api.backups()).toEqual([])
    expect(await api.restore('tracker.backup.x', true).catch((e) => e.message)).toMatch(/Import data/)
    expect((await api.status()).mode).toBe('test')
  })
})

describe('server sync', () => {
  const server = (answer: (url: string, init: RequestInit) => { status?: number; body: unknown }) => {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined })
      const { status = 200, body } = answer(url, init)
      return { ok: status < 400, status, json: async () => body } as Response
    }) as unknown as typeof fetch
    return { calls, ...harness(emptyFile(), { driver: () => 'rest', fetchImpl, headers: () => ({ 'x-tracker-dev-role': 'admin' }) }) }
  }

  it('pulls from monday when no capture is given, uploads when one is', async () => {
    const { api, calls } = server(() => ({ body: { mode: 'dry-run', written: false, summary: {}, warnings: [], retire: null } }))
    await api.run({ apply: true })
    await api.run({ capture: CAPTURE })
    expect(calls.map((call) => call.url)).toEqual(['/api/admin/sync/monday', '/api/admin/sync/upload'])
    expect(calls[0].body).toEqual({ apply: true })
  })

  it('turns a 409 into an error that carries the approval code', async () => {
    const { api } = server(() => ({ status: 409, body: { error: 'Retiring needs approval.', approval: 'abc123abc123' } }))
    expect(await api.run({ retire: true, apply: true }).catch((e) => e)).toMatchObject({ status: 409, approval: 'abc123abc123' })
  })

  it('reports a missing token as not configured', async () => {
    const { api } = server(() => ({ status: 501, body: { error: 'x' } }))
    expect(await api.testConnection()).toMatchObject({ ok: false, kind: 'not-configured' })
  })

  it('saves the schedule through the server, and refuses it in the browser build', async () => {
    const { api, calls } = server(() => ({ body: { intervalMinutes: 30, intervalSource: 'app' } }))
    expect(await api.setSchedule(30)).toMatchObject({ intervalMinutes: 30 })
    expect(calls[0]).toEqual({ url: '/api/admin/sync/schedule', body: { intervalMinutes: 30 } })
    expect(await harness().api.setSchedule(30).catch((e) => e.message)).toMatch(/server/)
  })

  it('reads server status', async () => {
    const { api } = server(() => ({ body: { mode: 'live', tokenSet: true, workspaceId: '7', intervalMinutes: 60, last: null } }))
    expect(await api.status()).toMatchObject({ where: 'server', mode: 'live' })
  })
})
