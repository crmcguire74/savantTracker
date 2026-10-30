// Every module this app ships must load and render inside the real platform,
// with real data, without tripping its sandbox. A new module is covered the
// moment it is added to src/modules/index.ts.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bundledSnapshot } from '../data/repository'
import { MODULES } from '../modules'
import { onModuleFault, type ModuleFault } from './diagnostics'
import { mountModule, waitFor, type Mounted } from './testing'

let app: Mounted | undefined
let faults: ModuleFault[] = []
let stopListening = () => {}

beforeEach(() => {
  faults = []
  stopListening = onModuleFault((fault) => faults.push(fault))
})

afterEach(() => {
  app?.unmount()
  app = undefined
  stopListening()
  sessionStorage.clear()
})

const firstProject = bundledSnapshot().state.projects[0]

describe.each(MODULES.map((manifest) => [manifest.id, manifest] as const))('module %s', (_id, manifest) => {
  it('loads and renders inside its sandbox', async () => {
    const hash = manifest.id === 'project' ? `#/project/${firstProject.id}` : `#/${manifest.id}`
    app = await mountModule(manifest, { with: MODULES, hash })

    expect(app.container.querySelector(`[data-module="${manifest.id}"]`)).not.toBeNull()
    expect(app.container.querySelector('.module-fault')).toBeNull()
    expect(faults).toEqual([])
  })
})

describe('the assembled app', () => {
  const portfolio = MODULES.find((manifest) => manifest.id === 'portfolio')!

  it('lists rail entries in order and hides the ones a role may not open', async () => {
    app = await mountModule(portfolio, { with: MODULES, shell: true, role: 'viewer' })
    const labels = [...app.container.querySelectorAll('.rail-label')].map((label) => label.textContent)
    expect(labels).toEqual(['Portfolio', 'Board', 'Timeline', 'Settings'])
  })

  it('shows the no-access page for a module outside the role', async () => {
    app = await mountModule(portfolio, { with: MODULES, shell: true, role: 'viewer', hash: '#/access' })
    expect(app.container.textContent).toContain('isn’t available to your role')
    expect(app.container.querySelector('[data-module="access"]')).toBeNull()
  })

  it('sends links saved from the old Reports page to their new homes', async () => {
    app = await mountModule(portfolio, { with: MODULES, shell: true, hash: '#/reports?report=pillar-one-pager&pillar=obj-2' })
    await waitFor(() => window.location.hash === '#/onepager?pillar=obj-2')
    expect(app.container.querySelector('[data-module="onepager"]')).not.toBeNull()
  })

  it('lands an unknown address on the first page the role may open', async () => {
    app = await mountModule(portfolio, { with: MODULES, shell: true, hash: '#/no-such-page' })
    expect(app.container.querySelector('[data-module="portfolio"]')).not.toBeNull()
  })
})
