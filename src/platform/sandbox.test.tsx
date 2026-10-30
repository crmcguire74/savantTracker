import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlatform } from './context'
import { onModuleFault, type ModuleFault } from './diagnostics'
import { setReloadHandler } from './lazyModule'
import type { ModuleEntry, ModuleManifest } from './module'
import { mountModule, waitFor, type Mounted } from './testing'

// Each test builds its own modules with unique ids, so the lazy-load cache
// never hands one test another test's bundle.
let seq = 0
const mod = (title: string, render: ModuleEntry, patch: Partial<ModuleManifest> = {}): ModuleManifest => ({
  id: `${title.toLowerCase().replace(/\W+/g, '-')}-${++seq}`,
  title,
  navOrder: seq,
  load: () => Promise.resolve({ default: render }),
  ...patch,
})

const Healthy: ModuleEntry = () => <div className="page" id="healthy">All good</div>

let app: Mounted | undefined
let faults: ModuleFault[] = []
let stopListening = () => {}

beforeEach(() => {
  faults = []
  stopListening = onModuleFault((fault) => faults.push(fault))
  // React and the fault reporter both log the contained errors; keep output readable.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  app?.unmount()
  app = undefined
  stopListening()
  vi.restoreAllMocks()
  sessionStorage.clear()
})

const alert = () => app!.container.querySelector('[role="alert"]')

describe('module sandbox', () => {
  it('contains a render crash to its own module and keeps the shell working', async () => {
    const healthy = mod('Healthy', Healthy)
    const crashing = mod('Crashing', () => {
      throw new Error('kaboom')
    })
    app = await mountModule(crashing, { with: [healthy], shell: true })

    expect(alert()?.textContent).toContain('Crashing hit a problem')
    expect(alert()?.textContent).toContain('kaboom')
    expect(app.container.querySelectorAll('.rail-item')).toHaveLength(2)
    expect(faults).toEqual([expect.objectContaining({ moduleId: crashing.id, phase: 'render' })])

    await app.go(`#/${healthy.id}`)
    expect(app.container.querySelector('#healthy')).not.toBeNull()
    expect(alert()).toBeNull()
  })

  it('remounts a module from scratch on "Try again"', async () => {
    let broken = true
    const flaky = mod('Flaky', () => {
      if (broken) throw new Error('not ready yet')
      return <div className="page" id="recovered">Recovered</div>
    })
    app = await mountModule(flaky)
    expect(alert()).not.toBeNull()

    broken = false
    const retry = [...app.container.querySelectorAll('button')].find((button) => button.textContent === 'Try again')!
    act(() => retry.click())
    await waitFor(() => Boolean(app!.container.querySelector('#recovered')))
  })

  it('stops a module from corrupting shared data in development', async () => {
    const vandal = mod('Vandal', () => {
      const { tracker } = usePlatform()
      ;(tracker.state.projects as unknown[]).push({ id: 'injected' })
      return null
    })
    app = await mountModule(vandal)
    expect(alert()?.textContent).toContain('Vandal hit a problem')
    expect(faults[0]?.error).toBeInstanceOf(TypeError)
  })

  it('reports a module whose code will not load, without reloading the page', async () => {
    const reload = vi.fn()
    setReloadHandler(reload)
    const missing = mod('Missing', Healthy, { load: () => Promise.reject(new Error('network down')) })
    app = await mountModule(missing)

    expect(alert()?.textContent).toContain('Missing couldn’t load')
    expect(faults).toEqual([expect.objectContaining({ moduleId: missing.id, phase: 'load' })])
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once when a deploy has replaced the module bundle', async () => {
    const reload = vi.fn()
    setReloadHandler(reload)
    const healthy = mod('Healthy', Healthy)
    const stale = mod('Stale', Healthy, {
      load: () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/stale-abc123.js')),
    })
    app = await mountModule(healthy, { with: [stale] })

    act(() => {
      window.location.hash = `#/${stale.id}`
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await waitFor(() => reload.mock.calls.length > 0)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('survives a manifest callback that throws', async () => {
    const odd = mod('Odd', Healthy, {
      activeNav: () => {
        throw new Error('bad activeNav')
      },
    })
    app = await mountModule(odd, { shell: true })
    expect(app.container.querySelector('#healthy')).not.toBeNull()
    expect(faults).toContainEqual(expect.objectContaining({ moduleId: odd.id, phase: 'manifest' }))
  })

  it('never downloads a module the viewer may not open', async () => {
    const load = vi.fn(() => Promise.resolve({ default: Healthy }))
    const secret = mod('Secret', Healthy, { adminOnly: true, load })
    const open = mod('Open', Healthy)
    app = await mountModule(secret, { role: 'viewer', with: [open], hash: `#/${secret.id}` })

    expect(app.container.textContent).toContain('isn’t available to your role')
    expect(load).not.toHaveBeenCalled()
  })
})
