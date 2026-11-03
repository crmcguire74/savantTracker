// @vitest-environment node
// 🧪 The start-up probe decides which sign-in the app uses.
import { beforeEach, describe, expect, it } from 'vitest'
import { probeRuntime, resetRuntime, runtimeInfo } from './runtime'
import { authMode } from './session'

const answer = (status: number, body: unknown = {}): typeof fetch =>
  (async () => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response) as unknown as typeof fetch

beforeEach(() => resetRuntime())

describe('probeRuntime', () => {
  it('uses the test sign-in when there is no server', async () => {
    const info = await probeRuntime({ driver: 'indexeddb', fetchImpl: answer(500) })
    expect(info).toMatchObject({ auth: 'local', mondayLive: false, probed: true })
    expect(authMode()).toBe('local')
  })

  it('switches to Entra roles when the server has real sign-in', async () => {
    const info = await probeRuntime({ driver: 'rest', fetchImpl: answer(200, { local: false, mondayLive: true }) })
    expect(info).toMatchObject({ auth: 'entra', mondayLive: true })
    expect(authMode()).toBe('entra')
  })

  it('keeps the test sign-in against a server with no sign-in', async () => {
    await probeRuntime({ driver: 'rest', fetchImpl: answer(200, { local: true }) })
    expect(authMode()).toBe('local')
    expect(runtimeInfo().mondayLive).toBe(false)
  })

  it('falls back to the test sign-in when the server cannot be reached or refuses', async () => {
    await probeRuntime({ driver: 'rest', fetchImpl: answer(401) })
    expect(authMode()).toBe('local')
    await probeRuntime({
      driver: 'rest',
      fetchImpl: (async () => {
        throw new Error('offline')
      }) as unknown as typeof fetch,
    })
    expect(authMode()).toBe('local')
  })
})
