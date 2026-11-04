// The server-side monday lock: the pure rules, then the route that applies them.

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createMemoryStore } from './memory-store.js'
import { lockViolations } from './monday/lock.js'

const project = (over = {}) => ({
  id: 'p1', initiativeId: 'i1', title: 'Owl', mondayId: '9001', rag: 'green', progress: 10, businessOwner: 'A',
  issues: [], planLink: '', decisionOutcome: '', ...over,
})
const stateOf = (over = {}) => ({
  quarter: 'Q',
  pillars: [{ id: 'o1', title: 'Pillar', owner: '', mondayId: '1' }],
  initiatives: [{ id: 'i1', pillarId: 'o1', title: 'Init', mondayId: '2' }],
  projects: [project()],
  ...over,
})

describe('lockViolations', () => {
  it('allows an identical state and edits to tracker-owned data', () => {
    expect(lockViolations(stateOf(), stateOf())).toEqual([])
    const withIssue = stateOf({ projects: [project({ issues: [{ id: 'x' }], planLink: 'https://p', decisionOutcome: 'ok' })] })
    expect(lockViolations(stateOf(), withIssue)).toEqual([])
  })

  it('allows everything when there is no stored state yet (first seed)', () => {
    expect(lockViolations(undefined, stateOf())).toEqual([])
  })

  it('refuses a change to a synced field on a linked project', () => {
    const next = stateOf({ projects: [project({ rag: 'red' })] })
    expect(lockViolations(stateOf(), next)).toHaveLength(1)
  })

  it('refuses a rename, a move, and a removal of linked records', () => {
    expect(lockViolations(stateOf(), stateOf({ pillars: [{ id: 'o1', title: 'New', owner: '', mondayId: '1' }] }))).toHaveLength(1)
    expect(lockViolations(stateOf(), stateOf({ initiatives: [{ id: 'i1', pillarId: 'o9', title: 'Init', mondayId: '2' }] }))).toHaveLength(1)
    expect(lockViolations(stateOf(), stateOf({ projects: [] }))).toHaveLength(1)
  })

  it('refuses a new pillar, initiative or project', () => {
    expect(lockViolations(stateOf(), stateOf({ projects: [project(), project({ id: 'p2', mondayId: undefined })] }))).toHaveLength(1)
  })

  it('lets an unlinked record be edited or removed', () => {
    const current = stateOf({ projects: [project(), project({ id: 'p2', mondayId: undefined, rag: 'amber' })] })
    const next = stateOf({ projects: [project()] })
    expect(lockViolations(current, next)).toEqual([])
  })
})

describe('state writes while the sync is live', () => {
  let server
  let base
  const EDITOR = {
    'x-ms-client-principal': Buffer.from(
      JSON.stringify({ auth_typ: 'aad', claims: [{ typ: 'oid', val: 'o' }, { typ: 'roles', val: 'Tracker.Editor' }] }),
    ).toString('base64'),
  }

  beforeAll(async () => {
    process.env.REQUIRE_AUTH = 'true'
    const store = createMemoryStore([{ key: 'tracker.state', value: stateOf(), version: 1, updatedAt: '' }])
    const app = createApp({ store, sync: { live: true }, serveStatic: false })
    await new Promise((resolve) => {
      server = app.listen(0, resolve)
    })
    base = `http://127.0.0.1:${server.address().port}`
  })
  afterAll(() => server?.close())

  const put = (value) =>
    fetch(`${base}/api/documents/tracker.state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-Match': '"1"', ...EDITOR },
      body: JSON.stringify({ value }),
    })

  it('refuses an edit to a synced field with a 403 and a reason', async () => {
    const response = await put(stateOf({ projects: [project({ rag: 'red' })] }))
    expect(response.status).toBe(403)
    expect((await response.json()).details.length).toBeGreaterThan(0)
  })

  it('accepts an edit to tracker-owned data', async () => {
    const response = await put(stateOf({ projects: [project({ planLink: 'https://plan' })] }))
    expect(response.status).toBe(200)
  })

  it('lets only an admin write the pillar order', async () => {
    const ADMIN = {
      'x-ms-client-principal': Buffer.from(
        JSON.stringify({ auth_typ: 'aad', claims: [{ typ: 'oid', val: 'a' }, { typ: 'roles', val: 'Tracker.Admin' }] }),
      ).toString('base64'),
    }
    const write = (headers) =>
      fetch(`${base}/api/documents/tracker.pillarorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ value: { ids: ['o1'], updatedAt: 't', updatedByName: 'Ada' } }),
      })
    expect((await write(EDITOR)).status).toBe(403)
    expect((await write(ADMIN)).status).toBe(200)
  })

  it('refuses to delete the state', async () => {
    const response = await fetch(`${base}/api/documents/tracker.state`, { method: 'DELETE', headers: EDITOR })
    expect(response.status).toBe(403)
  })
})
