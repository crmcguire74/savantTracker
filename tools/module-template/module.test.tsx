import { afterEach, describe, expect, it } from 'vitest'
import { mountModule, type Mounted } from '@sdk/testing'
import { manifest } from './manifest'

let app: Mounted | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

describe('__ID__ module', () => {
  it('renders inside the platform', async () => {
    app = await mountModule(manifest)
    expect(app.container.querySelector('h1')?.textContent).toBe('__TITLE__')
  })

  it('reads its filter from its own URL', async () => {
    app = await mountModule(manifest, { hash: '#/__ID__?filter=zzz-no-match' })
    expect(app.container.textContent).toContain('No projects match')
  })

  it('is closed to roles without its feature', async () => {
    app = await mountModule(manifest, { role: 'viewer' })
    expect(app.container.textContent).toContain('available to your role')
  })
})
