// Admin sync routes: who may call them, and what each one does. No network, no token: the sync
// service runs in test mode against the in-memory store with a small capture file.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createMemoryStore } from './memory-store.js'
import { FIELD_COLUMNS, SYNCED_FIELDS } from './monday/mapping.js'
import { createSyncService } from './monday/service.js'

const principal = (roles) =>
  Buffer.from(
    JSON.stringify({
      auth_typ: 'aad',
      claims: [
        { typ: 'name', val: 'Test Person' },
        { typ: 'oid', val: 'oid-1' },
        ...roles.map((role) => ({ typ: 'roles', val: role })),
      ],
    }),
  ).toString('base64')
const as = (role) => ({ 'x-ms-client-principal': principal([role]) })
const ADMIN = as('Tracker.Admin')
const EDITOR = as('Tracker.Editor')

const COLUMNS = SYNCED_FIELDS.map((field) => ({ id: `c_${field}`, title: FIELD_COLUMNS[field][0], type: 'text' }))
const CAPTURE = {
  format: 'monday-capture',
  version: 1,
  capturedAt: '2026-11-03T00:00:00.000Z',
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

let server
let base
let store

beforeAll(async () => {
  process.env.REQUIRE_AUTH = 'true'
  store = createMemoryStore([
    { key: 'tracker.state', value: { quarter: 'Q', pillars: [], initiatives: [], projects: [] }, version: 1, updatedAt: '' },
  ])
  const sync = createSyncService({ store, env: {}, makeClient: () => ({ query: async () => ({}) }) })
  const app = createApp({ store, sync, serveStatic: false })
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(() => server?.close())

const call = (path, { headers, body, method } = {}) =>
  fetch(`${base}${path}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('admin sync routes', () => {
  it('turns away anonymous callers and editors', async () => {
    expect((await call('/api/admin/sync/status')).status).toBe(401)
    expect((await call('/api/admin/sync/status', { headers: EDITOR })).status).toBe(403)
    expect((await call('/api/admin/sync/upload', { headers: EDITOR, body: { capture: CAPTURE, apply: true } })).status).toBe(403)
    expect((await call('/api/admin/sync/restore', { headers: EDITOR, body: { key: 'x' } })).status).toBe(403)
  })

  it('reports test mode when no token is set', async () => {
    const response = await call('/api/admin/sync/status', { headers: ADMIN })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ mode: 'test', tokenSet: false, last: null })
  })

  it('says 501 for live actions without a token', async () => {
    expect((await call('/api/admin/sync/monday', { headers: ADMIN, body: {} })).status).toBe(501)
    expect((await call('/api/admin/sync/test', { headers: ADMIN, body: {} })).status).toBe(501)
    expect((await call('/api/admin/sync/capture', { headers: ADMIN, body: {} })).status).toBe(501)
  })

  it('rejects a bad capture with 400', async () => {
    const response = await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: { format: 'nope' } } })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/monday-capture/)
  })

  it('previews, then applies an uploaded capture', async () => {
    const dry = await (await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: CAPTURE } })).json()
    expect(dry).toMatchObject({ mode: 'dry-run', written: false, source: 'upload' })
    expect((await store.readDocument('tracker.state')).doc.value.projects).toHaveLength(0)

    const done = await (await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: CAPTURE, apply: true } })).json()
    expect(done.written).toBe(true)
    expect((await store.readDocument('tracker.state')).doc.value.projects).toHaveLength(1)
    expect((await (await call('/api/admin/sync/status', { headers: ADMIN })).json()).last).toMatchObject({ ok: true, source: 'upload' })
  })

  it('demands the approval code to retire, then backs up and restores', async () => {
    const stray = { ...(await store.readDocument('tracker.state')).doc.value }
    await store.writeDocument(
      'tracker.state',
      { ...stray, pillars: [...stray.pillars, { id: 'old', title: 'Old pillar', owner: '' }] },
      (await store.readDocument('tracker.state')).doc.version,
    )
    const dry = await (await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: CAPTURE, retire: true } })).json()
    expect(dry.retire.counts.pillars).toBe(1)

    const refused = await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: CAPTURE, retire: true, apply: true } })
    expect(refused.status).toBe(409)
    expect((await refused.json()).approval).toBe(dry.retire.approval)

    const ok = await (
      await call('/api/admin/sync/upload', { headers: ADMIN, body: { capture: CAPTURE, retire: true, apply: true, approval: dry.retire.approval } })
    ).json()
    expect(ok.retire.backupKey).toMatch(/^tracker\.backup\./)

    const backups = await (await call('/api/admin/sync/backups', { headers: ADMIN })).json()
    expect(backups).toHaveLength(1)
    const restored = await (await call('/api/admin/sync/restore', { headers: ADMIN, body: { key: backups[0].key, apply: true } })).json()
    expect(restored.written).toBe(true)
    expect((await store.readDocument('tracker.state')).doc.value.pillars.some((pillar) => pillar.id === 'old')).toBe(true)
    expect((await call('/api/admin/sync/restore', { headers: ADMIN, body: { key: 'tracker.backup.nope' } })).status).toBe(400)
  })

  it('keeps backups and sync status admin-write-only in the document API', async () => {
    const put = (key, headers) =>
      call(`/api/documents/${key}`, { method: 'PUT', headers, body: { value: { entries: [] } } })
    expect((await put('tracker.sync', EDITOR)).status).toBe(403)
    expect((await put('tracker.syncconfig', EDITOR)).status).toBe(403)
    expect((await put('tracker.backup.20261103', EDITOR)).status).toBe(403)
    expect((await put('tracker.backup.20261103', ADMIN)).status).toBe(200)
  })

  it('lets only admins set the schedule, and validates it', async () => {
    const set = (headers, intervalMinutes) => call('/api/admin/sync/schedule', { headers, body: { intervalMinutes } })
    expect((await set(EDITOR, 30)).status).toBe(403)
    expect((await set(ADMIN, 3)).status).toBe(400)
    expect((await set(ADMIN, '30')).status).toBe(400)
    expect((await set(ADMIN, 2000)).status).toBe(400)
    expect(await (await set(ADMIN, 30)).json()).toEqual({ intervalMinutes: 30, intervalSource: 'app' })
    expect(await (await call('/api/admin/sync/status', { headers: ADMIN })).json()).toMatchObject({ intervalMinutes: 30, intervalSource: 'app' })
    expect((await set(ADMIN, 0)).status).toBe(200)
  })
})
