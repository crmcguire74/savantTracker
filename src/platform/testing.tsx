// 🧪 Test harness for modules: mounts a module inside the real platform (real
// provider, real storage contract, real sandbox), exactly as the app does.
// A module team writes its tests against this and needs nothing else.
//
//   const app = await mountModule(manifest, { hash: '#/board?layout=status' })
//   expect(app.container.textContent).toContain('Board')
//   app.unmount()
//
// Storage is whatever the test environment provides (fake-indexeddb under
// Vitest), seeded from the bundled snapshot on first open.

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Role } from '../auth/roles'
import { CurrentModule } from './ModuleHost'
import type { ModuleManifest } from './module'
import { PlatformProvider } from './PlatformProvider'
import { createRegistry } from './registry'
import { AppShell } from './Shell'

// Tells React these renders are driven by act(), which silences its warning.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface MountOptions {
  /** Initial location, e.g. `#/portfolio?layout=brief`. Defaults to the module's own page. */
  hash?: string
  /** The local test role. Defaults to admin, which can open everything. */
  role?: Role
  /** Other modules to register alongside, so cross-module links resolve. */
  with?: readonly ModuleManifest[]
  /** Render the full shell (top bar and rail) instead of the module alone. */
  shell?: boolean
}

export interface Mounted {
  container: HTMLElement
  /** Moves the hash and lets the app settle. */
  go: (hash: string) => Promise<void>
  unmount: () => void
}

/** Lets effects, lazy imports and storage reads settle until `ready` holds. */
export async function waitFor(ready: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now()
  while (!ready()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor: timed out')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  }
}

/** True once the module's sandbox has rendered something other than its spinner. */
export const settled = (container: HTMLElement): boolean => {
  const host = container.querySelector('.module-host, .page')
  return Boolean(host) && !container.querySelector('.module-loading') && !container.querySelector('.boot')
}

export async function mountModule(manifest: ModuleManifest, options: MountOptions = {}): Promise<Mounted> {
  sessionStorage.setItem('savant-tracker:dev-role', options.role ?? 'admin')
  localStorage.setItem('savant-tracker:identity', JSON.stringify({ id: 'test-user', name: 'Test User' }))
  window.history.replaceState(null, '', options.hash ?? `#/${manifest.id}`)

  const others = (options.with ?? []).filter((other) => other.id !== manifest.id)
  const registry = createRegistry([manifest, ...others], { strict: true })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)

  act(() =>
    root.render(<PlatformProvider registry={registry}>{options.shell ? <AppShell /> : <CurrentModule />}</PlatformProvider>),
  )
  await waitFor(() => settled(container))

  return {
    container,
    async go(hash) {
      await act(async () => {
        window.location.hash = hash
        window.dispatchEvent(new HashChangeEvent('hashchange'))
      })
      await waitFor(() => settled(container))
    },
    unmount() {
      act(() => root.unmount())
      container.remove()
    },
  }
}
