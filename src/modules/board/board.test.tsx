// The board module tested on its own: only this module is registered, mounted
// inside the real platform through `@sdk/testing`. This is the pattern for
// every module's tests, including ones built outside this repository.

import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { mountModule, waitFor, type Mounted } from '@sdk/testing'
import { manifest } from './manifest'

let app: Mounted | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
})

describe('board module', () => {
  it('opens by phase, with a column per phase', async () => {
    app = await mountModule(manifest)
    expect(app.container.querySelector('h1')?.textContent).toBe('Projects by phase')
    expect(app.container.querySelector('.board-phase')).not.toBeNull()
  })

  it('reads its layout from its own URL', async () => {
    app = await mountModule(manifest, { hash: '#/board?layout=status' })
    expect(app.container.querySelector('h1')?.textContent).toBe('Projects by status')
  })

  it('switches layout in place, keeping the default out of the URL', async () => {
    app = await mountModule(manifest, { hash: '#/board?layout=status' })
    const byPhase = [...app.container.querySelectorAll('button')].find((button) => button.textContent === 'By phase')!
    act(() => byPhase.click())
    await waitFor(() => app!.container.querySelector('h1')?.textContent === 'Projects by phase')
    expect(window.location.hash).toBe('#/board')
  })

  it('is read-only for viewers', async () => {
    app = await mountModule(manifest, { role: 'viewer' })
    expect(app.container.textContent).not.toContain('Drag a card')
  })
})
