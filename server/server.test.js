// Route and authorization tests for the Azure API. No Azure, no network:
// the routes run against the in-memory store and a hand-built Easy Auth
// header, which is exactly the shape App Service injects.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createMemoryStore } from './memory-store.js'

const principal = (roles, name = 'Test Person', oid = 'oid-1234') =>
  Buffer.from(
    JSON.stringify({
      auth_typ: 'aad',
      name_typ: 'name',
      role_typ: 'roles',
      claims: [
        { typ: 'name', val: name },
        { typ: 'http://schemas.microsoft.com/identity/claims/objectidentifier', val: oid },
        ...roles.map((role) => ({ typ: 'roles', val: role })),
      ],
    }),
  ).toString('base64')

const EDITOR = { 'x-ms-client-principal': principal(['Tracker.Editor']) }
const VIEWER = { 'x-ms-client-principal': principal(['Tracker.Viewer'], 'Dana Viewer', 'oid-viewer') }
const NO_ROLE = { 'x-ms-client-principal': principal([]) }
const ADMIN = { 'x-ms-client-principal': principal(['Tracker.Admin'], 'Ada Admin', 'oid-admin') }
const EXECUTIVE = { 'x-ms-client-principal': principal(['Tracker.Executive'], 'Eve Exec', 'oid-exec') }

let server
let base

beforeAll(async () => {
  process.env.REQUIRE_AUTH = 'true'
  const app = createApp({ store: createMemoryStore(), serveStatic: false })
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(() => {
  server?.close()
})

const call = (path, options = {}) =>
  fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })

describe('authentication', () => {
  it('refuses an anonymous caller', async () => {
    expect((await call('/api/documents?prefix=tracker/')).status).toBe(401)
    expect((await call('/api/me')).status).toBe(401)
  })

  it('refuses a tenant account holding neither role', async () => {
    const response = await call('/api/documents?prefix=tracker/', { headers: NO_ROLE })
    expect(response.status).toBe(403)
  })

  it('reports identity and role at /api/me', async () => {
    const response = await call('/api/me', { headers: VIEWER })
    expect(response.status).toBe(200)
    const me = await response.json()
    expect(me).toMatchObject({ id: 'oid-viewer', name: 'Dana Viewer', canWrite: false })
    expect(me.roles).toContain('Tracker.Viewer')
  })
})

describe('authorization', () => {
  it('lets an editor write', async () => {
    const response = await call('/api/documents/tracker%2Fstate', {
      method: 'PUT',
      headers: EDITOR,
      body: JSON.stringify({ value: { quarter: 'Q1' } }),
    })
    expect(response.status).toBe(200)
    const written = await response.json()
    expect(written.version).toBe(1)
    expect(written.key).toBe('tracker/state')
  })

  it('lets a viewer read', async () => {
    const response = await call('/api/documents/tracker%2Fstate', { headers: VIEWER })
    expect(response.status).toBe(200)
    expect((await response.json()).value.quarter).toBe('Q1')
  })

  it('refuses a viewer write with 403', async () => {
    const response = await call('/api/documents/tracker%2Fstate', {
      method: 'PUT',
      headers: VIEWER,
      body: JSON.stringify({ value: { quarter: 'hacked' } }),
    })
    expect(response.status).toBe(403)

    const after = await (await call('/api/documents/tracker%2Fstate', { headers: EDITOR })).json()
    expect(after.value.quarter).toBe('Q1')
  })

  it('refuses a viewer delete with 403', async () => {
    const response = await call('/api/documents/tracker%2Fstate', { method: 'DELETE', headers: VIEWER })
    expect(response.status).toBe(403)
  })

  it('lets an executive read but not write', async () => {
    expect((await call('/api/documents/tracker%2Fstate', { headers: EXECUTIVE })).status).toBe(200)
    const write = await call('/api/documents/tracker%2Fstate', {
      method: 'PUT',
      headers: EXECUTIVE,
      body: JSON.stringify({ value: { quarter: 'exec' } }),
    })
    expect(write.status).toBe(403)
  })

  it('lets an admin write project data', async () => {
    const response = await call('/api/documents/tracker.admin-probe', {
      method: 'PUT',
      headers: ADMIN,
      body: JSON.stringify({ value: { ok: true } }),
    })
    expect(response.status).toBe(200)
  })

  it('keeps the access policy admin-only, even for editors', async () => {
    const policy = JSON.stringify({ value: { features: {}, reports: {} } })
    const asEditor = await call('/api/documents/tracker.access', { method: 'PUT', headers: EDITOR, body: policy })
    expect(asEditor.status).toBe(403)
    const asAdmin = await call('/api/documents/tracker.access', { method: 'PUT', headers: ADMIN, body: policy })
    expect(asAdmin.status).toBe(200)
    // Everyone with a role can still read it; the browser needs it to draw the nav.
    expect((await call('/api/documents/tracker.access', { headers: VIEWER })).status).toBe(200)
  })

  it('acts as the tester’s picked role only when sign-in is off', async () => {
    const asViewer = { 'x-tracker-dev-role': 'viewer' }
    expect((await call('/api/me', { headers: asViewer })).status).toBe(401)
    process.env.REQUIRE_AUTH = 'false'
    try {
      expect(await (await call('/api/me', { headers: asViewer })).json()).toMatchObject({ local: true, canWrite: false })
      expect(await (await call('/api/me')).json()).toMatchObject({ local: true, canWrite: true, isAdmin: false })
    } finally {
      process.env.REQUIRE_AUTH = 'true'
    }
  })

  it('reports admin standing at /api/me', async () => {
    expect(await (await call('/api/me', { headers: ADMIN })).json()).toMatchObject({ canWrite: true, isAdmin: true })
    expect(await (await call('/api/me', { headers: EDITOR })).json()).toMatchObject({ canWrite: true, isAdmin: false })
  })
})

describe('document semantics', () => {
  it('404s an unknown document rather than inventing one', async () => {
    expect((await call('/api/documents/tracker%2Fnope', { headers: EDITOR })).status).toBe(404)
  })

  it('honours If-Match and returns the winning version on conflict', async () => {
    const first = await (
      await call('/api/documents/tracker%2Flock', {
        method: 'PUT',
        headers: EDITOR,
        body: JSON.stringify({ value: { n: 1 } }),
      })
    ).json()

    const ok = await call('/api/documents/tracker%2Flock', {
      method: 'PUT',
      headers: { ...EDITOR, 'If-Match': `"${first.version}"` },
      body: JSON.stringify({ value: { n: 2 } }),
    })
    expect(ok.status).toBe(200)

    const stale = await call('/api/documents/tracker%2Flock', {
      method: 'PUT',
      headers: { ...EDITOR, 'If-Match': `"${first.version}"` },
      body: JSON.stringify({ value: { n: 3 } }),
    })
    expect(stale.status).toBe(409)
    expect((await stale.json()).version).toBe(2)

    const current = await (await call('/api/documents/tracker%2Flock', { headers: EDITOR })).json()
    expect(current.value.n).toBe(2)
  })

  it('lists by prefix', async () => {
    await call('/api/documents/other%2Fthing', {
      method: 'PUT',
      headers: EDITOR,
      body: JSON.stringify({ value: {} }),
    })
    const tracker = await (await call('/api/documents?prefix=tracker/', { headers: EDITOR })).json()
    expect(tracker.every((doc) => doc.key.startsWith('tracker/'))).toBe(true)
    expect(tracker.length).toBeGreaterThanOrEqual(2)
  })

  it('answers the health probe', async () => {
    expect((await call('/api/health')).status).toBe(200)
  })
})

describe('static files for the installable app', () => {
  let staticServer
  let staticBase

  beforeAll(async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const root = mkdtempSync(join(tmpdir(), 'tracker-static-'))
    mkdirSync(join(root, 'assets'))
    writeFileSync(join(root, 'index.html'), '<!doctype html>')
    writeFileSync(join(root, 'sw.js'), 'self.addEventListener("fetch", () => {})')
    writeFileSync(join(root, 'manifest.webmanifest'), '{}')
    writeFileSync(join(root, 'assets', 'index-abc123.js'), 'export {}')
    const app = createApp({ store: createMemoryStore(), staticRoot: root })
    await new Promise((resolve) => {
      staticServer = app.listen(0, resolve)
    })
    staticBase = `http://127.0.0.1:${staticServer.address().port}`
  })

  afterAll(() => staticServer?.close())

  const get = (path) => fetch(`${staticBase}${path}`, { headers: EDITOR })

  it('never lets the service worker or manifest go stale in the HTTP cache', async () => {
    expect((await get('/sw.js')).headers.get('cache-control')).toBe('no-cache')
    const manifest = await get('/manifest.webmanifest')
    expect(manifest.headers.get('cache-control')).toBe('no-cache')
    expect(manifest.headers.get('content-type')).toContain('application/manifest+json')
  })

  it('caches hashed assets for a year', async () => {
    expect((await get('/assets/index-abc123.js')).headers.get('cache-control')).toContain('immutable')
  })
})
